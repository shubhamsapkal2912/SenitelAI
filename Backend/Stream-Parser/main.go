package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"log"
	"os"
	"sync"
	"time"

	"github.com/bluenviron/gortsplib/v4"
	"github.com/bluenviron/gortsplib/v4/pkg/format"
	"github.com/bluenviron/gortsplib/v4/pkg/format/rtph264"
	gortspliburl "github.com/bluenviron/gortsplib/v4/pkg/url"
	"github.com/pion/rtp"
	amqp "github.com/rabbitmq/amqp091-go"
)

// ── Command received from pipeline_control queue ───────────
type PipelineCommand struct {
	Action     string `json:"action"`
	PipelineID int    `json:"pipeline_id"`
	CameraID   int    `json:"camera_id"`
	RTSPUrl    string `json:"rtsp_url"`
	QueueName  string `json:"queue_name"`
	ThrottleMs int    `json:"throttle_ms"`
}

// ── Manages one goroutine per active pipeline ──────────────
type PipelineManager struct {
	mu      sync.Mutex
	cancels map[int]context.CancelFunc
	conn    *amqp.Connection
}

func NewPipelineManager(conn *amqp.Connection) *PipelineManager {
	return &PipelineManager{
		cancels: make(map[int]context.CancelFunc),
		conn:    conn,
	}
}

func (pm *PipelineManager) Handle(cmd PipelineCommand) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	switch cmd.Action {
	case "start":
		if _, exists := pm.cancels[cmd.PipelineID]; exists {
			log.Printf("[Manager] Pipeline %d already running, skipping", cmd.PipelineID)
			return
		}
		ctx, cancel := context.WithCancel(context.Background())
		pm.cancels[cmd.PipelineID] = cancel
		go pm.runPipeline(ctx, cmd)
		log.Printf("[Manager] Started pipeline %d → queue: %s", cmd.PipelineID, cmd.QueueName)

	case "stop":
		if cancel, exists := pm.cancels[cmd.PipelineID]; exists {
			cancel()
			delete(pm.cancels, cmd.PipelineID)
			log.Printf("[Manager] Stopped pipeline %d", cmd.PipelineID)
		}
	default:
		log.Printf("[Manager] Unknown action: %s", cmd.Action)
	}
}

// ── Core RTSP → RabbitMQ logic (your existing main() logic) ──
func (pm *PipelineManager) runPipeline(ctx context.Context, cmd PipelineCommand) {
	throttle := time.Duration(cmd.ThrottleMs) * time.Millisecond
	if throttle == 0 {
		throttle = 1000 * time.Millisecond
	}

	// ── RabbitMQ channel (one per pipeline goroutine) ──────
	ch, err := pm.conn.Channel()
	if err != nil {
		log.Printf("[Pipeline %d] Channel error: %v", cmd.PipelineID, err)
		return
	}
	defer ch.Close()

	_, err = ch.QueueDeclare(cmd.QueueName, true, false, false, false, nil)
	if err != nil {
		log.Printf("[Pipeline %d] Queue declare error: %v", cmd.PipelineID, err)
		return
	}

	// ── RTSP client ────────────────────────────────────────
	c := gortsplib.Client{}

	u, err := gortspliburl.Parse(cmd.RTSPUrl)
	if err != nil {
		log.Printf("[Pipeline %d] Invalid RTSP URL: %v", cmd.PipelineID, err)
		return
	}

	if err := c.Start(u.Scheme, u.Host); err != nil {
		log.Printf("[Pipeline %d] RTSP Start error: %v", cmd.PipelineID, err)
		return
	}
	defer c.Close()

	desc, _, err := c.Describe(u)
	if err != nil {
		log.Printf("[Pipeline %d] RTSP Describe error: %v", cmd.PipelineID, err)
		return
	}

	var h264Format *format.H264
	media := desc.FindFormat(&h264Format)
	if media == nil {
		log.Printf("[Pipeline %d] No H264 format found", cmd.PipelineID)
		return
	}

	rtpDec := &rtph264.Decoder{}
	rtpDec.Init()

	if _, err = c.Setup(desc.BaseURL, media, 0, 0); err != nil {
		log.Printf("[Pipeline %d] RTSP Setup error: %v", cmd.PipelineID, err)
		return
	}

	var mu sync.Mutex
	lastPublish := time.Now().Add(-throttle)

	c.OnPacketRTP(media, h264Format, func(pkt *rtp.Packet) {
		// ── Stop if context cancelled ──────────────────────
		select {
		case <-ctx.Done():
			c.Close()
			return
		default:
		}

		nalus, err := rtpDec.Decode(pkt)
		if err != nil {
			return
		}

		for _, nalu := range nalus {
			if len(nalu) < 1 || (nalu[0]&0x1F) != 5 {
				continue
			}

			mu.Lock()
			elapsed := time.Since(lastPublish)
			mu.Unlock()

			if elapsed < throttle {
				continue
			}

			// ── Build Annex-B ──────────────────────────────
			startCode := []byte{0x00, 0x00, 0x00, 0x01}
			var annexb []byte
			if len(h264Format.SPS) > 0 {
				annexb = append(annexb, startCode...)
				annexb = append(annexb, h264Format.SPS...)
			}
			if len(h264Format.PPS) > 0 {
				annexb = append(annexb, startCode...)
				annexb = append(annexb, h264Format.PPS...)
			}
			annexb = append(annexb, startCode...)
			annexb = append(annexb, nalu...)

			b64 := base64.StdEncoding.EncodeToString(annexb)

			msgBody, _ := json.Marshal(map[string]interface{}{
				"pipeline_id": cmd.PipelineID,
				"camera_id":   cmd.CameraID,
				"frame":       b64,
				"type":        "h264_annexb",
				"timestamp":   time.Now().Unix(),
			})

			if err := ch.Publish("", cmd.QueueName, false, false,
				amqp.Publishing{
					ContentType:  "application/json",
					Body:         msgBody,
					DeliveryMode: 2,
				},
			); err != nil {
				log.Printf("[Pipeline %d] Publish error: %v", cmd.PipelineID, err)
			} else {
				mu.Lock()
				lastPublish = time.Now()
				mu.Unlock()
				log.Printf("[Pipeline %d] Published keyframe → %s", cmd.PipelineID, cmd.QueueName)
			}
		}
	})

	if _, err = c.Play(nil); err != nil {
		log.Printf("[Pipeline %d] RTSP Play error: %v", cmd.PipelineID, err)
		return
	}

	// Block until context is cancelled or stream ends
	done := make(chan error, 1)
	go func() { done <- c.Wait() }()

	select {
	case <-ctx.Done():
		log.Printf("[Pipeline %d] Stopped by manager", cmd.PipelineID)
	case err := <-done:
		log.Printf("[Pipeline %d] Stream ended: %v", cmd.PipelineID, err)
	}
}

// ── Entry point: listen for pipeline commands ──────────────
func main() {
    rabbitmqURL := os.Getenv("RABBITMQ_URL")
    if rabbitmqURL == "" {
        rabbitmqURL = "amqp://guest:guest@localhost:5672/"
    }

    conn, err := amqp.Dial(rabbitmqURL)
    if err != nil {
        log.Fatalf("RabbitMQ connection error: %v", err)
    }
    defer conn.Close()

    ch, err := conn.Channel()
    if err != nil {
        log.Fatalf("Channel error: %v", err)
    }

    // ✅ Declare the same fanout exchange
    ch.ExchangeDeclare(
        "pipeline_control", // name
        "fanout",           // type
        true,               // durable
        false, false, false, nil,
    )

    // ✅ Dedicated queue for Go — auto-deleted when Go disconnects
    q, err := ch.QueueDeclare(
        "pipeline_control.stream_parser", // unique name for Go
        true,                             // durable
        false, false, false, nil,
    )
    if err != nil {
        log.Fatalf("Queue declare error: %v", err)
    }

    // ✅ Bind this queue to the fanout exchange
    ch.QueueBind(q.Name, "", "pipeline_control", false, nil)

    msgs, err := ch.Consume(q.Name, "stream-parser", false, false, false, false, nil)
    if err != nil {
        log.Fatalf("Consume error: %v", err)
    }

    manager := NewPipelineManager(conn)
    log.Println("[Stream-Parser] Listening for pipeline commands...")

    for msg := range msgs {
        var cmd PipelineCommand
        if err := json.Unmarshal(msg.Body, &cmd); err != nil {
            log.Printf("[Stream-Parser] Bad command: %v", err)
            msg.Nack(false, false)
            continue
        }
        manager.Handle(cmd)
        msg.Ack(false)
    }
}


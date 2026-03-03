package main

import (
	"encoding/base64"
	"encoding/json"
	"log"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/bluenviron/gortsplib/v4"
	"github.com/bluenviron/gortsplib/v4/pkg/format"
	"github.com/bluenviron/gortsplib/v4/pkg/format/rtph264"
	gortspliburl "github.com/bluenviron/gortsplib/v4/pkg/url" // ✅ correct for v4.0.0
	"github.com/pion/rtp"
	amqp "github.com/rabbitmq/amqp091-go"
)

type Config struct {
    RTSPURL    string `json:"rtsp_url"`
    CameraID   int    `json:"camera_id"`     // ✅ add this
    PipelineID int    `json:"pipeline_id"`   // ✅ add this
    RabbitMQURL string `json:"rabbitmq_url"`
    QueueName  string `json:"queue_name"`
    ThrottleMs int    `json:"throttle_ms"`
}


func loadConfig(path string) Config {
	f, err := os.Open(path)
	if err != nil {
		log.Fatalf("Cannot open config file: %v", err)
	}
	defer f.Close()

	var cfg Config
	if err := json.NewDecoder(f).Decode(&cfg); err != nil {
		log.Fatalf("Cannot parse config file: %v", err)
	}
	if cfg.RTSPURL == ""    { log.Fatal("rtsp_url is required in config.json") }
	if cfg.CameraName == "" { cfg.CameraName = "default" }
	if cfg.QueueName == ""  { cfg.QueueName = "frames" }
	if cfg.ThrottleMS == 0  { cfg.ThrottleMS = 1000 }
	return cfg
}

func main() {
	cfg := loadConfig("config.json")
	throttle := time.Duration(cfg.ThrottleMS) * time.Millisecond

	// ---------------- RabbitMQ ----------------
	conn, err := amqp.Dial(cfg.RabbitMQURL)
	if err != nil {
		log.Fatalf("RabbitMQ connection error: %v", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("RabbitMQ channel error: %v", err)
	}
	defer ch.Close()

	q, err := ch.QueueDeclare(cfg.QueueName, true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Queue declare error: %v", err)
	}

	// ---------------- RTSP Client ----------------
	c := gortsplib.Client{}

	// ✅ gortspliburl.Parse exists in v4.0.0
	u, err := gortspliburl.Parse(cfg.RTSPURL)
	if err != nil {
		log.Fatalf("Invalid RTSP URL: %v", err)
	}

	if err := c.Start(u.Scheme, u.Host); err != nil {
		log.Fatalf("RTSP Start error: %v", err)
	}
	defer c.Close()

	desc, _, err := c.Describe(u)
	if err != nil {
		log.Fatalf("RTSP Describe error: %v", err)
	}

	var h264Format *format.H264
	media := desc.FindFormat(&h264Format)
	if media == nil {
		log.Fatal("No H264 format found in stream")
	}

	// ✅ Manual decoder init — safe for v4.0.0
	rtpDec := &rtph264.Decoder{}
	rtpDec.Init()

	_, err = c.Setup(desc.BaseURL, media, 0, 0)
	if err != nil {
		log.Fatalf("RTSP Setup error: %v", err)
	}

	var mu sync.Mutex
	lastPublish := time.Now().Add(-throttle)

	c.OnPacketRTP(media, h264Format, func(pkt *rtp.Packet) {
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

        // ✅ Build full Annex B: start_code+SPS + start_code+PPS + start_code+IDR
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
        ts := strconv.FormatInt(time.Now().Unix(), 10)

        // msg := amqp.Publishing{
        //     ContentType: "application/json",
        //     Body: []byte(`{"camera":"` + cfg.CameraName +
        //         `","frame":"` + b64 +
        //         `","type":"h264_annexb","timestamp":` + ts + `}`),
        // }
		msg := map[string]interface{}{
    "camera_id":   cfg.CameraID,    // ✅ matches DB Camera.id = 1
    "pipeline_id": cfg.PipelineID,  // ✅ matches DB Pipeline.id = 1
    "frame":       frameB64,
    "type":        "h264",
    "timestamp":   time.Now().Unix(),
}


        if err := ch.Publish("", q.Name, false, false, msg); err != nil {
            log.Printf("Publish error: %v", err)
        } else {
            log.Printf("Published H264 keyframe from [%s]", cfg.CameraName)
            mu.Lock()
            lastPublish = time.Now()
            mu.Unlock()
        }
    }
})


	_, err = c.Play(nil)
	if err != nil {
		log.Fatalf("RTSP Play error: %v", err)
	}

	log.Printf("Streaming [%s] → queue [%s]", cfg.RTSPURL, cfg.QueueName)

	if err := c.Wait(); err != nil {
		log.Println("RTSP Wait error:", err)
	}
}

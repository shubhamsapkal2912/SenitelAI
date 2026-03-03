package rtsp

import (
	"log"
	"time"

	"gocv.io/x/gocv"
)

type RTSPClient struct {
	URL         string
	FrameChan   chan gocv.Mat
	StopChan    chan bool
	ReconnectDelay time.Duration
}

func NewRTSPClient(url string) *RTSPClient {
	return &RTSPClient{
		URL:            url,
		FrameChan:      make(chan gocv.Mat, 10),
		StopChan:       make(chan bool),
		ReconnectDelay: 5 * time.Second,
	}
}

func (c *RTSPClient) Start() {
	go c.connectAndStream()
}

func (c *RTSPClient) connectAndStream() {
	for {
		log.Println("Connecting to RTSP:", c.URL)

		capture, err := gocv.VideoCaptureFile(c.URL)
		if err != nil {
			log.Println("RTSP connection failed:", err)
			time.Sleep(c.ReconnectDelay)
			continue
		}

		if !capture.IsOpened() {
			log.Println("Unable to open RTSP stream")
			time.Sleep(c.ReconnectDelay)
			continue
		}

		log.Println("RTSP connected successfully")

		img := gocv.NewMat()

		for {
			select {
			case <-c.StopChan:
				log.Println("Stopping RTSP client")
				capture.Close()
				img.Close()
				return
			default:
				if ok := capture.Read(&img); !ok {
					log.Println("Failed to read frame, reconnecting...")
					capture.Close()
					img.Close()
					time.Sleep(c.ReconnectDelay)
					break
				}

				if img.Empty() {
					continue
				}

				// Clone frame before sending (important)
				frameCopy := img.Clone()

				select {
				case c.FrameChan <- frameCopy:
				default:
					// Drop frame if channel full (avoid blocking)
					frameCopy.Close()
				}
			}
		}
	}
}

func (c *RTSPClient) Stop() {
	c.StopChan <- true
}
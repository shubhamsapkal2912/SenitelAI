package publisher

import (
	"encoding/json"
	"log"

	amqp "github.com/rabbitmq/amqp091-go"
)

type Publisher struct {
	conn    *amqp.Connection
	channel *amqp.Channel
	queue   amqp.Queue
}

type FrameMessage struct {
	CameraID   int    `json:"camera_id"`
	PipelineID int    `json:"pipeline_id"`
	Model      string `json:"model"`
	Image      string `json:"image"`
	Timestamp  string `json:"timestamp"`
}

func NewPublisher() *Publisher {
	conn, err := amqp.Dial("amqp://guest:guest@localhost:5672/")
	if err != nil {
		log.Fatal("RabbitMQ connection failed:", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		log.Fatal(err)
	}

	q, err := ch.QueueDeclare(
		"helmet_queue",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Fatal(err)
	}

	return &Publisher{
		conn:    conn,
		channel: ch,
		queue:   q,
	}
}

func (p *Publisher) Publish(msg FrameMessage) {
	body, _ := json.Marshal(msg)

	err := p.channel.Publish(
		"",
		p.queue.Name,
		false,
		false,
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
		},
	)

	if err != nil {
		log.Println("Publish error:", err)
	}
}
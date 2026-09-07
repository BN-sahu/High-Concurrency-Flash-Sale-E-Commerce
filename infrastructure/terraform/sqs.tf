# SQS Queues for production workloads
# In local dev, BullMQ (Redis) replaces these

resource "aws_sqs_queue" "payment_processing" {
  name                       = "flash-sale-payment-processing"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600  # 14 days
  receive_wait_time_seconds  = 20       # Long polling
  visibility_timeout_seconds = 300      # 5 minutes

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.payment_processing_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Environment = var.environment
    Service     = "flash-sale"
  }
}

resource "aws_sqs_queue" "payment_processing_dlq" {
  name                      = "flash-sale-payment-processing-dlq"
  message_retention_seconds = 1209600

  tags = {
    Environment = var.environment
    Service     = "flash-sale"
    Type        = "dlq"
  }
}

resource "aws_sqs_queue" "order_fulfillment" {
  name                       = "flash-sale-order-fulfillment"
  delay_seconds              = 0
  visibility_timeout_seconds = 300
  receive_wait_time_seconds  = 20

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.order_fulfillment_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Environment = var.environment
    Service     = "flash-sale"
  }
}

resource "aws_sqs_queue" "order_fulfillment_dlq" {
  name                      = "flash-sale-order-fulfillment-dlq"
  message_retention_seconds = 1209600

  tags = {
    Environment = var.environment
    Type        = "dlq"
  }
}

resource "aws_sqs_queue" "reservation_expiration" {
  name                       = "flash-sale-reservation-expiration"
  delay_seconds              = 0
  visibility_timeout_seconds = 600

  tags = {
    Environment = var.environment
    Service     = "flash-sale"
  }
}

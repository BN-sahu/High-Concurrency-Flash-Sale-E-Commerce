output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "sqs_payment_queue_url" {
  description = "SQS payment processing queue URL"
  value       = aws_sqs_queue.payment_processing.url
}

output "sqs_order_queue_url" {
  description = "SQS order fulfillment queue URL"
  value       = aws_sqs_queue.order_fulfillment.url
}

output "s3_media_bucket" {
  description = "S3 media bucket name"
  value       = aws_s3_bucket.media.id
}

output "cloudfront_domain" {
  description = "CloudFront CDN domain"
  value       = aws_cloudfront_distribution.cdn.domain_name
}

provider "aws" {
  region = "us-east-1"
}

# Example VPC
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "flash-sale-vpc"
  cidr = "10.0.0.0/16"
  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
}

# Example EKS Cluster for Backend & Worker
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "19.15.3"

  cluster_name    = "flash-sale-cluster"
  cluster_version = "1.27"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets

  eks_managed_node_groups = {
    general = {
      desired_size = 2
      min_size     = 1
      max_size     = 10
      instance_types = ["t3.large"]
    }
  }
}

# Redis for Locking (Redlock)
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "flash-sale-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis_subnet.name
}

resource "aws_elasticache_subnet_group" "redis_subnet" {
  name       = "redis-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

# RDS for PostgreSQL (Transactions)
resource "aws_db_instance" "postgres" {
  identifier           = "flash-sale-postgres"
  allocated_storage    = 20
  engine               = "postgres"
  engine_version       = "15.3"
  instance_class       = "db.t3.micro"
  db_name              = "flashsale"
  username             = "postgres"
  password             = "password123!" # Ideally in Secrets Manager
  skip_final_snapshot  = true
  db_subnet_group_name = aws_db_subnet_group.pg_subnet.name
}

resource "aws_db_subnet_group" "pg_subnet" {
  name       = "pg-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

# S3 for media storage
resource "aws_s3_bucket" "media" {
  bucket = "flash-sale-media-bucket"
}

# CloudFront CDN
resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id   = "S3Origin"
  }
  enabled = true
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3Origin"
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    viewer_protocol_policy = "redirect-to-https"
  }
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

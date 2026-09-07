# High-Concurrency Flash Sale E-Commerce Platform

A production-grade, distributed e-commerce platform built to handle extreme concurrency (1000+ simultaneous users) during flash sales with a strict **zero overselling** guarantee.

## Architecture

This platform utilizes a robust distributed architecture to ensure atomic transactions, high performance, and enterprise-grade reliability:

- **Frontend**: Next.js 14+ (App Router), React 18, Tailwind CSS, Glassmorphism UI
- **Backend API**: Node.js, Express, TypeScript (Modular Monolith)
- **Background Workers**: BullMQ for async processing (payments, fulfillments, expirations)
- **Primary Database**: PostgreSQL 15+ (Prisma ORM) for ACID transactional integrity
- **Catalog Database**: MongoDB for rich, read-heavy product catalog and fast queries
- **Cache & Locks**: Redis for distributed locking (Redlock) and rate limiting
- **Infrastructure**: Docker Compose (Local) / AWS EKS, RDS, ElastiCache, SQS (Production)

## Core Concurrency Strategy (Zero Overselling)

The platform guarantees that exactly one purchase succeeds when 1000+ users simultaneously attempt to buy the same single-inventory item. This is achieved via a dual-layer protection mechanism:

1.  **Redis Distributed Locking (Redlock)**: Provides fast, distributed mutual exclusion. When a user attempts to reserve an item, the API first acquires a Redis lock for that specific inventory item. This prevents concurrent requests from even hitting the database simultaneously.
2.  **PostgreSQL Atomic Transactions (`SELECT FOR UPDATE`)**: Inside the Redis lock, a database transaction is opened with `SERIALIZABLE` isolation. The inventory row is locked using `SELECT ... FOR UPDATE`, ensuring that even if the Redis lock fails, the database guarantees atomicity. The inventory is checked and decremented in this single, protected transaction.
3.  **Idempotency**: All critical endpoints (Reservation, Payment) require an `idempotencyKey`. The `idempotency.service.ts` ensures that if a client retries a request (e.g., due to network timeout), the exact same result is returned without re-processing the logic or decrementing inventory twice.
4.  **State Machine & TTL**: Reservations are held in a `RESERVED` state for 10 minutes. If payment is not completed, a background BullMQ worker atomically transitions the state to `EXPIRED` and increments the available inventory.

## Project Structure (pnpm Monorepo)

```
├── apps/
│   ├── api/           # Express API Gateway (Controllers, Middleware, Cache)
│   ├── worker/        # BullMQ Background Processors (Payments, Expiration, Webhooks)
│   └── web/           # Next.js Frontend (React, Tailwind, Sonner)
├── packages/
│   ├── auth/          # Argon2id Hashing, JWT, Session Management, RBAC
│   ├── database/      # Prisma Schema, MongoDB Models, Client Instantiation
│   ├── shared/        # Shared Types, Constants, Error Classes, Utilities
│   └── validation/    # Zod Schemas for Input Validation
├── infrastructure/    # Terraform and Kubernetes manifests
├── load-test/         # k6 Load Testing Scripts
└── docker-compose.yml # Local multi-container environment
```

## Getting Started (Local Development)

### Prerequisites
- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

### Setup

1.  **Install Dependencies**:
    ```bash
    pnpm install
    ```

2.  **Start Infrastructure (PostgreSQL, MongoDB, Redis)**:
    ```bash
    docker-compose up -d postgres mongo redis
    ```

3.  **Database Migration**:
    ```bash
    cd packages/database
    npx prisma db push
    ```

4.  **Start the Platform**:
    Start all applications (API, Worker, Web) in parallel:
    ```bash
    pnpm run dev
    ```

- Frontend: `http://localhost:3000`
- API Server: `http://localhost:3001`
- Swagger Docs: `http://localhost:3001/api/docs`

## Load Testing

The platform includes a `k6` script designed to simulate a flash-sale spike (1000 VUs).

```bash
k6 run load-test/flash-sale.js
```

## Production Deployment

The `infrastructure/` directory contains definitions for deploying to AWS EKS:
- `docker/`: Multi-stage Dockerfiles optimized for production size and caching.
- `terraform/`: AWS resources (RDS Postgres, ElastiCache Redis, SQS Queues).
- `kubernetes/`: Deployments, Services, HPA, PDB, and ALB Ingress definitions.

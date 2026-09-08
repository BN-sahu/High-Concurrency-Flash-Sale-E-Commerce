# ⚡ FlashDrop — High-Concurrency E-Commerce

A production-ready flash sale platform architected to handle massive traffic spikes and extreme concurrent checkout attempts without ever overselling inventory. 

**Live Demo:** [https://high-concurrency-flash-sale-ecommerce.netlify.app]
**API Backend:** [https://flash-sale-backend-y6h6.onrender.com]

## 🏗️ Architecture & Engineering

This platform solves the classic "Flash Sale" problem (Thundering Herd / Race Conditions) using a distributed, atomic architecture:

- **Distributed Locking:** Uses Redis (Upstash) and the Redlock algorithm to lock inventory instantly during the checkout flow.
- **Atomic Database Transactions:** Uses PostgreSQL (Neon) `FOR UPDATE` row-level locks with `SERIALIZABLE` isolation to guarantee absolute consistency when writing orders.
- **Asynchronous Processing:** Uses BullMQ workers to handle checkout expirations in the background, automatically releasing inventory if a user takes longer than 10 minutes to pay.
- **Idempotency:** Payment webhooks (Razorpay) are strictly idempotent. Users can refresh, retry, or lose connection without ever being charged twice.
- **Multi-Database Sync:** Hot path data (active sales) is stored in MongoDB Atlas for blazing-fast catalog reads, while transactional truth is strictly enforced in PostgreSQL.

## 💻 Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18 & TypeScript
- TailwindCSS (Glassmorphism UI)
- Lucide Icons

**Backend & Worker:**
- Node.js & Express
- Prisma ORM
- BullMQ (Message Queues)
- Razorpay Checkout API

**Infrastructure:**
- **Database:** Neon Serverless Postgres
- **Catalog:** MongoDB Atlas
- **Cache/Queue:** Upstash Redis
- **Hosting:** Render (Backend) / Netlify (Frontend)

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm 8+

### Installation
1. Clone the repository
   \`\`\`bash
   git clone https://github.com/BN-sahu/High-Concurrency-Flash-Sale-E-Commerce.git
   cd High-Concurrency-Flash-Sale-E-Commerce
   \`\`\`

2. Install dependencies
   \`\`\`bash
   pnpm install
   \`\`\`

3. Set up environment variables
   Refer to the `.env.example` files in `apps/api`, `apps/web`, and `apps/worker`. You will need connection strings for Postgres, Redis, and MongoDB.

4. Run database migrations & seed
   \`\`\`bash
   pnpm --filter @flash-sale/database run db:push
   npx tsx packages/database/seed.ts
   \`\`\`

5. Start the development servers
   \`\`\`bash
   pnpm dev
   \`\`\`
   *(This starts the Next.js frontend, Express API, and Background Worker simultaneously).*

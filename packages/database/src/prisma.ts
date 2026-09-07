import { PrismaClient } from '@prisma/client';

/**
 * PrismaService singleton.
 * Ensures a single PrismaClient instance across the application.
 * Connection pooling is configured via DATABASE_URL query parameters:
 *   ?connection_limit=100&pool_timeout=10
 */
class PrismaService extends PrismaClient {
  private static instance: PrismaService | null = null;

  private constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Health check for readiness probes.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get the singleton PrismaService instance.
 */
export function getPrisma(): PrismaService {
  return PrismaService.getInstance();
}

export { PrismaService };

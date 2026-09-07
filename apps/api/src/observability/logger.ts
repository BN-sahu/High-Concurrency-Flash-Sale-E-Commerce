import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Structured JSON logger using Pino.
 * In development: pretty-printed output.
 * In production: JSON format for Stdout → Datadog ingestion.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {
        // Production: JSON for Datadog
        formatters: {
          level(label: string) {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        // Development: pretty print
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
  // Common fields
  base: {
    service: 'flash-sale-api',
    version: process.env.npm_package_version || '1.0.0',
    env: process.env.NODE_ENV || 'development',
  },
});

/**
 * Create a child logger with additional context.
 */
export function createLogger(module: string) {
  return logger.child({ module });
}

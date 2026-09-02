import IORedis, { Redis } from 'ioredis';
import { env } from '../config/env';
import { logger } from '../shared/utils/logger';

let connection: Redis | null = null;

/**
 * Conexão Redis compartilhada por BullMQ. Quando `REDIS_ENABLED=false` o
 * sistema continua funcionando: as filas viram no-op e os jobs são ignorados.
 */
export function getRedisConnection(): Redis | null {
  if (!env.REDIS_ENABLED) return null;
  if (connection) return connection;

  connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  });

  connection.on('error', (err) => {
    logger.warn({ err: err.message }, 'Redis indisponível — filas em modo degradado');
  });

  return connection;
}

export const isQueueEnabled = (): boolean => env.REDIS_ENABLED;

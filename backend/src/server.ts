import http from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './shared/utils/logger';
import { prisma } from './shared/database/prisma';
import { initSocket } from './websocket/io';
import { closeQueues, registerRepeatableJobs } from './queues';

async function bootstrap(): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);

  initSocket(server);

  if (env.REDIS_ENABLED) {
    await registerRepeatableJobs().catch((error) => {
      logger.warn({ error }, 'Não foi possível registrar os jobs recorrentes');
    });
  }

  server.listen(env.PORT, () => {
    logger.info(
      `🚀 API disponível em http://localhost:${env.PORT}${env.API_PREFIX} (${env.NODE_ENV})`,
    );
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} recebido — encerrando com segurança...`);
    server.close();
    await closeQueues().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.error({ error }, 'Falha ao iniciar o servidor');
  process.exit(1);
});

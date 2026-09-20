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

  /*
   * `code` importa mais do que parece: a política de reinício do Railway é
   * ON_FAILURE. Sair com 0 depois de um erro fatal diria à plataforma que o
   * encerramento foi de propósito — e a API ficaria fora do ar até alguém
   * reparar. Sinal é saída limpa (0); erro não tratado é falha (1).
   */
  const shutdown = async (signal: string, code = 0) => {
    logger.info(`${signal} recebido — encerrando com segurança...`);

    // Rede de segurança: depois de uma exceção não capturada, `$disconnect()`
    // pode simplesmente não voltar. Sem isto o processo ficaria pendurado,
    // vivo para o healthcheck e sem atender ninguém. `unref()` para que o
    // timer não segure o processo quando a saída limpa acontecer.
    setTimeout(() => process.exit(code), 10_000).unref();

    server.close();
    await closeQueues().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(code);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  /*
   * Erro que escapou de todo mundo.
   *
   * O `errorHandler` do Express só alcança o que acontece dentro de uma
   * requisição. Uma promessa rejeitada num job, num listener do socket ou num
   * `setTimeout` passa longe dele — e o Node encerra o processo por conta
   * própria, sem escrever nada que preste. A hospedagem reinicia e o motivo
   * some junto.
   *
   * Registrar antes de sair é o que transforma "a API reiniciou sozinha de
   * madrugada" em algo que dá para investigar.
   */
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Promessa rejeitada sem tratamento — encerrando');
    void shutdown('unhandledRejection', 1);
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Exceção não capturada — encerrando');
    // Daqui para frente o estado do processo é incerto: seguir rodando pode
    // gravar dado pela metade. Sair e deixar a hospedagem subir um processo
    // limpo é mais seguro do que insistir.
    void shutdown('uncaughtException', 1);
  });
}

bootstrap().catch((error) => {
  logger.error({ error }, 'Falha ao iniciar o servidor');
  process.exit(1);
});

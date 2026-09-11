import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { routes } from './routes';
import { UPLOADS_DIR, UPLOADS_ROUTE } from './modules/uploads/uploads.routes';
import { errorHandler, notFoundHandler } from './shared/middlewares/errorHandler';
import { globalRateLimiter } from './shared/middlewares/rateLimit';
import { logger } from './shared/utils/logger';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);

  // As imagens enviadas são servidas de outra origem que a do painel, então o
  // bloqueio padrão de recursos entre origens impediria o <img> de carregar.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        // Sem Origin é chamada que não veio de navegador (app, curl, webhook):
        // essas se defendem pelo token, não pelo CORS.
        if (!origin) {
          callback(null, true);
          return;
        }
        if (env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        // O curinga vale só fora de produção. Liberar toda origem junto com
        // `credentials` deixaria qualquer site abrir chamadas autenticadas em
        // nome de quem estivesse logado.
        if (!env.isProduction && env.corsOrigins.includes('*')) {
          callback(null, true);
          return;
        }
        callback(new Error('Origem não permitida pelo CORS'));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  // Só JSON. Formulário urlencoded não é usado por nenhuma rota, e o parser
  // arrasta o `qs` junto — superfície sem contrapartida.
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url?.includes('/health') ?? false },
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'debug';
      },
    }),
  );

  app.use(globalRateLimiter);

  // Arquivos enviados. `nosniff` (do helmet) impede que o navegador reinterprete
  // o tipo; nada aqui é executável.
  app.use(
    UPLOADS_ROUTE,
    express.static(UPLOADS_DIR, { maxAge: '30d', index: false, dotfiles: 'deny' }),
  );

  app.use(env.API_PREFIX, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

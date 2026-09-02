import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { routes } from './routes';
import { errorHandler, notFoundHandler } from './shared/middlewares/errorHandler';
import { globalRateLimiter } from './shared/middlewares/rateLimit';
import { logger } from './shared/utils/logger';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) {
          callback(null, true);
          return;
        }
        callback(new Error('Origem não permitida pelo CORS'));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
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

  app.use(env.API_PREFIX, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

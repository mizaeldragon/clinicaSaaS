import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente em instantes.' },
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
    },
  },
});

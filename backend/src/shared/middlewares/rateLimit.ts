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

/**
 * Endereços da própria máquina. Em desenvolvimento o limitador de autenticação
 * os ignora: a suíte end-to-end erra senha e token de propósito dezenas de
 * vezes seguidas, e travaria a si mesma. Em produção a regra vale para todo
 * mundo — a checagem de ambiente vem primeiro justamente para que ninguém
 * escape forjando o IP de origem.
 */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // Só tentativa falha conta: força bruta se mede em erro, e um salão inteiro
  // entrando de manhã pela mesma conexão não pode trancar a porta.
  skipSuccessfulRequests: true,
  skip: (req) => !env.isProduction && LOOPBACK.has(req.ip ?? ''),
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
    },
  },
});

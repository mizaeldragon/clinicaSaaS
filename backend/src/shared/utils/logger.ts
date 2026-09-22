import pino from 'pino';
import { env } from '../../config/env';

/**
 * Campos que nunca podem ser escritos no log.
 *
 * O log de produção vai para o painel da hospedagem, é lido por quem tem acesso
 * ao projeto e costuma ser guardado por semanas. Um `Authorization` gravado ali
 * é uma sessão viva: quem lê o arquivo entra como a pessoa, sem senha. O mesmo
 * vale para a chave do gateway e para o token do webhook, que autorizam
 * cobrança em nome da empresa.
 *
 * `remove: true` apaga a chave em vez de escrever `[Redacted]` — não interessa
 * nem registrar que o campo existia.
 */
const SECRET_PATHS = [
  // Cabeçalhos de requisição, nas duas formas em que o pino-http os serializa.
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["asaas-access-token"]',
  'headers.authorization',
  'headers.cookie',
  'headers["asaas-access-token"]',
  'res.headers["set-cookie"]',

  // Corpo e objetos soltos que algum log manual possa carregar.
  'password',
  'newPassword',
  'currentPassword',
  'passwordHash',
  'token',
  'tokenHash',
  'accessToken',
  'refreshToken',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.passwordHash',
  '*.token',
  '*.tokenHash',
  '*.accessToken',
  '*.refreshToken',

  // Configuração.
  'ASAAS_API_KEY',
  'ASAAS_WEBHOOK_TOKEN',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'SMTP_PASSWORD',
  'DATABASE_URL',
  'SUPERADMIN_PASSWORD',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: SECRET_PATHS, remove: true },
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
});

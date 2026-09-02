import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3333),
  API_PREFIX: z.string().default('/api/v1'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa ter ao menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(16, 'REFRESH_TOKEN_SECRET precisa ter ao menos 16 caracteres'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(30),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(10),

  LOG_LEVEL: z.string().default('info'),

  DEFAULT_TRIAL_DAYS: z.coerce.number().default(14),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`\n❌ Variáveis de ambiente inválidas:\n${issues}\n`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
};

export type Env = typeof env;

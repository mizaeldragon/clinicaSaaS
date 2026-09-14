import 'dotenv/config';
import { z } from 'zod';

/**
 * Fuso do sistema, fixado antes de qualquer data ser calculada.
 *
 * A agenda trabalha com horário de parede — "das 09:00 às 19:00", "turno da
 * manhã 08:00–12:00" — e todo o motor de conflitos compara minutos do dia. Num
 * servidor em UTC (o padrão em produção) esses horários sairiam três horas
 * deslocados. Como este módulo é importado antes de tudo, basta definir aqui.
 */
const TIMEZONE = process.env.TIMEZONE ?? 'America/Sao_Paulo';
process.env.TZ = TIMEZONE;

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
  /**
   * Teto por IP. Um salão inteiro sai por uma conexão só, e cada tela do painel
   * dispara várias chamadas — 300/min estourava com cinco pessoas trabalhando.
   * O limite que protege de força bruta é o do login, logo abaixo.
   */
  RATE_LIMIT_MAX: z.coerce.number().default(1000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(10),
  /** Marcar, remarcar e cancelar pela página pública, por IP a cada 10 min. */
  PUBLIC_WRITE_RATE_LIMIT_MAX: z.coerce.number().default(30),

  LOG_LEVEL: z.string().default('info'),

  DEFAULT_TRIAL_DAYS: z.coerce.number().default(14),

  TIMEZONE: z.string().default('America/Sao_Paulo'),

  /** Base pública da API — usada para montar o endereço das imagens enviadas. */
  PUBLIC_URL: z.string().default('http://localhost:3333'),

  /** Base do painel. Entra nos e-mails: link de redefinir senha, de pagar. */
  APP_URL: z.string().default('http://localhost:5173'),

  /**
   * Chave da cifra dos segredos do segundo fator. Sem ela derivamos do
   * REFRESH_TOKEN_SECRET, e aí trocar aquele inutiliza os 2FA de todo mundo —
   * por isso em produção vale definir a própria.
   */
  ENCRYPTION_KEY: z.string().min(32).optional(),

  // -------------------------------------------------------------- cobrança
  /**
   * Asaas. Sem chave, a cobrança fica desligada: o painel diz que o pagamento
   * não está configurado em vez de estourar, e o trial nunca bloqueia ninguém.
   */
  ASAAS_API_KEY: z.string().optional(),
  ASAAS_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  /**
   * Segredo combinado com o Asaas no cadastro do webhook. Ele o devolve no
   * header `asaas-access-token`; sem conferir isso, qualquer um poderia
   * postar "pagamento confirmado" no nosso endpoint.
   */
  ASAAS_WEBHOOK_TOKEN: z.string().optional(),
  /**
   * Dias de tolerância depois do vencimento antes de trancar o painel. O boleto
   * compensa em dias úteis; trancar no dia seguinte puniria quem já pagou.
   */
  BILLING_GRACE_DAYS: z.coerce.number().default(5),

  // ------------------------------------------------------------------ e-mail
  /** Sem SMTP_HOST o e-mail vira log — desenvolvimento não precisa de caixa. */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('CliniStudio <nao-responda@clinistudio.app>'),
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
  /** Cobrança só existe se houver chave do Asaas. */
  billingEnabled: Boolean(parsed.data.ASAAS_API_KEY),
  /** Sem SMTP o e-mail é registrado no log em vez de enviado. */
  mailEnabled: Boolean(parsed.data.SMTP_HOST),
};

export type Env = typeof env;

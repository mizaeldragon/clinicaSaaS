import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { billingService } from './billing.service';
import { asyncHandler } from '../../shared/utils/http';
import { logger } from '../../shared/utils/logger';

export const webhookRoutes = Router();

/**
 * Teto para quem bate nesta porta.
 *
 * O Asaas manda um punhado de eventos por minuto; quem manda centenas está
 * tentando adivinhar o token ou derrubar a fila. Generoso o bastante para não
 * atrapalhar uma reentrega em lote depois de uma queda.
 */
const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'too many requests' } },
});

/**
 * Compara o token sem vazar onde ele começou a diferir.
 *
 * `!==` para na primeira letra errada, e a diferença de tempo entre "errou no
 * primeiro caractere" e "errou no último" é medível pela rede — dá para
 * descobrir o token letra a letra. `timingSafeEqual` leva sempre o mesmo tempo.
 */
function tokenConfere(recebido: string | undefined, esperado: string): boolean {
  if (!recebido) return false;

  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  // Tamanhos diferentes já bastam para recusar, e `timingSafeEqual` exige
  // buffers iguais — comparar contra ele mesmo mantém o custo constante.
  if (a.length !== b.length) {
    crypto.timingSafeEqual(b, b);
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

/**
 * Webhook do Asaas — a única porta por onde "foi pago" entra no sistema.
 *
 * Sem autenticação de usuário (quem chama é o gateway), então a defesa é o
 * token combinado no cadastro do webhook e devolvido no header
 * `asaas-access-token`. Sem conferir isso, qualquer um na internet poderia
 * postar "pagamento confirmado" e liberar o painel de graça.
 *
 * Responder 200 para o que não reconhecemos é deliberado: o Asaas repete o que
 * falha, e um evento de outra conta ficaria em reentrega eterna.
 */
webhookRoutes.post(
  '/asaas',
  webhookLimiter,
  asyncHandler(async (req, res) => {
    if (env.ASAAS_WEBHOOK_TOKEN) {
      if (!tokenConfere(req.header('asaas-access-token'), env.ASAAS_WEBHOOK_TOKEN)) {
        logger.warn({ ip: req.ip }, 'Webhook do Asaas com token inválido');
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
    } else if (env.isProduction) {
      // Em produção, webhook sem token é porta aberta. Recusar é mais seguro
      // do que processar: o Asaas reenvia depois que a configuração for feita.
      logger.error('ASAAS_WEBHOOK_TOKEN não configurado — webhook recusado');
      res.status(503).json({ error: 'webhook not configured' });
      return;
    }

    const result = await billingService.handleWebhook(req.body ?? {});
    res.json(result);
  }),
);

import { Router } from 'express';
import { env } from '../../config/env';
import { billingService } from './billing.service';
import { asyncHandler } from '../../shared/utils/http';
import { logger } from '../../shared/utils/logger';

export const webhookRoutes = Router();

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
  asyncHandler(async (req, res) => {
    if (env.ASAAS_WEBHOOK_TOKEN) {
      const received = req.header('asaas-access-token');
      if (received !== env.ASAAS_WEBHOOK_TOKEN) {
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

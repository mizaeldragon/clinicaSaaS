import { Router } from 'express';
import { subscriptionsService } from './subscriptions.service';
import { asyncHandler, serialize } from '../../shared/utils/http';

/**
 * Somente leitura: qual é o plano, o que ele permite e quanto da cota já foi
 * usada.
 *
 * Trocar de plano e cancelar moram em `/billing`, porque as duas coisas
 * precisam falar com o gateway. Já existiram aqui, e era um furo: `change-plan`
 * gravava `ACTIVE` com mais um mês de validade sem cobrar nada, então qualquer
 * empresa com o teste vencido se liberava sozinha, de graça e quantas vezes
 * quisesse. `cancel` tinha o defeito espelhado — encerrava no painel e deixava
 * a cobrança correndo no Asaas.
 */
export const subscriptionsRoutes = Router();

subscriptionsRoutes.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    res.json(serialize(await subscriptionsService.planMatrix()));
  }),
);

subscriptionsRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(serialize(await subscriptionsService.current(req.companyId as string)));
  }),
);

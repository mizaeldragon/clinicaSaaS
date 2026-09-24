import { Router } from 'express';
import { z } from 'zod';
import { billingService } from './billing.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';

export const billingRoutes = Router();

/**
 * Cobrança da mensalidade.
 *
 * Fica fora do `requireActiveSubscription` de propósito: é a única parte do
 * painel que uma empresa com trial vencido precisa alcançar.
 */

billingRoutes.get(
  '/',
  requirePermission(PERMISSIONS.settingsManage),
  asyncHandler(async (req, res) => {
    res.json(serialize(await billingService.overview(req.companyId as string)));
  }),
);

billingRoutes.post(
  '/subscribe',
  requirePermission(PERMISSIONS.settingsManage),
  validate({
    body: z.object({
      planSlug: z.string().min(1).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await billingService.subscribe(req.companyId as string, req.body);
    await recordAudit({
      action: 'billing.subscribed',
      entity: 'Subscription',
      after: req.body,
      ip: req.ip,
    });
    res.json(serialize(result));
  }),
);

billingRoutes.post(
  '/sync',
  requirePermission(PERMISSIONS.settingsManage),
  asyncHandler(async (req, res) => {
    await billingService.syncPayments(req.companyId as string);
    res.json(serialize(await billingService.overview(req.companyId as string)));
  }),
);

billingRoutes.post(
  '/cancel',
  requirePermission(PERMISSIONS.settingsManage),
  asyncHandler(async (req, res) => {
    const result = await billingService.cancel(req.companyId as string);
    await recordAudit({ action: 'billing.canceled', entity: 'Subscription', ip: req.ip });
    res.json(serialize(result));
  }),
);

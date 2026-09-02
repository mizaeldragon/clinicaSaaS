import { Router } from 'express';
import { z } from 'zod';
import { subscriptionsService } from './subscriptions.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';

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

subscriptionsRoutes.post(
  '/change-plan',
  requirePermission(PERMISSIONS.settingsManage),
  validate({ body: z.object({ planSlug: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const result = await subscriptionsService.changePlan(
      req.companyId as string,
      req.body.planSlug,
    );
    await recordAudit({
      action: 'subscription.plan_changed',
      entity: 'Subscription',
      after: req.body,
      ip: req.ip,
    });
    res.json(serialize(result));
  }),
);

subscriptionsRoutes.post(
  '/cancel',
  requirePermission(PERMISSIONS.settingsManage),
  asyncHandler(async (req, res) => {
    const result = await subscriptionsService.cancel(req.companyId as string);
    await recordAudit({ action: 'subscription.canceled', entity: 'Subscription', ip: req.ip });
    res.json(serialize(result));
  }),
);

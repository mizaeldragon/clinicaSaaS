import { Router } from 'express';
import { z } from 'zod';
import { CommissionStatus } from '@prisma/client';
import { commissionsService } from './commissions.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { requireModule } from '../../shared/middlewares/moduleGuard';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { referenceMonth } from '../../shared/utils/datetime';
import { recordAudit } from '../../shared/services/audit.service';

export const commissionsRoutes = Router();

commissionsRoutes.use(requireModule('commissions'), requirePermission(PERMISSIONS.commissionsView));

const listSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(200).optional(),
  professionalId: z.string().uuid().optional(),
  status: z.nativeEnum(CommissionStatus).optional(),
  referenceMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

commissionsRoutes.get(
  '/',
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => {
    // Profissional só enxerga as próprias comissões.
    const query = { ...(req.query as Record<string, unknown>) };
    if (req.user?.role === 'PROFESSIONAL') query.professionalId = req.user.professionalId;
    res.json(serialize(await commissionsService.list(query as never)));
  }),
);

commissionsRoutes.get(
  '/summary',
  validate({ query: z.object({ referenceMonth: z.string().regex(/^\d{4}-\d{2}$/).optional() }) }),
  asyncHandler(async (req, res) => {
    const month = (req.query.referenceMonth as string) ?? referenceMonth(new Date());
    res.json(serialize(await commissionsService.summary(month)));
  }),
);

commissionsRoutes.post(
  '/pay',
  requirePermission(PERMISSIONS.commissionsManage),
  validate({ body: z.object({ ids: z.array(z.string().uuid()).min(1) }) }),
  asyncHandler(async (req, res) => {
    const result = await commissionsService.pay(req.body.ids);
    await recordAudit({ action: 'commission.paid', entity: 'Commission', after: req.body, ip: req.ip });
    res.json(result);
  }),
);

commissionsRoutes.post(
  '/pay-month',
  requirePermission(PERMISSIONS.commissionsManage),
  validate({
    body: z.object({
      professionalId: z.string().uuid(),
      referenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await commissionsService.payMonth(
      req.body.professionalId,
      req.body.referenceMonth,
    );
    await recordAudit({ action: 'commission.paid_month', entity: 'Commission', after: req.body, ip: req.ip });
    res.json(result);
  }),
);

import { Router } from 'express';
import { z } from 'zod';
import { reportsService } from './reports.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { requireModule } from '../../shared/middlewares/moduleGuard';
import { asyncHandler, serialize } from '../../shared/utils/http';

export const reportsRoutes = Router();

reportsRoutes.use(requireModule('reports'), requirePermission(PERMISSIONS.reportsView));

const periodSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

function period(req: { query: unknown }) {
  const q = req.query as { from?: Date; to?: Date };
  return { from: q.from, to: q.to };
}

reportsRoutes.get(
  '/appointments',
  validate({ query: periodSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await reportsService.appointments(period(req))));
  }),
);

reportsRoutes.get(
  '/professionals',
  validate({ query: periodSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await reportsService.professionals(period(req))));
  }),
);

reportsRoutes.get(
  '/services',
  validate({ query: periodSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await reportsService.services(period(req))));
  }),
);

reportsRoutes.get(
  '/customers',
  validate({ query: periodSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await reportsService.customers(period(req))));
  }),
);

reportsRoutes.get(
  '/financial-evolution',
  asyncHandler(async (_req, res) => {
    res.json(serialize(await reportsService.financialEvolution()));
  }),
);

import { Router } from 'express';
import { shiftsService } from './shifts.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { requireModule } from '../../shared/middlewares/moduleGuard';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';
import {
  createShiftSchema,
  idParamSchema,
  setShiftPricesSchema,
  updateShiftSchema,
} from './shifts.schema';

export const shiftsRoutes = Router();

shiftsRoutes.use(requireModule('rentals'), requirePermission(PERMISSIONS.rentalsView));

shiftsRoutes.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(serialize(await shiftsService.list()));
  }),
);

shiftsRoutes.get(
  '/prices',
  asyncHandler(async (_req, res) => {
    res.json(serialize(await shiftsService.priceTable()));
  }),
);

shiftsRoutes.post(
  '/',
  requirePermission(PERMISSIONS.rentalsManage),
  validate({ body: createShiftSchema }),
  asyncHandler(async (req, res) => {
    const shift = await shiftsService.create(req.companyId as string, req.body);
    await recordAudit({ action: 'shift.created', entity: 'Shift', entityId: shift.id, after: req.body, ip: req.ip });
    res.status(201).json(serialize(shift));
  }),
);

/** Atalho do onboarding: cria Manhã, Tarde e Noite de uma vez. */
shiftsRoutes.post(
  '/defaults',
  requirePermission(PERMISSIONS.rentalsManage),
  asyncHandler(async (req, res) => {
    res.status(201).json(serialize(await shiftsService.seedDefaults(req.companyId as string)));
  }),
);

shiftsRoutes.put(
  '/prices',
  requirePermission(PERMISSIONS.rentalsManage),
  validate({ body: setShiftPricesSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await shiftsService.setPrices(req.companyId as string, req.body)));
  }),
);

shiftsRoutes.patch(
  '/:id',
  requirePermission(PERMISSIONS.rentalsManage),
  validate({ params: idParamSchema, body: updateShiftSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await shiftsService.update(req.params.id, req.body)));
  }),
);

shiftsRoutes.delete(
  '/:id',
  requirePermission(PERMISSIONS.rentalsManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await shiftsService.remove(req.params.id);
    res.status(204).send();
  }),
);

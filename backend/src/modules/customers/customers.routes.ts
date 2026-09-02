import { Router } from 'express';
import { z } from 'zod';
import { customersService } from './customers.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { requireModule } from '../../shared/middlewares/moduleGuard';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';
import {
  createCustomerSchema,
  idParamSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from './customers.schema';

export const customersRoutes = Router();

customersRoutes.use(requireModule('customers'), requirePermission(PERMISSIONS.customersView));

customersRoutes.get(
  '/',
  validate({ query: listCustomersSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await customersService.list(req.query as never)));
  }),
);

customersRoutes.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    res.json(await customersService.quickStats());
  }),
);

customersRoutes.get(
  '/birthdays',
  validate({ query: z.object({ month: z.coerce.number().int().min(1).max(12).optional() }) }),
  asyncHandler(async (req, res) => {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    res.json(serialize(await customersService.birthdays(month)));
  }),
);

customersRoutes.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await customersService.get(req.params.id)));
  }),
);

customersRoutes.get(
  '/:id/profile',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await customersService.profile(req.params.id)));
  }),
);

customersRoutes.post(
  '/',
  requirePermission(PERMISSIONS.customersManage),
  validate({ body: createCustomerSchema }),
  asyncHandler(async (req, res) => {
    const customer = await customersService.create(req.body);
    await recordAudit({ action: 'customer.created', entity: 'Customer', entityId: customer.id, after: req.body, ip: req.ip });
    res.status(201).json(serialize(customer));
  }),
);

customersRoutes.patch(
  '/:id',
  requirePermission(PERMISSIONS.customersManage),
  validate({ params: idParamSchema, body: updateCustomerSchema }),
  asyncHandler(async (req, res) => {
    const customer = await customersService.update(req.params.id, req.body);
    await recordAudit({ action: 'customer.updated', entity: 'Customer', entityId: customer.id, after: req.body, ip: req.ip });
    res.json(serialize(customer));
  }),
);

customersRoutes.delete(
  '/:id',
  requirePermission(PERMISSIONS.customersManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await customersService.remove(req.params.id);
    await recordAudit({ action: 'customer.removed', entity: 'Customer', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  }),
);

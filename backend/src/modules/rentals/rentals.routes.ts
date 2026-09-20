import { Router } from 'express';
import { rentalsService } from './rentals.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { requireModule } from '../../shared/middlewares/moduleGuard';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';
import {
  createRenterSchema,
  createRentalSchema,
  idParamSchema,
  listPaymentsSchema,
  listRentalsSchema,
  payRentalSchema,
  updateRentalSchema,
} from './rentals.schema';

export const rentalsRoutes = Router();

rentalsRoutes.use(requireModule('rentals'), requirePermission(PERMISSIONS.rentalsView));

rentalsRoutes.get(
  '/',
  validate({ query: listRentalsSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await rentalsService.list(req.query as never)));
  }),
);

/**
 * Cadastra a locatária e o acesso dela de uma vez.
 *
 * Exige as duas permissões, e não uma: criar login é assunto de quem administra
 * a conta, não de quem só cuida dos aluguéis.
 */
rentalsRoutes.post(
  '/renters',
  requirePermission(PERMISSIONS.rentalsManage),
  requirePermission(PERMISSIONS.usersManage),
  validate({ body: createRenterSchema }),
  asyncHandler(async (req, res) => {
    const criada = await rentalsService.createRenter(req.companyId as string, req.body);
    await recordAudit({
      action: 'rental.renter.created',
      entity: 'Professional',
      entityId: criada.professional.id,
      after: { name: criada.professional.name, email: req.body.email },
      ip: req.ip,
    });
    res.status(201).json(serialize(criada));
  }),
);

rentalsRoutes.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    res.json(serialize(await rentalsService.stats()));
  }),
);

rentalsRoutes.get(
  '/payments',
  validate({ query: listPaymentsSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await rentalsService.listPayments(req.query as never)));
  }),
);

rentalsRoutes.post(
  '/payments/:id/pay',
  requirePermission(PERMISSIONS.rentalsManage),
  validate({ params: idParamSchema, body: payRentalSchema }),
  asyncHandler(async (req, res) => {
    const payment = await rentalsService.pay(req.companyId as string, req.params.id, req.body);
    await recordAudit({
      action: 'rental.payment.paid',
      entity: 'RentalPayment',
      entityId: payment.id,
      after: req.body,
      ip: req.ip,
    });
    res.json(serialize(payment));
  }),
);

rentalsRoutes.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await rentalsService.get(req.params.id)));
  }),
);

rentalsRoutes.post(
  '/',
  requirePermission(PERMISSIONS.rentalsManage),
  validate({ body: createRentalSchema }),
  asyncHandler(async (req, res) => {
    const rental = await rentalsService.create(req.companyId as string, req.body);
    await recordAudit({
      action: 'rental.created',
      entity: 'Rental',
      entityId: rental.id,
      after: req.body,
      ip: req.ip,
    });
    res.status(201).json(serialize(rental));
  }),
);

rentalsRoutes.post(
  '/:id/generate-charges',
  requirePermission(PERMISSIONS.rentalsManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const created = await rentalsService.generateChargesForRental(
      req.companyId as string,
      req.params.id,
    );
    res.json({ created: created.length });
  }),
);

rentalsRoutes.patch(
  '/:id',
  requirePermission(PERMISSIONS.rentalsManage),
  validate({ params: idParamSchema, body: updateRentalSchema }),
  asyncHandler(async (req, res) => {
    const rental = await rentalsService.update(req.companyId as string, req.params.id, req.body);
    await recordAudit({
      action: 'rental.updated',
      entity: 'Rental',
      entityId: rental.id,
      after: req.body,
      ip: req.ip,
    });
    res.json(serialize(rental));
  }),
);

rentalsRoutes.delete(
  '/:id',
  requirePermission(PERMISSIONS.rentalsManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await rentalsService.remove(req.params.id);
    await recordAudit({ action: 'rental.removed', entity: 'Rental', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  }),
);

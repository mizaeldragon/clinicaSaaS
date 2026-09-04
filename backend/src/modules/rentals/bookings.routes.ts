import { Router } from 'express';
import { bookingsService } from './bookings.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { requireModule } from '../../shared/middlewares/moduleGuard';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';
import { ForbiddenError } from '../../shared/errors/AppError';
import {
  availabilityQuerySchema,
  createBookingSchema,
  idParamSchema,
  listBookingsSchema,
  payBookingSchema,
  updateBookingSchema,
} from './bookings.schema';

export const bookingsRoutes = Router();

bookingsRoutes.use(requireModule('rentals'));

/** Visão geral do espaço é da gestão; a locatária só acessa os próprios turnos. */
const canSeeAll = requirePermission(PERMISSIONS.rentalsView);
const canSeeOwn = requirePermission(PERMISSIONS.rentalsView, PERMISSIONS.rentalsViewOwn);

/** Mapa de ocupação do dia — quem está em qual espaço, em qual turno. */
bookingsRoutes.get(
  '/day-map',
  canSeeAll,
  validate({ query: availabilityQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as { date: Date; resourceId?: string };
    res.json(serialize(await bookingsService.dayMap(query.date, query.resourceId)));
  }),
);

bookingsRoutes.get(
  '/stats',
  canSeeAll,
  asyncHandler(async (_req, res) => {
    res.json(serialize(await bookingsService.stats()));
  }),
);

bookingsRoutes.get(
  '/',
  canSeeOwn,
  validate({ query: listBookingsSchema }),
  asyncHandler(async (req, res) => {
    const query = { ...(req.query as Record<string, unknown>) };

    // A locatária só enxerga os próprios turnos.
    if (req.user?.role === 'PROFESSIONAL') {
      query.professionalId = req.user.professionalId ?? '00000000-0000-0000-0000-000000000000';
    }

    res.json(serialize(await bookingsService.list(query as never)));
  }),
);

bookingsRoutes.get(
  '/:id',
  canSeeOwn,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const booking = await bookingsService.get(req.params.id);

    if (req.user?.role === 'PROFESSIONAL' && booking.professionalId !== req.user.professionalId) {
      throw new ForbiddenError('Você só pode ver as próprias reservas');
    }

    res.json(serialize(booking));
  }),
);

bookingsRoutes.post(
  '/',
  requirePermission(PERMISSIONS.rentalsManage),
  validate({ body: createBookingSchema }),
  asyncHandler(async (req, res) => {
    const result = await bookingsService.create(req.companyId as string, req.body);
    await recordAudit({
      action: 'rental.booking.created',
      entity: 'RentalBooking',
      entityId: result.created[0]?.id,
      after: req.body,
      ip: req.ip,
    });
    res.status(201).json(serialize(result));
  }),
);

bookingsRoutes.post(
  '/:id/pay',
  requirePermission(PERMISSIONS.rentalsManage),
  validate({ params: idParamSchema, body: payBookingSchema }),
  asyncHandler(async (req, res) => {
    const booking = await bookingsService.pay(req.companyId as string, req.params.id, req.body);
    await recordAudit({
      action: 'rental.booking.paid',
      entity: 'RentalBooking',
      entityId: booking.id,
      after: req.body,
      ip: req.ip,
    });
    res.json(serialize(booking));
  }),
);

bookingsRoutes.patch(
  '/:id',
  requirePermission(PERMISSIONS.rentalsManage),
  validate({ params: idParamSchema, body: updateBookingSchema }),
  asyncHandler(async (req, res) => {
    res.json(
      serialize(await bookingsService.update(req.companyId as string, req.params.id, req.body)),
    );
  }),
);

bookingsRoutes.delete(
  '/:id',
  requirePermission(PERMISSIONS.rentalsManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await bookingsService.remove(req.params.id);
    await recordAudit({
      action: 'rental.booking.removed',
      entity: 'RentalBooking',
      entityId: req.params.id,
      ip: req.ip,
    });
    res.status(204).send();
  }),
);

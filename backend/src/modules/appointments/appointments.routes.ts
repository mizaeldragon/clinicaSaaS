import { Request, Router } from 'express';
import { appointmentsService } from './appointments.service';
import { getAvailableSlots } from './scheduling.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { requireModule } from '../../shared/middlewares/moduleGuard';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';
import { z } from 'zod';
import {
  checkAvailabilitySchema,
  createAppointmentSchema,
  idParamSchema,
  listAppointmentsSchema,
  updateAppointmentSchema,
  updateStatusSchema,
} from './appointments.schema';

export const appointmentsRoutes = Router();

appointmentsRoutes.use(
  requireModule('appointments'),
  requirePermission(PERMISSIONS.appointmentsView),
);

/**
 * Profissional sem permissão de visão global enxerga apenas a própria agenda.
 * Aplicado no servidor — o filtro do frontend é apenas conveniência.
 */
function scopeToProfessional(req: Request) {
  const query = { ...(req.query as Record<string, unknown>) };
  if (req.user?.role === 'PROFESSIONAL' && !req.user.permissions.includes(PERMISSIONS.appointmentsViewAll)) {
    query.professionalId = req.user.professionalId ?? '00000000-0000-0000-0000-000000000000';
  }
  return query;
}

appointmentsRoutes.get(
  '/',
  validate({ query: listAppointmentsSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await appointmentsService.list(scopeToProfessional(req) as never)));
  }),
);

appointmentsRoutes.get(
  '/calendar',
  validate({ query: listAppointmentsSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await appointmentsService.calendar(scopeToProfessional(req) as never)));
  }),
);

appointmentsRoutes.get(
  '/today',
  asyncHandler(async (_req, res) => {
    res.json(serialize(await appointmentsService.todaySummary()));
  }),
);

appointmentsRoutes.get(
  '/availability',
  validate({
    query: z.object({
      professionalId: z.string().uuid(),
      date: z.coerce.date(),
      durationMinutes: z.coerce.number().int().min(5).max(1440).default(60),
      slotMinutes: z.coerce.number().int().min(5).max(120).default(15),
      roomId: z.string().uuid().optional(),
      resourceId: z.string().uuid().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as {
      professionalId: string;
      date: Date;
      durationMinutes: number;
      slotMinutes: number;
      roomId?: string;
      resourceId?: string;
    };
    res.json(serialize(await getAvailableSlots(q)));
  }),
);

appointmentsRoutes.post(
  '/check-availability',
  validate({ body: checkAvailabilitySchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await appointmentsService.checkAvailability(req.body)));
  }),
);

appointmentsRoutes.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await appointmentsService.get(req.params.id)));
  }),
);

appointmentsRoutes.post(
  '/',
  requirePermission(PERMISSIONS.appointmentsManage),
  validate({ body: createAppointmentSchema }),
  asyncHandler(async (req, res) => {
    const appointment = await appointmentsService.create(
      req.companyId as string,
      req.body,
      req.user?.id,
    );
    await recordAudit({
      action: 'appointment.created',
      entity: 'Appointment',
      entityId: appointment.id,
      after: { startsAt: appointment.startsAt, customerId: appointment.customerId },
      ip: req.ip,
    });
    res.status(201).json(serialize(appointment));
  }),
);

appointmentsRoutes.patch(
  '/:id',
  requirePermission(PERMISSIONS.appointmentsManage),
  validate({ params: idParamSchema, body: updateAppointmentSchema }),
  asyncHandler(async (req, res) => {
    const appointment = await appointmentsService.update(
      req.companyId as string,
      req.params.id,
      req.body,
    );
    await recordAudit({
      action: 'appointment.updated',
      entity: 'Appointment',
      entityId: appointment.id,
      after: req.body,
      ip: req.ip,
    });
    res.json(serialize(appointment));
  }),
);

appointmentsRoutes.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.appointmentsManage),
  validate({ params: idParamSchema, body: updateStatusSchema }),
  asyncHandler(async (req, res) => {
    const appointment = await appointmentsService.updateStatus(
      req.companyId as string,
      req.params.id,
      req.body,
      req.user?.id,
    );
    await recordAudit({
      action: `appointment.status.${req.body.status.toLowerCase()}`,
      entity: 'Appointment',
      entityId: appointment.id,
      after: req.body,
      ip: req.ip,
    });
    res.json(serialize(appointment));
  }),
);

appointmentsRoutes.delete(
  '/:id',
  requirePermission(PERMISSIONS.appointmentsManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await appointmentsService.remove(req.companyId as string, req.params.id);
    await recordAudit({
      action: 'appointment.removed',
      entity: 'Appointment',
      entityId: req.params.id,
      ip: req.ip,
    });
    res.status(204).send();
  }),
);

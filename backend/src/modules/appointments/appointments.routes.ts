import { Request, RequestHandler, Router } from 'express';
import { appointmentsService } from './appointments.service';
import { getAvailableSlots } from './scheduling.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { requireModule } from '../../shared/middlewares/moduleGuard';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';
import { prisma } from '../../shared/database/prisma';
import { ForbiddenError } from '../../shared/errors/AppError';
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

/**
 * Quem só enxerga a própria agenda também só escreve nela.
 *
 * A permissão de marcar chega pelo interruptor no cadastro da profissional, e
 * ela vale para uma agenda só: a dela. Sem esta trava, `appointments:manage`
 * abriria a agenda da casa inteira — e a promessa do interruptor deixaria de
 * ser verdade no primeiro `PATCH` escrito à mão.
 *
 * Mesmo recorte do `scopeToProfessional`: quem tem visão global
 * (`appointments:view_all`) passa direto, porque nesse caso a agenda da casa é
 * dela por definição.
 */
const restrictToOwnAgenda: RequestHandler = asyncHandler(async (req, _res, next) => {
  const user = req.user;
  if (!user || user.role !== 'PROFESSIONAL') return next();
  if (user.permissions.includes(PERMISSIONS.appointmentsViewAll)) return next();

  const own = user.professionalId;
  if (!own) {
    throw new ForbiddenError('Este acesso não está vinculado a nenhuma profissional.');
  }

  // Marcar para outra, ou passar um atendimento seu para outra mão.
  const corpo = req.body as { professionalId?: string | null } | undefined;
  if (corpo?.professionalId && corpo.professionalId !== own) {
    throw new ForbiddenError('Você só pode marcar na sua própria agenda.');
  }

  // Atendimento sem profissional existe (a casa marca e decide depois quem
  // atende), mas não vindo dela: o que ela cria nasce na agenda dela.
  if (req.method === 'POST' && corpo && !corpo.professionalId) {
    corpo.professionalId = own;
  }

  // Mexer num atendimento que já existe: vale o dono de agora, não o do corpo.
  if (req.params.id) {
    const atual = await prisma.appointment.findFirst({
      where: { id: req.params.id },
      select: { professionalId: true },
    });
    if (atual && atual.professionalId !== own) {
      throw new ForbiddenError('Este atendimento está na agenda de outra profissional.');
    }
  }

  return next();
});

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
  restrictToOwnAgenda,
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
  restrictToOwnAgenda,
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
  restrictToOwnAgenda,
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
  restrictToOwnAgenda,
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

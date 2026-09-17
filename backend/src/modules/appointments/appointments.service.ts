import { AppointmentStatus, ModuleKey, Prisma } from '@prisma/client';
import { prisma, TxClient } from '../../shared/database/prisma';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  PlanLimitError,
} from '../../shared/errors/AppError';
import { getPagination, paginated } from '../../shared/utils/http';
import { getCompanyContext } from '../../shared/services/companyContext.service';
import { addMinutes, endOfMonth, referenceMonth, startOfMonth } from '../../shared/utils/datetime';
import { SOCKET_EVENTS } from '../../websocket/io';
import {
  assertCanWriteToPortfolio,
  emitToPortfolio,
  ownerOfProfessional,
  userOfProfessional,
} from '../../shared/services/portfolio.service';
import { JOB_NAMES, QUEUE_NAMES, enqueue } from '../../queues';
import { commissionsService } from '../commissions/commissions.service';
import { financialService } from '../financial/financial.service';
import { notificationsService } from '../notifications/notifications.service';
import { newPublicToken } from '../public/public.service';
import {
  assertNoConflicts,
  assertNoTimeOff,
  assertProfessionalAvailable,
  assertRenterHasShift,
  assertResourceNotRented,
  assertWithinBusinessHours,
  findConflicts,
} from './scheduling.service';
import type {
  CheckAvailabilityDTO,
  CreateAppointmentDTO,
  ListAppointmentsDTO,
  UpdateAppointmentDTO,
  UpdateStatusDTO,
} from './appointments.schema';
import { avisarPaginaPublica } from '../../shared/services/publicAgenda.service';

const APPOINTMENT_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, whatsapp: true, email: true } },
  professional: { select: { id: true, name: true, color: true, avatarUrl: true } },
  room: { select: { id: true, name: true } },
  resource: { select: { id: true, name: true } },
  services: {
    select: { id: true, serviceId: true, name: true, price: true, durationMinutes: true, quantity: true },
  },
} satisfies Prisma.AppointmentInclude;

/** Transições de status permitidas. */
const STATUS_FLOW: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['CONFIRMED', 'IN_PROGRESS', 'CANCELED', 'NO_SHOW', 'COMPLETED'],
  CONFIRMED: ['IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELED'],
  COMPLETED: [],
  CANCELED: ['SCHEDULED'],
  NO_SHOW: ['SCHEDULED'],
};

export const appointmentsService = {
  async list(query: ListAppointmentsDTO) {
    const pagination = getPagination(query);
    const where = buildWhere(query);

    const [data, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
        include: APPOINTMENT_INCLUDE,
      }),
      prisma.appointment.count({ where }),
    ]);

    return paginated(data, total, pagination);
  },

  /** Retorna todos os agendamentos do intervalo (sem paginação) para a agenda. */
  async calendar(query: ListAppointmentsDTO) {
    if (!query.from || !query.to) {
      throw new BadRequestError('Informe o período (from e to) para carregar a agenda');
    }
    return prisma.appointment.findMany({
      where: buildWhere(query),
      orderBy: { startsAt: 'asc' },
      include: APPOINTMENT_INCLUDE,
    });
  },

  async get(id: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id },
      include: {
        ...APPOINTMENT_INCLUDE,
        transactions: true,
        commissions: true,
      },
    });
    if (!appointment) throw new NotFoundError('Agendamento');
    return appointment;
  },

  async checkAvailability(dto: CheckAvailabilityDTO) {
    const conflicts = await findConflicts({
      professionalId: dto.professionalId,
      roomId: dto.roomId,
      resourceId: dto.resourceId,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      ignoreAppointmentId: dto.ignoreAppointmentId,
    });
    return { available: conflicts.length === 0, conflicts };
  },

  async create(companyId: string, dto: CreateAppointmentDTO, createdById?: string) {
    await assertAppointmentLimit(companyId);

    const appointment = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: dto.customerId } });
      if (!customer) throw new NotFoundError('Cliente');

      const items = await resolveServices(tx, dto.services, dto.professionalId ?? null);
      const totalDuration = items.reduce((sum, i) => sum + i.durationMinutes * i.quantity, 0);
      const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

      const startsAt = dto.startsAt;
      const endsAt = dto.endsAt ?? addMinutes(startsAt, totalDuration);

      if (endsAt <= startsAt) throw new BadRequestError('O término deve ser depois do início');

      // Atendimento de locatária é da carteira dela: não aparece para a casa.
      // A checagem vem antes da validação de horário para não revelar a agenda
      // de outra carteira através da mensagem de conflito.
      const ownerProfessionalId = await ownerOfProfessional(dto.professionalId, tx);
      assertCanWriteToPortfolio(ownerProfessionalId);

      await validateSlot(tx, {
        professionalId: dto.professionalId ?? null,
        roomId: dto.roomId ?? null,
        resourceId: dto.resourceId ?? null,
        startsAt,
        endsAt,
      });

      return tx.appointment.create({
        data: {
          companyId,
          customerId: dto.customerId,
          professionalId: dto.professionalId ?? null,
          ownerProfessionalId,
          roomId: dto.roomId ?? null,
          resourceId: dto.resourceId ?? null,
          startsAt,
          endsAt,
          durationMinutes: Math.round((endsAt.getTime() - startsAt.getTime()) / 60000),
          status: dto.status,
          totalPrice,
          notes: dto.notes,
          // Vale também para o horário marcado no balcão: dá o link para a
          // cliente consultar, remarcar ou cancelar sem ligar.
          publicToken: newPublicToken(),
          createdById: createdById ?? null,
          services: {
            create: items.map((i) => ({
              companyId,
              serviceId: i.serviceId,
              name: i.name,
              price: i.price,
              durationMinutes: i.durationMinutes,
              quantity: i.quantity,
            })),
          },
        },
        include: APPOINTMENT_INCLUDE,
      });
    });

    emitToPortfolio(
      companyId,
      appointment.ownerProfessionalId,
      SOCKET_EVENTS.appointmentCreated,
      appointment,
    );
    void avisarPaginaPublica(companyId);

    await notificationsService.notifyEvent(companyId, 'APPOINTMENT_CREATED', {
      title: 'Novo agendamento',
      message: `${appointment.customer.name} — ${appointment.startsAt.toLocaleString('pt-BR')}`,
      data: { appointmentId: appointment.id },
      userId: await userOfProfessional(appointment.ownerProfessionalId),
    });

    await scheduleReminders(companyId, appointment.id, appointment.startsAt);

    return appointment;
  },

  async update(companyId: string, id: string, dto: UpdateAppointmentDTO) {
    const current = await this.get(id);

    if (current.status === 'COMPLETED') {
      throw new ConflictError('Um atendimento finalizado não pode ser alterado');
    }

    const appointment = await prisma.$transaction(async (tx) => {
      const items = dto.services
        ? await resolveServices(tx, dto.services, dto.professionalId ?? current.professionalId)
        : null;

      const totalDuration = items
        ? items.reduce((sum, i) => sum + i.durationMinutes * i.quantity, 0)
        : current.durationMinutes;
      const totalPrice = items
        ? items.reduce((sum, i) => sum + i.price * i.quantity, 0)
        : Number(current.totalPrice);

      const startsAt = dto.startsAt ?? current.startsAt;
      const endsAt =
        dto.endsAt ?? (dto.startsAt || items ? addMinutes(startsAt, totalDuration) : current.endsAt);

      if (endsAt <= startsAt) throw new BadRequestError('O término deve ser depois do início');

      const professionalId =
        dto.professionalId !== undefined ? dto.professionalId : current.professionalId;
      const roomId = dto.roomId !== undefined ? dto.roomId : current.roomId;
      const resourceId = dto.resourceId !== undefined ? dto.resourceId : current.resourceId;

      const nextOwner = await ownerOfProfessional(professionalId, tx);
      assertCanWriteToPortfolio(nextOwner);

      await validateSlot(tx, {
        professionalId,
        roomId,
        resourceId,
        startsAt,
        endsAt,
        ignoreAppointmentId: id,
      });

      if (items) {
        await tx.appointmentService.deleteMany({ where: { appointmentId: id } });
        await tx.appointmentService.createMany({
          data: items.map((i) => ({
            companyId,
            appointmentId: id,
            serviceId: i.serviceId,
            name: i.name,
            price: i.price,
            durationMinutes: i.durationMinutes,
            quantity: i.quantity,
          })),
        });
      }

      return tx.appointment.update({
        where: { id },
        data: {
          ...(dto.customerId ? { customerId: dto.customerId } : {}),
          professionalId,
          ownerProfessionalId: nextOwner,
          roomId,
          resourceId,
          startsAt,
          endsAt,
          durationMinutes: Math.round((endsAt.getTime() - startsAt.getTime()) / 60000),
          totalPrice,
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
        include: APPOINTMENT_INCLUDE,
      });
    });

    emitToPortfolio(
      companyId,
      appointment.ownerProfessionalId,
      SOCKET_EVENTS.appointmentUpdated,
      appointment,
    );
    void avisarPaginaPublica(companyId);

    if (dto.startsAt) {
      await scheduleReminders(companyId, appointment.id, appointment.startsAt);
    }

    return appointment;
  },

  async updateStatus(companyId: string, id: string, dto: UpdateStatusDTO, userId?: string) {
    const current = await this.get(id);

    if (current.status === dto.status) return current;

    const allowed = STATUS_FLOW[current.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new ConflictError(
        `Não é possível mudar o status de ${current.status} para ${dto.status}`,
      );
    }

    const context = await getCompanyContext(companyId);
    const modules = context?.modules ?? [];

    const appointment = await prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === 'CANCELED'
            ? { canceledAt: new Date(), canceledReason: dto.canceledReason ?? null }
            : {}),
          ...(dto.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
        },
        include: APPOINTMENT_INCLUDE,
      });

      if (dto.status === 'COMPLETED') {
        const belongsToCompany = updated.ownerProfessionalId === null;

        // A receita é sempre registrada — o que muda é em qual caixa. O
        // atendimento da locatária entra no caixa dela, e a carteira mantém
        // isso invisível para a casa, que fatura apenas o aluguel do turno.
        if (modules.includes(ModuleKey.financial)) {
          await financialService.registerAppointmentIncome(tx, companyId, updated, dto.payment, userId);
        }

        // Comissão só existe entre a casa e a equipe dela: quem aluga o espaço
        // cobra a própria cliente e não repassa percentual a ninguém.
        if (belongsToCompany && modules.includes(ModuleKey.commissions) && updated.professionalId) {
          await commissionsService.generateForAppointment(tx, companyId, updated.id);
        }
      }

      if (dto.status === 'CANCELED') {
        await tx.commission.updateMany({
          where: { appointmentId: id, status: 'PENDING' },
          data: { status: 'CANCELED' },
        });
      }

      return updated;
    });

    emitToPortfolio(
      companyId,
      appointment.ownerProfessionalId,
      SOCKET_EVENTS.appointmentUpdated,
      appointment,
    );
    void avisarPaginaPublica(companyId);

    if (dto.status === 'CANCELED') {
      await notificationsService.notifyEvent(companyId, 'APPOINTMENT_CANCELED', {
        title: 'Agendamento cancelado',
        message: `${appointment.customer.name} — ${appointment.startsAt.toLocaleString('pt-BR')}`,
        data: { appointmentId: appointment.id },
        userId: await userOfProfessional(appointment.ownerProfessionalId),
      });
    }

    return appointment;
  },

  async remove(companyId: string, id: string) {
    const appointment = await this.get(id);
    if (appointment.status === 'COMPLETED') {
      throw new ConflictError('Um atendimento finalizado não pode ser excluído. Cancele-o se necessário.');
    }
    await prisma.appointment.delete({ where: { id } });
    emitToPortfolio(companyId, appointment.ownerProfessionalId, SOCKET_EVENTS.appointmentDeleted, {
      id,
    });
    void avisarPaginaPublica(companyId);
  },

  /** Resumo do dia usado no dashboard. */
  async todaySummary(reference = new Date()) {
    const from = new Date(reference);
    from.setHours(0, 0, 0, 0);
    const to = new Date(reference);
    to.setHours(23, 59, 59, 999);

    const [total, byStatus, revenue, next] = await Promise.all([
      prisma.appointment.count({ where: { startsAt: { gte: from, lte: to } } }),
      prisma.appointment.groupBy({
        by: ['status'],
        where: { startsAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      prisma.appointment.aggregate({
        where: { startsAt: { gte: from, lte: to }, status: 'COMPLETED' },
        _sum: { totalPrice: true },
      }),
      prisma.appointment.findMany({
        where: {
          startsAt: { gte: reference, lte: to },
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
        },
        orderBy: { startsAt: 'asc' },
        take: 8,
        include: APPOINTMENT_INCLUDE,
      }),
    ]);

    return {
      total,
      revenue: revenue._sum.totalPrice ?? 0,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      upcoming: next,
    };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWhere(query: ListAppointmentsDTO): Prisma.AppointmentWhereInput {
  const status = query.status
    ? Array.isArray(query.status)
      ? query.status
      : [query.status]
    : undefined;

  return {
    ...(query.from || query.to
      ? {
          startsAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...(query.professionalId ? { professionalId: query.professionalId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.roomId ? { roomId: query.roomId } : {}),
    ...(query.resourceId ? { resourceId: query.resourceId } : {}),
    ...(query.serviceId ? { services: { some: { serviceId: query.serviceId } } } : {}),
    ...(status ? { status: { in: status } } : {}),
  };
}

interface ResolvedItem {
  serviceId: string;
  name: string;
  price: number;
  durationMinutes: number;
  quantity: number;
}

/** Congela nome, preço e duração no momento do agendamento. */
async function resolveServices(
  tx: TxClient,
  items: { serviceId: string; quantity: number; price?: number; durationMinutes?: number }[],
  professionalId: string | null,
): Promise<ResolvedItem[]> {
  const ids = items.map((i) => i.serviceId);
  const services = await tx.service.findMany({ where: { id: { in: ids } } });

  if (services.length !== new Set(ids).size) {
    throw new BadRequestError('Um ou mais serviços informados não existem nesta empresa');
  }

  const overrides = professionalId
    ? await tx.professionalService.findMany({
        where: { professionalId, serviceId: { in: ids } },
      })
    : [];

  return items.map((item) => {
    const service = services.find((s) => s.id === item.serviceId)!;
    const override = overrides.find((o) => o.serviceId === item.serviceId);

    return {
      serviceId: service.id,
      name: service.name,
      price:
        item.price ??
        (override?.customPrice ? Number(override.customPrice) : Number(service.price)),
      durationMinutes:
        item.durationMinutes ?? override?.customDuration ?? service.durationMinutes,
      quantity: item.quantity,
    };
  });
}

async function validateSlot(
  tx: TxClient,
  target: {
    professionalId: string | null;
    roomId: string | null;
    resourceId: string | null;
    startsAt: Date;
    endsAt: Date;
    ignoreAppointmentId?: string;
  },
) {
  await assertWithinBusinessHours(target.startsAt, target.endsAt, tx);

  if (target.professionalId) {
    const professional = await tx.professional.findFirst({ where: { id: target.professionalId } });
    if (!professional) throw new NotFoundError('Profissional');

    await assertNoTimeOff(professional.id, target.startsAt, target.endsAt, tx);

    if (professional.revenueOwner === 'PROFESSIONAL') {
      // Locatária: quem define a disponibilidade é o turno alugado.
      await assertRenterHasShift(professional, target.startsAt, target.endsAt, tx);
    } else {
      await assertProfessionalAvailable(professional.id, target.startsAt, target.endsAt, tx);
    }
  }

  const resourceIds = [target.roomId, target.resourceId].filter(Boolean) as string[];

  if (resourceIds.length > 0) {
    const resources = await tx.resource.findMany({ where: { id: { in: resourceIds } } });
    for (const resource of resources) {
      if (resource.status === 'MAINTENANCE' || resource.status === 'INACTIVE') {
        throw new ConflictError(`O recurso "${resource.name}" está indisponível (${resource.status})`);
      }
    }

    await assertResourceNotRented(
      resourceIds,
      target.professionalId,
      target.startsAt,
      target.endsAt,
      tx,
    );
  }

  await assertNoConflicts(target, tx);
}

async function assertAppointmentLimit(companyId: string) {
  const context = await getCompanyContext(companyId);
  const max = context?.plan?.maxAppointmentsMonth ?? null;
  if (max === null) return;

  const now = new Date();
  const count = await prisma.appointment.count({
    where: { createdAt: { gte: startOfMonth(now), lte: endOfMonth(now) } },
  });

  if (count >= max) {
    throw new PlanLimitError(
      `Seu plano permite ${max} agendamentos por mês (${referenceMonth(now)}). Faça upgrade para continuar.`,
      { limit: max, current: count },
    );
  }
}

/** Agenda lembretes 24h e 1h antes do atendimento. */
async function scheduleReminders(companyId: string, appointmentId: string, startsAt: Date) {
  const now = Date.now();
  const targets = [
    { label: '24h', delay: startsAt.getTime() - 24 * 3600_000 - now },
    { label: '1h', delay: startsAt.getTime() - 3600_000 - now },
  ];

  for (const target of targets) {
    if (target.delay <= 0) continue;
    await enqueue(
      QUEUE_NAMES.reminders,
      JOB_NAMES.appointmentReminder,
      { companyId, appointmentId, window: target.label },
      { delay: target.delay, jobId: `reminder:${appointmentId}:${target.label}` },
    );
  }
}

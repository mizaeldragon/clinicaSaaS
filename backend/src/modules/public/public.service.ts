import crypto from 'node:crypto';
import { AppointmentSource, AppointmentStatus } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { NotFoundError, ScheduleConflictError } from '../../shared/errors/AppError';
import { addMinutes, endOfDay, minutesOfDay, startOfDay, timeToMinutes } from '../../shared/utils/datetime';
import { SOCKET_EVENTS } from '../../websocket/io';
import {
  emitToPortfolio,
  ownerOfProfessional,
  userOfProfessional,
} from '../../shared/services/portfolio.service';
import { notificationsService } from '../notifications/notifications.service';
import { BLOCKING_STATUSES } from '../appointments/scheduling.service';
import type { AvailabilityQueryDTO, CreatePublicAppointmentDTO } from './public.schema';

const OCCUPYING_BOOKING_STATUSES = ['RESERVED', 'CONFIRMED'] as const;

interface Window {
  start: number; // minutos desde a meia-noite
  end: number;
  resourceId: string | null; // sala que a locatária alugou naquele turno
}

/** Vitrine da empresa: o que a cliente vê ao abrir o link. */
export async function getStorefront(companyId: string) {
  const [company, categories, services, professionals] = await Promise.all([
    tenantContext.runAsSystem(() =>
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          name: true,
          slug: true,
          logoUrl: true,
          primaryColor: true,
          publicDescription: true,
          phone: true,
          whatsapp: true,
          addressStreet: true,
          addressNumber: true,
          addressCity: true,
          addressState: true,
        },
      }),
    ),
    prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, color: true },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        durationMinutes: true,
        categoryId: true,
      },
    }),
    prisma.professional.findMany({
      where: { isActive: true, publicBookingEnabled: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, avatarUrl: true, color: true, specialties: true, bio: true },
    }),
  ]);

  if (!company) throw new NotFoundError('Empresa');

  // Só oferece serviços que alguém realmente executa.
  const links = await prisma.professionalService.findMany({
    where: { serviceId: { in: services.map((s) => s.id) } },
    select: { serviceId: true, professionalId: true },
  });

  const bookable = services.filter((service) =>
    links.some(
      (link) =>
        link.serviceId === service.id && professionals.some((p) => p.id === link.professionalId),
    ),
  );

  return {
    company,
    categories: categories.filter((category) => bookable.some((s) => s.categoryId === category.id)),
    services: bookable,
    professionals,
  };
}

/**
 * Vitrine individual: o link que cada profissional divulga.
 *
 * A dona do espaço tem o dela e cada locatária tem o seu. A página mostra a
 * marca da casa, mas só os serviços de quem é dona daquele link — a cliente
 * chega sabendo com quem vai marcar.
 */
export async function getProfessionalStorefront(companyId: string, publicSlug: string) {
  const professional = await prisma.professional.findFirst({
    where: { publicSlug, isActive: true, publicBookingEnabled: true },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      color: true,
      specialties: true,
      bio: true,
      publicSlug: true,
    },
  });

  if (!professional) throw new NotFoundError('Página');

  const storefront = await getStorefront(companyId);

  const links = await prisma.professionalService.findMany({
    where: { professionalId: professional.id },
    select: { serviceId: true },
  });
  const offered = new Set(links.map((link) => link.serviceId));

  const services = storefront.services.filter((service) => offered.has(service.id));

  return {
    company: storefront.company,
    professional,
    categories: storefront.categories.filter((category) =>
      services.some((service) => service.categoryId === category.id),
    ),
    services,
  };
}

/**
 * Janelas em que a profissional pode atender em um dia.
 *
 * Equipe própria → jornada de trabalho cadastrada.
 * Locatária      → os turnos que ela alugou naquele dia (é o aluguel que
 *                  determina quem é "a profissional do dia").
 */
async function availabilityWindows(
  professional: { id: string; revenueOwner: string },
  date: Date,
): Promise<Window[]> {
  const day = startOfDay(date);

  if (professional.revenueOwner === 'PROFESSIONAL') {
    const bookings = await prisma.rentalBooking.findMany({
      where: {
        professionalId: professional.id,
        date: day,
        status: { in: [...OCCUPYING_BOOKING_STATUSES] },
      },
      orderBy: { startsAt: 'asc' },
    });

    return bookings.map((booking) => ({
      start: minutesOfDay(booking.startsAt),
      end: minutesOfDay(booking.endsAt),
      resourceId: booking.resourceId,
    }));
  }

  const workingHour = await prisma.workingHour.findFirst({
    where: { professionalId: professional.id, weekday: day.getDay() },
  });

  if (!workingHour || workingHour.isOff) return [];

  const start = timeToMinutes(workingHour.startsAt);
  const end = timeToMinutes(workingHour.endsAt);

  // O intervalo parte a jornada em duas janelas.
  if (workingHour.breakStart && workingHour.breakEnd) {
    const breakStart = timeToMinutes(workingHour.breakStart);
    const breakEnd = timeToMinutes(workingHour.breakEnd);
    return [
      { start, end: breakStart, resourceId: null },
      { start: breakEnd, end, resourceId: null },
    ];
  }

  return [{ start, end, resourceId: null }];
}

/**
 * Horários livres para um serviço em uma data, já cruzando:
 * jornada/turno, expediente da empresa, ausências e agendamentos existentes.
 */
export async function getPublicAvailability(query: AvailabilityQueryDTO) {
  const day = startOfDay(query.date);
  const now = new Date();

  const service = await prisma.service.findFirst({ where: { id: query.serviceId, isActive: true } });
  if (!service) throw new NotFoundError('Serviço');

  // Feriado e fechamento avulso zeram o dia antes de qualquer outra conta.
  const holiday = await prisma.holiday.findFirst({ where: { date: day } });
  if (holiday) return { service, date: day, professionals: [] };

  const businessHour = await prisma.businessHour.findFirst({ where: { weekday: day.getDay() } });
  if (businessHour?.isClosed) return { service, date: day, professionals: [] };

  const openAt = businessHour ? timeToMinutes(businessHour.opensAt) : 0;
  const closeAt = businessHour ? timeToMinutes(businessHour.closesAt) : 24 * 60;

  const links = await prisma.professionalService.findMany({
    where: { serviceId: query.serviceId },
    select: { professionalId: true, customDuration: true, customPrice: true },
  });

  const professionals = await prisma.professional.findMany({
    where: {
      id: {
        in: links
          .map((l) => l.professionalId)
          .filter((id) => !query.professionalId || id === query.professionalId),
      },
      isActive: true,
      publicBookingEnabled: true,
    },
    select: { id: true, name: true, avatarUrl: true, color: true, revenueOwner: true },
  });

  if (professionals.length === 0) return { service, date: day, professionals: [] };

  const [appointments, timeOffs] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        professionalId: { in: professionals.map((p) => p.id) },
        status: { in: BLOCKING_STATUSES },
        startsAt: { lt: endOfDay(day) },
        endsAt: { gt: day },
        // Ao remarcar, o próprio horário não pode contar como ocupado.
        ...(query.ignoreAppointmentId ? { id: { not: query.ignoreAppointmentId } } : {}),
      },
      select: { professionalId: true, startsAt: true, endsAt: true },
    }),
    prisma.timeOff.findMany({
      where: {
        professionalId: { in: professionals.map((p) => p.id) },
        startsAt: { lt: endOfDay(day) },
        endsAt: { gt: day },
      },
      select: { professionalId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const result = [];

  for (const professional of professionals) {
    const link = links.find((l) => l.professionalId === professional.id);
    const duration = link?.customDuration ?? service.durationMinutes;
    const price = link?.customPrice ? Number(link.customPrice) : Number(service.price);

    const windows = await availabilityWindows(professional, day);
    const slots: { time: string; startsAt: Date; endsAt: Date; resourceId: string | null }[] = [];

    for (const window of windows) {
      const from = Math.max(window.start, openAt);
      const to = Math.min(window.end, closeAt);

      for (let cursor = from; cursor + duration <= to; cursor += 15) {
        const startsAt = new Date(day);
        startsAt.setMinutes(cursor);
        const endsAt = addMinutes(startsAt, duration);

        if (startsAt <= now) continue;

        const busy = appointments.some(
          (appointment) =>
            appointment.professionalId === professional.id &&
            startsAt < appointment.endsAt &&
            endsAt > appointment.startsAt,
        );
        if (busy) continue;

        const away = timeOffs.some(
          (timeOff) =>
            timeOff.professionalId === professional.id &&
            startsAt < timeOff.endsAt &&
            endsAt > timeOff.startsAt,
        );
        if (away) continue;

        slots.push({
          time: `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`,
          startsAt,
          endsAt,
          resourceId: window.resourceId,
        });
      }
    }

    if (slots.length > 0) {
      result.push({
        professional: {
          id: professional.id,
          name: professional.name,
          avatarUrl: professional.avatarUrl,
          color: professional.color,
        },
        price,
        durationMinutes: duration,
        slots,
      });
    }
  }

  return { service, date: day, professionals: result };
}

/** Dias com pelo menos um horário livre — pinta o calendário do link público. */
export async function getPublicAgenda(
  serviceId: string,
  from: Date,
  days: number,
  professionalId?: string,
) {
  const result: { date: Date; available: boolean }[] = [];

  for (let i = 0; i < days; i += 1) {
    const date = startOfDay(from);
    date.setDate(date.getDate() + i);
    const availability = await getPublicAvailability({ serviceId, date, professionalId });
    result.push({ date, available: availability.professionals.length > 0 });
  }

  return result;
}

/** Cria o agendamento vindo do link público, reaproveitando o cliente pelo telefone. */
export async function createPublicAppointment(
  companyId: string,
  requiresApproval: boolean,
  dto: CreatePublicAppointmentDTO,
) {
  const availability = await getPublicAvailability({
    serviceId: dto.serviceId,
    date: dto.startsAt,
    professionalId: dto.professionalId,
  });

  const professional = availability.professionals.find(
    (entry) => entry.professional.id === dto.professionalId,
  );

  if (!professional) {
    throw new ScheduleConflictError('Esta profissional não tem horário disponível nesta data');
  }

  const slot = professional.slots.find(
    (candidate) => candidate.startsAt.getTime() === dto.startsAt.getTime(),
  );

  if (!slot) {
    throw new ScheduleConflictError(
      'Este horário acabou de ser ocupado. Escolha outro, por favor.',
    );
  }

  const appointment = await prisma.$transaction(async (tx) => {
    // Quem alugou o espaço tem carteira própria: a cliente entra na carteira da
    // profissional escolhida. A mesma pessoa pode ser cliente da casa e de uma
    // locatária — são dois negócios diferentes debaixo do mesmo teto.
    const ownerProfessionalId = await ownerOfProfessional(dto.professionalId, tx);

    // Cliente recorrente é reconhecido pelo telefone, dentro da mesma carteira.
    const existing = await tx.customer.findFirst({
      where: {
        ownerProfessionalId,
        OR: [{ phone: dto.customer.phone }, { whatsapp: dto.customer.phone }],
      },
    });

    const customer =
      existing ??
      (await tx.customer.create({
        data: {
          companyId,
          ownerProfessionalId,
          name: dto.customer.name,
          phone: dto.customer.phone,
          whatsapp: dto.customer.phone,
          email: dto.customer.email ?? null,
          notes: 'Cadastrado pelo agendamento online',
        },
      }));

    return tx.appointment.create({
      data: {
        companyId,
        customerId: customer.id,
        professionalId: dto.professionalId,
        ownerProfessionalId,
        // Locatária atende na sala que alugou naquele turno.
        roomId: slot.resourceId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        durationMinutes: professional.durationMinutes,
        status: requiresApproval ? AppointmentStatus.SCHEDULED : AppointmentStatus.CONFIRMED,
        totalPrice: professional.price,
        notes: dto.notes ?? null,
        source: AppointmentSource.PUBLIC,
        publicToken: newPublicToken(),
        services: {
          create: {
            companyId,
            serviceId: availability.service.id,
            name: availability.service.name,
            price: professional.price,
            durationMinutes: professional.durationMinutes,
            quantity: 1,
          },
        },
      },
      include: {
        customer: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
        services: { select: { name: true } },
      },
    });
  });

  emitToPortfolio(
    companyId,
    appointment.ownerProfessionalId,
    SOCKET_EVENTS.appointmentCreated,
    appointment,
  );

  // A locadora não é avisada do atendimento de quem aluga: a notificação vai
  // para a própria locatária.
  await notificationsService.notifyEvent(companyId, 'APPOINTMENT_CREATED', {
    title: 'Novo agendamento online',
    message: `${appointment.customer.name} — ${appointment.startsAt.toLocaleString('pt-BR')} com ${appointment.professional?.name ?? 'profissional'}`,
    data: { appointmentId: appointment.id, source: 'PUBLIC' },
    userId: await userOfProfessional(appointment.ownerProfessionalId),
  });

  return {
    id: appointment.id,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    status: appointment.status,
    professional: appointment.professional,
    service: appointment.services[0]?.name,
    requiresApproval,
    /** Endereço do próprio horário: a cliente consulta, remarca ou cancela por ele. */
    token: appointment.publicToken,
  };
}

/* ------------------------------------------------------------------------ */
/*  O horário da cliente: consultar, remarcar e cancelar sem ter conta        */
/* ------------------------------------------------------------------------ */

/** Chave secreta do link. Longa o bastante para não ser adivinhada. */
export function newPublicToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

const OPEN_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
];

async function findByToken(token: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { publicToken: token },
    include: {
      customer: { select: { name: true, phone: true } },
      professional: { select: { id: true, name: true, avatarUrl: true, publicSlug: true } },
      services: { select: { serviceId: true, name: true, price: true, durationMinutes: true } },
    },
  });

  if (!appointment) throw new NotFoundError('Agendamento');
  return appointment;
}

/** O que a cliente vê ao abrir o link do horário dela. */
export async function getPublicAppointment(companyId: string, token: string) {
  const appointment = await findByToken(token);
  const storefront = await getStorefront(companyId);

  return {
    company: storefront.company,
    appointment: {
      // Devolvido para a grade de remarcação poder ignorar o próprio horário.
      id: appointment.id,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
      customerName: appointment.customer.name,
      professional: appointment.professional,
      service: appointment.services[0] ?? null,
      totalPrice: appointment.totalPrice,
      /** Já passou ou já foi encerrado: só resta consultar. */
      changeable:
        OPEN_STATUSES.includes(appointment.status) && appointment.startsAt.getTime() > Date.now(),
    },
  };
}

/**
 * Garante que o horário ainda pode mudar. Atendimento finalizado, cancelado ou
 * que já começou fica congelado — remarcar depois da hora bagunçaria a agenda
 * de quem já se organizou.
 */
function assertChangeable(appointment: { status: AppointmentStatus; startsAt: Date }) {
  if (!OPEN_STATUSES.includes(appointment.status)) {
    throw new ScheduleConflictError('Este agendamento não está mais aberto para alteração');
  }
  if (appointment.startsAt.getTime() <= Date.now()) {
    throw new ScheduleConflictError(
      'Este horário já começou. Fale com o espaço para reorganizar.',
    );
  }
}

export async function cancelPublicAppointment(companyId: string, token: string, reason?: string) {
  const appointment = await findByToken(token);
  assertChangeable(appointment);

  const canceled = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: AppointmentStatus.CANCELED,
      canceledAt: new Date(),
      canceledReason: reason?.trim() || 'Cancelado pela cliente no link público',
    },
  });

  emitToPortfolio(
    companyId,
    appointment.ownerProfessionalId,
    SOCKET_EVENTS.appointmentUpdated,
    canceled,
  );

  await notificationsService.notifyEvent(companyId, 'APPOINTMENT_CANCELED', {
    title: 'Cancelamento pelo link',
    message: `${appointment.customer.name} cancelou ${appointment.startsAt.toLocaleString('pt-BR')}`,
    data: { appointmentId: appointment.id, source: 'PUBLIC' },
    userId: await userOfProfessional(appointment.ownerProfessionalId),
  });

  return { status: canceled.status };
}

/** Remarca para outro horário livre da mesma profissional e do mesmo serviço. */
export async function reschedulePublicAppointment(
  companyId: string,
  token: string,
  startsAt: Date,
) {
  const appointment = await findByToken(token);
  assertChangeable(appointment);

  const serviceId = appointment.services[0]?.serviceId;
  if (!serviceId || !appointment.professionalId) {
    throw new ScheduleConflictError('Este agendamento precisa ser remarcado pelo espaço');
  }

  // Passa pela mesma checagem do agendamento novo — turno alugado, jornada,
  // feriado, sala ocupada. O horário atual é ignorado para não conflitar consigo.
  const availability = await getPublicAvailability({
    serviceId,
    date: startsAt,
    professionalId: appointment.professionalId,
    ignoreAppointmentId: appointment.id,
  });

  const entry = availability.professionals[0];
  const slot = entry?.slots.find((candidate) => candidate.startsAt.getTime() === startsAt.getTime());

  if (!slot) {
    throw new ScheduleConflictError('Este horário não está mais livre. Escolha outro, por favor.');
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      roomId: slot.resourceId,
      status: AppointmentStatus.SCHEDULED,
    },
    include: {
      customer: { select: { name: true } },
      professional: { select: { id: true, name: true } },
    },
  });

  emitToPortfolio(
    companyId,
    appointment.ownerProfessionalId,
    SOCKET_EVENTS.appointmentUpdated,
    updated,
  );

  await notificationsService.notifyEvent(companyId, 'APPOINTMENT_CREATED', {
    title: 'Horário remarcado pelo link',
    message: `${updated.customer.name} passou para ${updated.startsAt.toLocaleString('pt-BR')}`,
    data: { appointmentId: updated.id, source: 'PUBLIC' },
    userId: await userOfProfessional(appointment.ownerProfessionalId),
  });

  return { startsAt: updated.startsAt, endsAt: updated.endsAt, status: updated.status };
}

export type PublicAvailability = Awaited<ReturnType<typeof getPublicAvailability>>;

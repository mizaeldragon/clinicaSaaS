import { AppointmentStatus, Prisma } from '@prisma/client';
import { prisma, TxClient } from '../../shared/database/prisma';
import { BadRequestError, ScheduleConflictError } from '../../shared/errors/AppError';
import { addMinutes, minutesOfDay, minutesToTime, startOfDay, endOfDay, timeToMinutes } from '../../shared/utils/datetime';

/** Status que efetivamente ocupam a agenda. */
export const BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
];

export interface SlotTarget {
  professionalId?: string | null;
  roomId?: string | null;
  resourceId?: string | null;
  startsAt: Date;
  endsAt: Date;
  ignoreAppointmentId?: string | null;
}

/** Duração em minutos, preservando a travessia de dias. */
function durationInMinutes(startsAt: Date, endsAt: Date): number {
  return Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
}

export interface ConflictInfo {
  type: 'professional' | 'room' | 'resource';
  appointmentId: string;
  startsAt: Date;
  endsAt: Date;
  label: string;
}

/**
 * Busca conflitos de horário. Dois intervalos se sobrepõem quando
 * `start < other.end && end > other.start`.
 */
export async function findConflicts(
  target: SlotTarget,
  client: TxClient = prisma,
): Promise<ConflictInfo[]> {
  const overlap: Prisma.AppointmentWhereInput = {
    status: { in: BLOCKING_STATUSES },
    startsAt: { lt: target.endsAt },
    endsAt: { gt: target.startsAt },
    ...(target.ignoreAppointmentId ? { id: { not: target.ignoreAppointmentId } } : {}),
  };

  const or: Prisma.AppointmentWhereInput[] = [];
  if (target.professionalId) or.push({ professionalId: target.professionalId });
  if (target.roomId) or.push({ roomId: target.roomId });
  if (target.resourceId) or.push({ resourceId: target.resourceId });

  if (or.length === 0) return [];

  const conflicts = await client.appointment.findMany({
    where: { ...overlap, OR: or },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      professionalId: true,
      roomId: true,
      resourceId: true,
      professional: { select: { name: true } },
      room: { select: { name: true } },
      resource: { select: { name: true } },
      customer: { select: { name: true } },
    },
  });

  const result: ConflictInfo[] = [];

  for (const c of conflicts) {
    if (target.professionalId && c.professionalId === target.professionalId) {
      result.push({
        type: 'professional',
        appointmentId: c.id,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        label: `${c.professional?.name ?? 'Profissional'} já possui atendimento com ${c.customer?.name ?? 'cliente'} neste horário`,
      });
    }
    if (target.roomId && c.roomId === target.roomId) {
      result.push({
        type: 'room',
        appointmentId: c.id,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        label: `A sala ${c.room?.name ?? ''} já está ocupada neste horário`,
      });
    }
    if (target.resourceId && c.resourceId === target.resourceId) {
      result.push({
        type: 'resource',
        appointmentId: c.id,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        label: `O recurso ${c.resource?.name ?? ''} já está reservado neste horário`,
      });
    }
  }

  return result;
}

export async function assertNoConflicts(target: SlotTarget, client: TxClient = prisma): Promise<void> {
  const conflicts = await findConflicts(target, client);
  if (conflicts.length > 0) {
    throw new ScheduleConflictError(conflicts[0].label, { conflicts });
  }
}

/** Reservas de turno que ocupam o espaço. */
const OCCUPYING_BOOKING_STATUSES = ['RESERVED', 'CONFIRMED'] as const;

/** Ausência (férias, consulta) vale tanto para a equipe própria quanto para locatárias. */
export async function assertNoTimeOff(
  professionalId: string,
  startsAt: Date,
  endsAt: Date,
  client: TxClient = prisma,
): Promise<void> {
  const timeOff = await client.timeOff.findFirst({
    where: { professionalId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
  });

  if (timeOff) {
    throw new ScheduleConflictError('O profissional está ausente neste período', {
      timeOff: { startsAt: timeOff.startsAt, endsAt: timeOff.endsAt, reason: timeOff.reason },
    });
  }
}

/**
 * O espaço não pode receber atendimento quando está alugado para outra
 * profissional naquele turno.
 */
export async function assertResourceNotRented(
  resourceIds: string[],
  professionalId: string | null,
  startsAt: Date,
  endsAt: Date,
  client: TxClient = prisma,
): Promise<void> {
  if (resourceIds.length === 0) return;

  const booking = await client.rentalBooking.findFirst({
    where: {
      resourceId: { in: resourceIds },
      status: { in: [...OCCUPYING_BOOKING_STATUSES] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(professionalId ? { professionalId: { not: professionalId } } : {}),
    },
    include: { resource: { select: { name: true } }, professional: { select: { name: true } } },
  });

  if (booking) {
    throw new ScheduleConflictError(
      `O espaço "${booking.resource.name}" está alugado para ${booking.professional.name} neste horário`,
    );
  }
}

/**
 * Locatária só atende dentro do turno que alugou — é o turno, e não uma jornada
 * fixa, que define a disponibilidade dela.
 */
export async function assertRenterHasShift(
  professional: { id: string; name: string },
  startsAt: Date,
  endsAt: Date,
  client: TxClient = prisma,
): Promise<void> {
  const booking = await client.rentalBooking.findFirst({
    where: {
      professionalId: professional.id,
      status: { in: [...OCCUPYING_BOOKING_STATUSES] },
      startsAt: { lte: startsAt },
      endsAt: { gte: endsAt },
    },
  });

  if (!booking) {
    throw new ScheduleConflictError(
      `${professional.name} não tem turno reservado que cubra este horário`,
    );
  }
}

/** Valida jornada de trabalho e ausências do profissional. */
export async function assertProfessionalAvailable(
  professionalId: string,
  startsAt: Date,
  endsAt: Date,
  client: TxClient = prisma,
): Promise<void> {
  const weekday = startsAt.getDay();

  const [workingHour, timeOff] = await Promise.all([
    client.workingHour.findFirst({ where: { professionalId, weekday } }),
    client.timeOff.findFirst({
      where: { professionalId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    }),
  ]);

  if (timeOff) {
    throw new ScheduleConflictError('O profissional está ausente neste período', {
      timeOff: { startsAt: timeOff.startsAt, endsAt: timeOff.endsAt, reason: timeOff.reason },
    });
  }

  if (!workingHour || workingHour.isOff) {
    throw new ScheduleConflictError('O profissional não atende neste dia da semana');
  }

  const start = minutesOfDay(startsAt);
  // Somar a duração (em vez de usar os minutos do dia do fim) mantém a
  // comparação correta quando o atendimento avança para o dia seguinte.
  const end = start + durationInMinutes(startsAt, endsAt);
  const shiftStart = timeToMinutes(workingHour.startsAt);
  const shiftEnd = timeToMinutes(workingHour.endsAt);

  if (start < shiftStart || end > shiftEnd) {
    throw new ScheduleConflictError(
      `O profissional atende das ${workingHour.startsAt} às ${workingHour.endsAt} neste dia`,
    );
  }

  if (workingHour.breakStart && workingHour.breakEnd) {
    const breakStart = timeToMinutes(workingHour.breakStart);
    const breakEnd = timeToMinutes(workingHour.breakEnd);
    if (start < breakEnd && end > breakStart) {
      throw new ScheduleConflictError(
        `O horário conflita com o intervalo do profissional (${workingHour.breakStart} - ${workingHour.breakEnd})`,
      );
    }
  }
}

/** Valida o horário de funcionamento da empresa. */
export async function assertWithinBusinessHours(
  startsAt: Date,
  endsAt: Date,
  client: TxClient = prisma,
): Promise<void> {
  const weekday = startsAt.getDay();
  const businessHour = await client.businessHour.findFirst({ where: { weekday } });
  if (!businessHour) return; // empresa sem horário configurado: não bloqueia

  if (businessHour.isClosed) {
    throw new ScheduleConflictError('A empresa está fechada neste dia da semana');
  }

  const start = minutesOfDay(startsAt);
  const end = start + durationInMinutes(startsAt, endsAt);

  if (start < timeToMinutes(businessHour.opensAt) || end > timeToMinutes(businessHour.closesAt)) {
    throw new ScheduleConflictError(
      `O horário de funcionamento neste dia é das ${businessHour.opensAt} às ${businessHour.closesAt}`,
    );
  }
}

export interface AvailabilitySlot {
  startsAt: Date;
  endsAt: Date;
  time: string;
  available: boolean;
  reason?: string;
}

/**
 * Gera a grade de horários livres de um profissional em um dia,
 * considerando jornada, intervalo, ausências e agendamentos existentes.
 */
export async function getAvailableSlots(params: {
  professionalId: string;
  date: Date;
  durationMinutes: number;
  slotMinutes?: number;
  roomId?: string | null;
  resourceId?: string | null;
}): Promise<AvailabilitySlot[]> {
  const { professionalId, date, durationMinutes } = params;
  const slotMinutes = params.slotMinutes ?? 15;

  if (durationMinutes <= 0) throw new BadRequestError('Duração inválida');

  const weekday = date.getDay();
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [workingHour, businessHour, timeOffs, appointments] = await Promise.all([
    prisma.workingHour.findFirst({ where: { professionalId, weekday } }),
    prisma.businessHour.findFirst({ where: { weekday } }),
    prisma.timeOff.findMany({
      where: { professionalId, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
    }),
    prisma.appointment.findMany({
      where: {
        status: { in: BLOCKING_STATUSES },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
        OR: [
          { professionalId },
          ...(params.roomId ? [{ roomId: params.roomId }] : []),
          ...(params.resourceId ? [{ resourceId: params.resourceId }] : []),
        ],
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  if (!workingHour || workingHour.isOff) return [];
  if (businessHour?.isClosed) return [];

  let shiftStart = timeToMinutes(workingHour.startsAt);
  let shiftEnd = timeToMinutes(workingHour.endsAt);

  if (businessHour) {
    shiftStart = Math.max(shiftStart, timeToMinutes(businessHour.opensAt));
    shiftEnd = Math.min(shiftEnd, timeToMinutes(businessHour.closesAt));
  }

  const breakStart = workingHour.breakStart ? timeToMinutes(workingHour.breakStart) : null;
  const breakEnd = workingHour.breakEnd ? timeToMinutes(workingHour.breakEnd) : null;

  const slots: AvailabilitySlot[] = [];
  const now = new Date();

  for (let cursor = shiftStart; cursor + durationMinutes <= shiftEnd; cursor += slotMinutes) {
    const slotStart = new Date(dayStart);
    slotStart.setMinutes(cursor);
    const slotEnd = addMinutes(slotStart, durationMinutes);

    let available = true;
    let reason: string | undefined;

    if (slotStart < now) {
      available = false;
      reason = 'Horário passado';
    }

    if (available && breakStart !== null && breakEnd !== null) {
      if (cursor < breakEnd && cursor + durationMinutes > breakStart) {
        available = false;
        reason = 'Intervalo do profissional';
      }
    }

    if (available && timeOffs.some((t) => slotStart < t.endsAt && slotEnd > t.startsAt)) {
      available = false;
      reason = 'Ausência do profissional';
    }

    if (available && appointments.some((a) => slotStart < a.endsAt && slotEnd > a.startsAt)) {
      available = false;
      reason = 'Horário ocupado';
    }

    slots.push({
      startsAt: slotStart,
      endsAt: slotEnd,
      time: minutesToTime(cursor),
      available,
      reason,
    });
  }

  return slots;
}

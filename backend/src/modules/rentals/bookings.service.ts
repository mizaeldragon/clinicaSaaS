import {
  PaymentStatus,
  Prisma,
  RentalBookingKind,
  RentalBookingStatus,
  TransactionOrigin,
  TransactionType,
} from '@prisma/client';
import { prisma, TxClient } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ScheduleConflictError,
} from '../../shared/errors/AppError';
import { getPagination, paginated } from '../../shared/utils/http';
import { endOfDay, startOfDay, timeToMinutes } from '../../shared/utils/datetime';
import { SOCKET_EVENTS, emitToCompany } from '../../websocket/io';
import { logger } from '../../shared/utils/logger';
import { shiftsService } from '../shifts/shifts.service';
import type { CreateBookingDTO, ListBookingsDTO, PayBookingDTO, UpdateBookingDTO } from './bookings.schema';

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

/** Reservas que efetivamente ocupam o espaço. */
export const OCCUPYING_STATUSES: RentalBookingStatus[] = [
  RentalBookingStatus.RESERVED,
  RentalBookingStatus.CONFIRMED,
];

const BOOKING_INCLUDE = {
  resource: { select: { id: true, name: true, category: { select: { id: true, name: true } } } },
  professional: { select: { id: true, name: true, color: true, avatarUrl: true, phone: true } },
  shift: { select: { id: true, name: true, startsAt: true, endsAt: true } },
} satisfies Prisma.RentalBookingInclude;

/** Constrói o intervalo real da reserva a partir do turno ou do expediente do dia. */
async function resolveInterval(
  date: Date,
  kind: RentalBookingKind,
  shiftId: string | null,
  client: TxClient = prisma,
): Promise<{ startsAt: Date; endsAt: Date }> {
  const day = startOfDay(date);

  if (kind === RentalBookingKind.SHIFT) {
    if (!shiftId) throw new BadRequestError('Informe o turno');
    const shift = await client.shift.findFirst({ where: { id: shiftId } });
    if (!shift) throw new NotFoundError('Turno');

    const startsAt = new Date(day);
    startsAt.setMinutes(timeToMinutes(shift.startsAt));
    const endsAt = new Date(day);
    endsAt.setMinutes(timeToMinutes(shift.endsAt));

    return { startsAt, endsAt };
  }

  // Diária: cobre todo o expediente da empresa naquele dia.
  const businessHour = await client.businessHour.findFirst({ where: { weekday: day.getDay() } });
  const startsAt = new Date(day);
  startsAt.setMinutes(timeToMinutes(businessHour?.opensAt ?? '08:00'));
  const endsAt = new Date(day);
  endsAt.setMinutes(timeToMinutes(businessHour?.closesAt ?? '20:00'));

  return { startsAt, endsAt };
}

/** Teto defensivo: um período de locação não passa de um ano. */
const MAX_DAYS = 366;

/**
 * Expande o pedido em (dia, turno). É aqui que "só terça", "essa semana",
 * "seg a sex o mês inteiro" e "manhã e tarde todo dia" viram a mesma coisa.
 */
function expandSlots(dto: CreateBookingDTO): { date: Date; shiftId: string | null }[] {
  const start = startOfDay(dto.date);
  const end = dto.until ? startOfDay(dto.until) : start;

  if (end < start) {
    throw new BadRequestError('O fim do período não pode ser antes do início');
  }

  const shiftIds: (string | null)[] =
    dto.kind === RentalBookingKind.SHIFT
      ? dto.shiftIds?.length
        ? [...new Set(dto.shiftIds)]
        : [dto.shiftId ?? null]
      : [null];

  const weekdays = dto.weekdays?.length ? new Set(dto.weekdays) : null;
  const slots: { date: Date; shiftId: string | null }[] = [];

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (weekdays && !weekdays.has(cursor.getDay())) continue;

    for (const shiftId of shiftIds) {
      slots.push({ date: startOfDay(cursor), shiftId });
    }

    if (slots.length > MAX_DAYS * shiftIds.length) {
      throw new BadRequestError('Período longo demais. Divida em partes de até um ano.');
    }
  }

  if (slots.length === 0) {
    throw new BadRequestError('Nenhum dia do período bate com os dias da semana escolhidos');
  }

  return slots;
}

export const bookingsService = {
  async list(query: ListBookingsDTO) {
    const pagination = getPagination(query);

    const where: Prisma.RentalBookingWhereInput = {
      ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: startOfDay(query.from) } : {}),
              ...(query.to ? { lte: endOfDay(query.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total, totals] = await Promise.all([
      prisma.rentalBooking.findMany({
        where,
        orderBy: [{ date: 'desc' }, { startsAt: 'asc' }],
        skip: pagination.skip,
        take: pagination.take,
        include: BOOKING_INCLUDE,
      }),
      prisma.rentalBooking.count({ where }),
      prisma.rentalBooking.groupBy({
        by: ['paymentStatus'],
        where: { ...where, status: { not: 'CANCELED' } },
        _sum: { price: true, paidAmount: true },
      }),
    ]);

    return {
      ...paginated(data, total, pagination),
      totals: totals.map((t) => ({
        status: t.paymentStatus,
        amount: num(t._sum.price),
        paidAmount: num(t._sum.paidAmount),
      })),
    };
  },

  async get(id: string) {
    const booking = await prisma.rentalBooking.findFirst({
      where: { id },
      include: { ...BOOKING_INCLUDE, rental: { select: { id: true, renterName: true } } },
    });
    if (!booking) throw new NotFoundError('Reserva');
    return booking;
  },

  /**
   * Reserva um espaço para uma profissional em um dia/turno.
   * Recusa se o espaço já estiver ocupado no período.
   */
  async create(companyId: string, dto: CreateBookingDTO, rentalId?: string) {
    const [resource, professional] = await Promise.all([
      prisma.resource.findFirst({ where: { id: dto.resourceId } }),
      prisma.professional.findFirst({ where: { id: dto.professionalId } }),
    ]);

    if (!resource) throw new NotFoundError('Espaço');
    if (!professional) throw new NotFoundError('Profissional');
    if (!resource.isRentable) {
      throw new BadRequestError(`O espaço "${resource.name}" não está marcado como locável`);
    }
    if (resource.status === 'MAINTENANCE' || resource.status === 'INACTIVE') {
      throw new ConflictError(`O espaço "${resource.name}" está indisponível`);
    }

    const slots = expandSlots(dto);

    const created = [];
    const skipped: { date: Date; reason: string }[] = [];

    for (const slot of slots) {
      const { startsAt, endsAt } = await resolveInterval(slot.date, dto.kind, slot.shiftId);

      const conflict = await this.findConflict({
        resourceId: dto.resourceId,
        professionalId: dto.professionalId,
        startsAt,
        endsAt,
      });

      if (conflict) {
        // Em série, um dia ocupado não deve derrubar os outros.
        if (slots.length > 1) {
          skipped.push({ date: slot.date, reason: conflict });
          continue;
        }
        throw new ScheduleConflictError(conflict);
      }

      // Cada turno tem o seu preço: a noite pode custar menos que a manhã.
      const price = dto.price ?? (await shiftsService.resolvePrice(dto.resourceId, slot.shiftId));

      created.push(
        await prisma.rentalBooking.create({
          data: {
            companyId,
            resourceId: dto.resourceId,
            professionalId: dto.professionalId,
            rentalId: rentalId ?? null,
            shiftId: dto.kind === RentalBookingKind.SHIFT ? slot.shiftId : null,
            kind: dto.kind,
            date: slot.date,
            startsAt,
            endsAt,
            price,
            notes: dto.notes ?? null,
          },
          include: BOOKING_INCLUDE,
        }),
      );
    }

    if (created.length > 0) {
      emitToCompany(companyId, SOCKET_EVENTS.rentalPaymentUpdated, { bookings: created.length });
    }

    return { created, skipped };
  },

  /**
   * Simula o pedido sem gravar nada: quais dias entram, quais estão ocupados e
   * quanto dá no total. É o que permite fechar "o mês inteiro" com o valor na
   * frente, em vez de descobrir depois de criar 22 reservas.
   */
  async preview(dto: CreateBookingDTO) {
    const slots = expandSlots(dto);

    const shifts = await prisma.shift.findMany({ select: { id: true, name: true } });
    const nameOf = (shiftId: string | null) =>
      shiftId ? shifts.find((shift) => shift.id === shiftId)?.name ?? 'Turno' : 'Diária';

    const days: {
      date: Date;
      shiftId: string | null;
      shift: string;
      price: number;
      available: boolean;
      reason: string | null;
    }[] = [];

    for (const slot of slots) {
      const { startsAt, endsAt } = await resolveInterval(slot.date, dto.kind, slot.shiftId);
      const conflict = await this.findConflict({
        resourceId: dto.resourceId,
        professionalId: dto.professionalId,
        startsAt,
        endsAt,
      });

      const price = dto.price ?? (await shiftsService.resolvePrice(dto.resourceId, slot.shiftId));

      days.push({
        date: slot.date,
        shiftId: slot.shiftId,
        shift: nameOf(slot.shiftId),
        price,
        available: !conflict,
        reason: conflict,
      });
    }

    const free = days.filter((day) => day.available);

    return {
      days,
      total: days.length,
      available: free.length,
      blocked: days.length - free.length,
      amount: free.reduce((sum, day) => sum + day.price, 0),
    };
  },

  /** Retorna a descrição do conflito, ou null quando o período está livre. */
  async findConflict(target: {
    resourceId: string;
    professionalId?: string;
    startsAt: Date;
    endsAt: Date;
    ignoreId?: string;
  }): Promise<string | null> {
    const overlap = {
      status: { in: OCCUPYING_STATUSES },
      startsAt: { lt: target.endsAt },
      endsAt: { gt: target.startsAt },
      ...(target.ignoreId ? { id: { not: target.ignoreId } } : {}),
    };

    const sameResource = await prisma.rentalBooking.findFirst({
      where: { ...overlap, resourceId: target.resourceId },
      include: BOOKING_INCLUDE,
    });

    if (sameResource) {
      return `O espaço "${sameResource.resource.name}" já está reservado para ${sameResource.professional.name} neste turno`;
    }

    if (target.professionalId) {
      const sameProfessional = await prisma.rentalBooking.findFirst({
        where: { ...overlap, professionalId: target.professionalId },
        include: BOOKING_INCLUDE,
      });

      if (sameProfessional) {
        return `${sameProfessional.professional.name} já tem o espaço "${sameProfessional.resource.name}" reservado neste turno`;
      }
    }

    return null;
  },

  async update(companyId: string, id: string, dto: UpdateBookingDTO) {
    const booking = await this.get(id);

    // Cancelar libera o espaço e os agendamentos daquele turno perdem o respaldo.
    const updated = await prisma.rentalBooking.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: BOOKING_INCLUDE,
    });

    if (dto.status === 'CANCELED' && booking.paymentStatus === 'PENDING') {
      await prisma.rentalBooking.update({
        where: { id },
        data: { paymentStatus: PaymentStatus.CANCELED },
      });
    }

    emitToCompany(companyId, SOCKET_EVENTS.rentalPaymentUpdated, { bookingId: id });
    return updated;
  },

  async remove(id: string) {
    const booking = await this.get(id);
    if (num(booking.paidAmount) > 0) {
      throw new ConflictError('Esta reserva já tem pagamento registrado. Cancele-a em vez de excluir.');
    }
    return prisma.rentalBooking.delete({ where: { id } });
  },

  /** Registra o pagamento do turno e lança a receita de aluguel no financeiro. */
  async pay(companyId: string, id: string, dto: PayBookingDTO) {
    const booking = await this.get(id);

    const total = num(booking.price);
    const newPaid = num(booking.paidAmount) + dto.amount;

    if (newPaid > total + 0.001) {
      throw new BadRequestError(
        `Valor excede o saldo em aberto (R$ ${(total - num(booking.paidAmount)).toFixed(2)})`,
      );
    }

    const status = newPaid >= total - 0.001 ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.rentalBooking.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          paymentStatus: status,
          paymentMethod: dto.paymentMethod,
          paidAt: status === PaymentStatus.PAID ? dto.paidAt : null,
        },
        include: BOOKING_INCLUDE,
      });

      const existing = await tx.financialTransaction.findFirst({ where: { rentalBookingId: id } });
      const description = `Aluguel de turno — ${result.resource.name} (${result.professional.name})`;

      if (existing) {
        await tx.financialTransaction.update({
          where: { id: existing.id },
          data: {
            paidAmount: newPaid,
            paymentStatus: status,
            paymentMethod: dto.paymentMethod,
            paidAt: status === PaymentStatus.PAID ? dto.paidAt : null,
          },
        });
      } else {
        await tx.financialTransaction.create({
          data: {
            companyId,
            type: TransactionType.INCOME,
            origin: TransactionOrigin.RENTAL,
            description,
            amount: total,
            paidAmount: newPaid,
            paymentMethod: dto.paymentMethod,
            paymentStatus: status,
            competenceDate: booking.date,
            paidAt: status === PaymentStatus.PAID ? dto.paidAt : null,
            rentalBookingId: id,
          },
        });
      }

      return result;
    });

    emitToCompany(companyId, SOCKET_EVENTS.financialUpdated, { bookingId: id });
    return updated;
  },

  /**
   * Mapa de ocupação de um dia: cada espaço locável com os turnos e quem está neles.
   * É a tela que a dona do espaço abre para saber quem trabalha hoje.
   */
  async dayMap(date: Date, resourceId?: string) {
    const day = startOfDay(date);

    const [resources, shifts, bookings] = await Promise.all([
      prisma.resource.findMany({
        where: { isRentable: true, isActive: true, ...(resourceId ? { id: resourceId } : {}) },
        orderBy: { name: 'asc' },
        include: { category: { select: { id: true, name: true } } },
      }),
      prisma.shift.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.rentalBooking.findMany({
        where: { date: day, status: { in: OCCUPYING_STATUSES } },
        include: BOOKING_INCLUDE,
      }),
    ]);

    return {
      date: day,
      shifts,
      resources: resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        category: resource.category,
        daily: bookings.find((b) => b.resourceId === resource.id && b.kind === 'DAILY') ?? null,
        shifts: shifts.map((shift) => ({
          shiftId: shift.id,
          booking: bookings.find((b) => b.resourceId === resource.id && b.shiftId === shift.id) ?? null,
        })),
      })),
    };
  },

  /**
   * Quem está trabalhando no espaço em um dia — base da página pública.
   * Inclui a equipe própria (que não depende de aluguel) e as locatárias do dia.
   */
  async professionalsOfTheDay(date: Date) {
    const day = startOfDay(date);

    const [bookings, ownStaff] = await Promise.all([
      prisma.rentalBooking.findMany({
        where: { date: day, status: { in: OCCUPYING_STATUSES } },
        include: BOOKING_INCLUDE,
      }),
      prisma.professional.findMany({
        where: { isActive: true, revenueOwner: 'COMPANY', publicBookingEnabled: true },
      }),
    ]);

    return { bookings, ownStaff };
  },

  /**
   * Job diário: gera as reservas dos contratos recorrentes de turno
   * ("toda terça e quinta de manhã") para os próximos `horizonDays` dias.
   */
  async generateFromContracts(horizonDays = 30) {
    return tenantContext.runAsSystem(async () => {
      const contracts = await prisma.rental.findMany({
        where: { status: 'ACTIVE', shiftId: { not: null } },
        select: {
          id: true,
          companyId: true,
          resourceId: true,
          professionalId: true,
          shiftId: true,
          weekdays: true,
          startsAt: true,
          endsAt: true,
          amount: true,
        },
      });

      let generated = 0;

      for (const contract of contracts) {
        if (!contract.professionalId || contract.weekdays.length === 0) continue;

        await tenantContext.run({ companyId: contract.companyId }, async () => {
          const horizon = new Date();
          horizon.setDate(horizon.getDate() + horizonDays);
          const limit = contract.endsAt && contract.endsAt < horizon ? contract.endsAt : horizon;

          const cursor = startOfDay(new Date());
          if (cursor < startOfDay(contract.startsAt)) cursor.setTime(startOfDay(contract.startsAt).getTime());

          while (cursor <= limit) {
            if (contract.weekdays.includes(cursor.getDay())) {
              const date = startOfDay(cursor);

              const exists = await prisma.rentalBooking.findFirst({
                where: { rentalId: contract.id, date },
              });

              if (!exists) {
                try {
                  const { startsAt, endsAt } = await resolveInterval(
                    date,
                    RentalBookingKind.SHIFT,
                    contract.shiftId,
                  );

                  const conflict = await bookingsService.findConflict({
                    resourceId: contract.resourceId,
                    professionalId: contract.professionalId!,
                    startsAt,
                    endsAt,
                  });

                  if (!conflict) {
                    await prisma.rentalBooking.create({
                      data: {
                        companyId: contract.companyId,
                        resourceId: contract.resourceId,
                        professionalId: contract.professionalId!,
                        rentalId: contract.id,
                        shiftId: contract.shiftId,
                        kind: RentalBookingKind.SHIFT,
                        date,
                        startsAt,
                        endsAt,
                        price: contract.amount,
                      },
                    });
                    generated += 1;
                  }
                } catch (error) {
                  logger.warn({ error, contractId: contract.id }, 'Falha ao gerar reserva de turno');
                }
              }
            }

            cursor.setDate(cursor.getDate() + 1);
          }
        });
      }

      return { contracts: contracts.length, generated };
    });
  },

  async stats(reference = new Date()) {
    const from = startOfDay(reference);
    const to = new Date(from);
    to.setDate(to.getDate() + 30);

    const [today, upcoming, pending, occupancy] = await Promise.all([
      prisma.rentalBooking.count({
        where: { date: from, status: { in: OCCUPYING_STATUSES } },
      }),
      prisma.rentalBooking.count({
        where: { date: { gt: from, lte: to }, status: { in: OCCUPYING_STATUSES } },
      }),
      prisma.rentalBooking.aggregate({
        where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] }, status: { not: 'CANCELED' } },
        _sum: { price: true, paidAmount: true },
        _count: true,
      }),
      prisma.rentalBooking.aggregate({
        where: {
          date: { gte: from, lte: to },
          status: { in: OCCUPYING_STATUSES },
        },
        _sum: { price: true },
      }),
    ]);

    return {
      bookingsToday: today,
      bookingsNext30Days: upcoming,
      pendingCount: pending._count,
      pendingAmount: num(pending._sum.price) - num(pending._sum.paidAmount),
      revenueNext30Days: num(occupancy._sum.price),
    };
  },
};

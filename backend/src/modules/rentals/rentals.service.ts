import {
  PaymentStatus,
  Prisma,
  RentalBillingCycle,
  RentalStatus,
  TransactionOrigin,
  TransactionType,
} from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/AppError';
import { getPagination, paginated } from '../../shared/utils/http';
import { addMonths, dueDateFor, startOfDay } from '../../shared/utils/datetime';
import { SOCKET_EVENTS, emitToCompany } from '../../websocket/io';
import { notificationsService } from '../notifications/notifications.service';
import { logger } from '../../shared/utils/logger';
import { bookingsService } from './bookings.service';
import { professionalsService } from '../professionals/professionals.service';
import { usersService } from '../users/users.service';
import type {
  CreateRenterDTO,
  CreateRentalDTO,
  ListPaymentsDTO,
  ListRentalsDTO,
  PayRentalDTO,
  UpdateRentalDTO,
} from './rentals.schema';

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

/** Chave do período de cobrança — garante idempotência via unique(rentalId, referenceMonth). */
function periodKey(cycle: RentalBillingCycle, date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  switch (cycle) {
    case 'MONTHLY':
      return `${y}-${m}`;
    case 'WEEKLY': {
      const firstDay = new Date(y, 0, 1);
      const week = Math.ceil(((date.getTime() - firstDay.getTime()) / 86400000 + firstDay.getDay() + 1) / 7);
      return `${y}-W${String(week).padStart(2, '0')}`;
    }
    case 'DAILY':
    case 'HOURLY':
      return `${y}-${m}-${d}`;
    default:
      return `${y}-${m}-${d}`;
  }
}

function nextOccurrence(cycle: RentalBillingCycle, from: Date): Date {
  const date = new Date(from);
  switch (cycle) {
    case 'MONTHLY':
      return addMonths(date, 1);
    case 'WEEKLY':
      date.setDate(date.getDate() + 7);
      return date;
    case 'DAILY':
      date.setDate(date.getDate() + 1);
      return date;
    case 'HOURLY':
      date.setHours(date.getHours() + 1);
      return date;
    default:
      return addMonths(date, 1);
  }
}

/**
 * Limpa a agenda quando um contrato deixa de valer.
 *
 * Um contrato de turno não é só cobrança: ele ocupa o espaço, e essa ocupação
 * vira reserva no quadro. Se o contrato sai e as reservas ficam, a grade mostra
 * a mesa ocupada por alguém que não aluga mais — e a dona deixa de vender um
 * turno que está livre.
 *
 * O que some é só o futuro e só o que ninguém pagou. O passado aconteceu (a
 * pessoa esteve lá), e turno pago é dinheiro que entrou, com lançamento no
 * caixa: apagar qualquer um dos dois seria reescrever história.
 *
 * Reserva avulsa, feita na mão pela grade, não tem contrato e não é tocada.
 */
async function limparReservasFuturas(rentalId: string): Promise<{ removidas: number; mantidas: number }> {
  const hoje = startOfDay(new Date());

  const [removiveis, mantidas] = await Promise.all([
    prisma.rentalBooking.findMany({
      where: { rentalId, date: { gte: hoje }, paidAmount: { lte: 0 } },
      select: { id: true },
    }),
    prisma.rentalBooking.count({
      where: { rentalId, OR: [{ date: { lt: hoje } }, { paidAmount: { gt: 0 } }] },
    }),
  ]);

  if (removiveis.length > 0) {
    await prisma.rentalBooking.deleteMany({ where: { id: { in: removiveis.map((r) => r.id) } } });
  }

  return { removidas: removiveis.length, mantidas };
}

/**
 * Dois contratos no mesmo espaço só brigam quando disputam o mesmo horário.
 *
 * A checagem antiga olhava só o recurso, e com isso impedia o que é a razão de
 * existir de um espaço compartilhado: alugar a mesma cadeira para a Ana de
 * manhã e para a Bia à tarde. O conflito exige coincidir turno *e* dia da
 * semana — e contrato sem turno, que toma o espaço inteiro, briga com todos.
 *
 * Mora fora do `create` porque editar um contrato muda exatamente os mesmos
 * campos: sem isso, bastava criar no turno da manhã e trocar para a tarde pelo
 * PATCH para passar por cima de quem já estava lá.
 */
async function assertSemConflitoDeContrato(alvo: {
  resourceId: string;
  resourceName: string;
  startsAt: Date;
  shiftId: string | null;
  weekdays: number[];
  ignorarId?: string;
}): Promise<void> {
  const vigentes = await prisma.rental.findMany({
    where: {
      resourceId: alvo.resourceId,
      status: { in: ['ACTIVE', 'OVERDUE'] },
      OR: [{ endsAt: null }, { endsAt: { gt: alvo.startsAt } }],
      ...(alvo.ignorarId ? { id: { not: alvo.ignorarId } } : {}),
    },
    select: { renterName: true, shiftId: true, weekdays: true },
  });

  const overlapping = vigentes.find((atual) => {
    // Um dos dois toma o espaço inteiro: não há como dividir.
    if (!atual.shiftId || !alvo.shiftId) return true;
    if (atual.shiftId !== alvo.shiftId) return false;

    // Mesmo turno: só conflita se cair no mesmo dia da semana. Lista vazia
    // significa "todo dia", e aí abrange qualquer outra.
    if (atual.weekdays.length === 0 || alvo.weekdays.length === 0) return true;
    return alvo.weekdays.some((dia) => atual.weekdays.includes(dia));
  });

  if (!overlapping) return;

  // A frase muda conforme quem atropela quem: sem isso, pedir o espaço inteiro
  // devolvia "já ocupado neste turno", e a pessoa ficava procurando um turno
  // que ela nem tinha escolhido.
  const detalhe = !alvo.shiftId
    ? 'em pelo menos um turno'
    : overlapping.shiftId
      ? 'neste turno e nestes dias'
      : 'para o espaço inteiro';

  throw new ConflictError(
    `O recurso "${alvo.resourceName}" já possui um contrato ativo ${detalhe} (${overlapping.renterName})`,
  );
}

export const rentalsService = {
  async list(query: ListRentalsDTO) {
    const pagination = getPagination(query);

    const where: Prisma.RentalWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(query.search ? { renterName: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.rental.findMany({
        where,
        orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
        include: {
          resource: { select: { id: true, name: true, category: { select: { name: true } } } },
          professional: { select: { id: true, name: true } },
          payments: {
            where: { status: { in: ['PENDING', 'PARTIAL'] } },
            orderBy: { dueDate: 'asc' },
            take: 3,
          },
          _count: { select: { payments: true } },
        },
      }),
      prisma.rental.count({ where }),
    ]);

    return paginated(data, total, pagination);
  },

  async get(id: string) {
    const rental = await prisma.rental.findFirst({
      where: { id },
      include: {
        resource: { include: { category: true } },
        professional: { select: { id: true, name: true, phone: true } },
        payments: { orderBy: { dueDate: 'desc' } },
      },
    });
    if (!rental) throw new NotFoundError('Contrato de aluguel');
    return rental;
  },

  async create(companyId: string, dto: CreateRentalDTO) {
    const resource = await prisma.resource.findFirst({ where: { id: dto.resourceId } });
    if (!resource) throw new NotFoundError('Recurso');

    await assertSemConflitoDeContrato({
      resourceId: dto.resourceId,
      resourceName: resource.name,
      startsAt: dto.startsAt,
      shiftId: dto.shiftId ?? null,
      weekdays: dto.weekdays ?? [],
    });

    const { generateFirstCharge, ...data } = dto;

    const rental = await prisma.rental.create({
      data: {
        ...data,
        companyId,
        dueDay: data.dueDay ?? (data.billingCycle === 'MONTHLY' ? data.startsAt.getDate() : null),
      } as Prisma.RentalUncheckedCreateInput,
      include: { resource: { select: { name: true } } },
    });

    await prisma.resource.update({ where: { id: dto.resourceId }, data: { status: 'IN_USE' } });

    // Contrato de turno recorrente ("toda terça de manhã") ocupa a agenda e é
    // cobrado por reserva; o contrato tradicional gera as parcelas periódicas.
    const isShiftContract = Boolean(rental.shiftId && rental.weekdays.length > 0);

    if (isShiftContract) {
      await bookingsService.generateFromContracts();
    } else if (generateFirstCharge) {
      await this.generateChargesForRental(companyId, rental.id);
    }

    emitToCompany(companyId, SOCKET_EVENTS.rentalPaymentUpdated, { rentalId: rental.id });
    return rental;
  },

  /**
   * Coloca uma locatária no espaço: cadastro, acesso e link, de uma vez.
   *
   * Eram três telas — profissional, usuário e contrato —, e a do meio ficava em
   * Configurações, longe de quem estava fazendo o aluguel. Quem aluga não existe
   * sem login: é por ele que ela enxerga a própria agenda e as próprias
   * clientes. Então nascem juntos.
   *
   * O e-mail é conferido antes de qualquer escrita, e se o usuário falhar
   * mesmo assim a profissional recém-criada é desfeita — meia locatária, sem
   * acesso, é pior que nenhuma: ela apareceria na lista e no link público sem
   * ninguém conseguir entrar.
   */
  async createRenter(companyId: string, dto: CreateRenterDTO) {
    const duplicado = await tenantContext.runAsSystem(() =>
      prisma.user.findFirst({ where: { companyId, email: dto.email } }),
    );
    if (duplicado) {
      throw new ConflictError('Já existe um acesso com este e-mail nesta empresa');
    }

    const professional = await professionalsService.create(companyId, {
      name: dto.name,
      phone: dto.phone,
      specialties: dto.specialties ?? [],
      color: '#8B5CF6',
      revenueOwner: 'PROFESSIONAL',
      publicBookingEnabled: true,
    });

    try {
      const user = await usersService.create(companyId, {
        name: dto.name,
        email: dto.email,
        password: dto.password,
        phone: dto.phone,
        role: 'PROFESSIONAL',
        professionalId: professional.id,
      });

      logger.info({ companyId, professionalId: professional.id }, 'Locatária criada com acesso');
      return { professional, user };
    } catch (error) {
      await prisma.professional
        .delete({ where: { id: professional.id } })
        .catch(() => undefined);
      throw error;
    }
  },

  async update(companyId: string, id: string, dto: UpdateRentalDTO) {
    const current = await this.get(id);

    // Trocar turno ou dias é remarcar o espaço: passa pela mesma porta da
    // criação, ignorando o próprio contrato na conta.
    const mexeNoHorario = dto.shiftId !== undefined || dto.weekdays !== undefined;
    if (mexeNoHorario && current.status === 'ACTIVE') {
      await assertSemConflitoDeContrato({
        resourceId: current.resourceId,
        resourceName: current.resource.name,
        startsAt: current.startsAt,
        shiftId: dto.shiftId !== undefined ? dto.shiftId : current.shiftId,
        weekdays: dto.weekdays ?? current.weekdays,
        ignorarId: id,
      });
    }

    const rental = await prisma.rental.update({ where: { id }, data: dto });

    // Encerrar/cancelar libera o recurso, cancela o que estava por cobrar e
    // devolve à grade os turnos que este contrato ainda ocupava adiante.
    if (dto.status && ['ENDED', 'CANCELED'].includes(dto.status) && current.status === 'ACTIVE') {
      await prisma.resource.update({ where: { id: current.resourceId }, data: { status: 'AVAILABLE' } });
      await prisma.rentalPayment.updateMany({
        where: { rentalId: id, status: 'PENDING' },
        data: { status: PaymentStatus.CANCELED },
      });

      const limpeza = await limparReservasFuturas(id);
      if (limpeza.removidas > 0) {
        logger.info({ rentalId: id, ...limpeza }, 'Contrato encerrado — turnos futuros liberados');
      }
    }

    emitToCompany(companyId, SOCKET_EVENTS.rentalPaymentUpdated, { rentalId: id });
    return rental;
  },

  async remove(id: string) {
    const rental = await this.get(id);
    const paid = await prisma.rentalPayment.count({ where: { rentalId: id, status: 'PAID' } });
    if (paid > 0) {
      throw new ConflictError(
        'Este contrato possui pagamentos registrados. Encerre-o em vez de excluir.',
      );
    }
    await prisma.rentalPayment.deleteMany({ where: { rentalId: id } });

    // Antes de apagar o contrato: as reservas dele saem da grade. Depois do
    // delete não haveria como encontrá-las — o vínculo vira nulo e elas
    // passariam por reservas avulsas, ocupando o espaço para sempre.
    const limpeza = await limparReservasFuturas(id);

    await prisma.resource.update({ where: { id: rental.resourceId }, data: { status: 'AVAILABLE' } });
    const removido = await prisma.rental.delete({ where: { id } });

    logger.info({ rentalId: id, ...limpeza }, 'Contrato excluído — turnos futuros liberados');

    return removido;
  },

  // ------------------------------------------------------------ pagamentos
  async listPayments(query: ListPaymentsDTO) {
    const pagination = getPagination(query);

    const where: Prisma.RentalPaymentWhereInput = {
      ...(query.rentalId ? { rentalId: query.rentalId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            dueDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    const [data, total, totals] = await Promise.all([
      prisma.rentalPayment.findMany({
        where,
        orderBy: { dueDate: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          rental: {
            select: {
              id: true,
              renterName: true,
              resource: { select: { name: true } },
            },
          },
        },
      }),
      prisma.rentalPayment.count({ where }),
      prisma.rentalPayment.groupBy({ by: ['status'], where, _sum: { amount: true, paidAmount: true } }),
    ]);

    return {
      ...paginated(data, total, pagination),
      totals: totals.map((t) => ({
        status: t.status,
        amount: num(t._sum.amount),
        paidAmount: num(t._sum.paidAmount),
      })),
    };
  },

  async pay(companyId: string, paymentId: string, dto: PayRentalDTO) {
    const payment = await prisma.rentalPayment.findFirst({
      where: { id: paymentId },
      include: { rental: { include: { resource: { select: { name: true } } } } },
    });
    if (!payment) throw new NotFoundError('Cobrança');

    const total = num(payment.amount);
    const newPaid = num(payment.paidAmount) + dto.amount;
    if (newPaid > total + 0.001) {
      throw new BadRequestError(
        `Valor excede o saldo em aberto (R$ ${(total - num(payment.paidAmount)).toFixed(2)})`,
      );
    }

    const status = newPaid >= total - 0.001 ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.rentalPayment.update({
        where: { id: paymentId },
        data: {
          paidAmount: newPaid,
          status,
          paymentMethod: dto.paymentMethod,
          paidAt: status === PaymentStatus.PAID ? dto.paidAt : null,
        },
      });

      // Espelha no financeiro como receita de aluguel.
      const existing = await tx.financialTransaction.findFirst({
        where: { rentalPaymentId: paymentId },
      });

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
            description: `Aluguel — ${payment.rental.resource.name} (${payment.rental.renterName})`,
            amount: total,
            paidAmount: newPaid,
            paymentMethod: dto.paymentMethod,
            paymentStatus: status,
            dueDate: payment.dueDate,
            paidAt: status === PaymentStatus.PAID ? dto.paidAt : null,
            competenceDate: payment.dueDate,
            rentalPaymentId: paymentId,
          },
        });
      }

      // Contrato deixa de estar atrasado se não há mais pendências vencidas.
      const stillOverdue = await tx.rentalPayment.count({
        where: {
          rentalId: payment.rentalId,
          status: { in: ['PENDING', 'PARTIAL'] },
          dueDate: { lt: startOfDay(new Date()) },
        },
      });

      if (stillOverdue === 0 && payment.rental.status === RentalStatus.OVERDUE) {
        await tx.rental.update({ where: { id: payment.rentalId }, data: { status: RentalStatus.ACTIVE } });
      }

      return result;
    });

    emitToCompany(companyId, SOCKET_EVENTS.rentalPaymentUpdated, {
      rentalId: payment.rentalId,
      paymentId,
    });

    return updated;
  },

  /**
   * Gera as cobranças futuras de um contrato até `horizonDays` à frente.
   * Idempotente: a unique (rentalId, referenceMonth) evita duplicidade.
   */
  async generateChargesForRental(companyId: string, rentalId: string, horizonDays = 40) {
    const rental = await prisma.rental.findFirst({ where: { id: rentalId } });
    if (!rental || rental.status !== 'ACTIVE') return [];
    if (rental.billingCycle === 'CUSTOM') return [];

    const horizon = new Date();
    horizon.setDate(horizon.getDate() + horizonDays);

    const limit = rental.endsAt && rental.endsAt < horizon ? rental.endsAt : horizon;
    const created: string[] = [];

    let cursor = new Date(rental.startsAt);
    let guard = 0;

    while (cursor <= limit && guard < 400) {
      guard += 1;

      const dueDate =
        rental.billingCycle === 'MONTHLY' && rental.dueDay
          ? dueDateFor(cursor.getFullYear(), cursor.getMonth(), rental.dueDay)
          : new Date(cursor);

      if (dueDate >= rental.startsAt && dueDate <= limit) {
        const reference = periodKey(rental.billingCycle, dueDate);

        const exists = await prisma.rentalPayment.findFirst({
          where: { rentalId: rental.id, referenceMonth: reference },
        });

        if (!exists) {
          const payment = await prisma.rentalPayment.create({
            data: {
              companyId,
              rentalId: rental.id,
              referenceMonth: reference,
              dueDate,
              amount: rental.amount,
            },
          });
          created.push(payment.id);
        }
      }

      cursor = nextOccurrence(rental.billingCycle, cursor);
    }

    if (created.length > 0) {
      await prisma.rental.update({
        where: { id: rental.id },
        data: { lastGeneratedAt: new Date() },
      });
    }

    return created;
  },

  /** Job diário: gera cobranças de todos os contratos ativos de todas as empresas. */
  async generateAllCharges() {
    return tenantContext.runAsSystem(async () => {
      const rentals = await prisma.rental.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, companyId: true },
      });

      let total = 0;
      for (const rental of rentals) {
        try {
          const created = await tenantContext.run({ companyId: rental.companyId }, () =>
            rentalsService.generateChargesForRental(rental.companyId, rental.id),
          );
          total += created.length;
        } catch (error) {
          logger.warn({ error, rentalId: rental.id }, 'Falha ao gerar cobrança de aluguel');
        }
      }

      return { rentals: rentals.length, charges: total };
    });
  },

  /** Job diário: marca cobranças e contratos atrasados e notifica. */
  async markOverdue() {
    return tenantContext.runAsSystem(async () => {
      const today = startOfDay(new Date());

      const overduePayments = await prisma.rentalPayment.findMany({
        where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: today } },
        include: { rental: { include: { resource: { select: { name: true } } } } },
      });

      const rentalIds = [...new Set(overduePayments.map((p) => p.rentalId))];

      if (rentalIds.length > 0) {
        await prisma.rental.updateMany({
          where: { id: { in: rentalIds }, status: 'ACTIVE' },
          data: { status: RentalStatus.OVERDUE },
        });
      }

      for (const payment of overduePayments) {
        await notificationsService.notifyEvent(payment.companyId, 'PAYMENT_OVERDUE', {
          title: 'Aluguel em atraso',
          message: `${payment.rental.renterName} — ${payment.rental.resource.name} (venc. ${payment.dueDate.toLocaleDateString('pt-BR')})`,
          data: { rentalId: payment.rentalId, paymentId: payment.id },
        });
      }

      return { overdue: overduePayments.length, rentals: rentalIds.length };
    });
  },

  async stats() {
    const today = startOfDay(new Date());
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);

    const [active, overdue, pending, upcoming, monthlyRevenue] = await Promise.all([
      prisma.rental.count({ where: { status: 'ACTIVE' } }),
      prisma.rental.count({ where: { status: 'OVERDUE' } }),
      prisma.rentalPayment.aggregate({
        where: { status: { in: ['PENDING', 'PARTIAL'] } },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),
      prisma.rentalPayment.findMany({
        where: {
          status: { in: ['PENDING', 'PARTIAL'] },
          dueDate: { gte: today, lte: in7Days },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
        include: { rental: { select: { renterName: true, resource: { select: { name: true } } } } },
      }),
      prisma.rental.aggregate({
        where: { status: { in: ['ACTIVE', 'OVERDUE'] }, billingCycle: 'MONTHLY' },
        _sum: { amount: true },
      }),
    ]);

    return {
      activeRentals: active,
      overdueRentals: overdue,
      pendingCount: pending._count,
      pendingAmount: num(pending._sum.amount) - num(pending._sum.paidAmount),
      monthlyRecurringRevenue: num(monthlyRevenue._sum.amount),
      upcoming,
    };
  },
};

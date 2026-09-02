import { PaymentStatus, Prisma, TransactionOrigin, TransactionType } from '@prisma/client';
import { prisma, TxClient } from '../../shared/database/prisma';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import { getPagination, paginated } from '../../shared/utils/http';
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from '../../shared/utils/datetime';
import { SOCKET_EVENTS, emitToCompany } from '../../websocket/io';
import type {
  CreateTransactionDTO,
  DashboardQueryDTO,
  ExpenseCategoryDTO,
  ListTransactionsDTO,
  PayTransactionDTO,
  UpdateTransactionDTO,
} from './financial.schema';

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

export const financialService = {
  async list(query: ListTransactionsDTO) {
    const pagination = getPagination(query);
    const where: Prisma.FinancialTransactionWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.origin ? { origin: query.origin } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.search ? { description: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.from || query.to
        ? {
            competenceDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    const [data, total, totals] = await Promise.all([
      prisma.financialTransaction.findMany({
        where,
        orderBy: [{ competenceDate: 'desc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
        include: {
          category: { select: { id: true, name: true, color: true } },
          customer: { select: { id: true, name: true } },
          appointment: { select: { id: true, startsAt: true } },
        },
      }),
      prisma.financialTransaction.count({ where }),
      prisma.financialTransaction.groupBy({
        by: ['type'],
        where,
        _sum: { amount: true, paidAmount: true },
      }),
    ]);

    const income = totals.find((t) => t.type === 'INCOME');
    const expense = totals.find((t) => t.type === 'EXPENSE');

    return {
      ...paginated(data, total, pagination),
      totals: {
        income: num(income?._sum.amount),
        incomeReceived: num(income?._sum.paidAmount),
        expense: num(expense?._sum.amount),
        expensePaid: num(expense?._sum.paidAmount),
      },
    };
  },

  async get(id: string) {
    const transaction = await prisma.financialTransaction.findFirst({
      where: { id },
      include: { category: true, customer: true, appointment: true, rentalPayment: true },
    });
    if (!transaction) throw new NotFoundError('Lançamento');
    return transaction;
  },

  async create(companyId: string, dto: CreateTransactionDTO, userId?: string) {
    if (dto.type === TransactionType.EXPENSE && dto.customerId) {
      throw new BadRequestError('Despesas não podem ser vinculadas a um cliente');
    }

    const paidAmount =
      dto.paymentStatus === PaymentStatus.PAID ? dto.paidAmount || dto.amount : dto.paidAmount;

    const transaction = await prisma.financialTransaction.create({
      data: {
        ...dto,
        companyId,
        paidAmount,
        paidAt: dto.paymentStatus === PaymentStatus.PAID ? dto.paidAt ?? new Date() : dto.paidAt,
        createdById: userId ?? null,
      } as Prisma.FinancialTransactionUncheckedCreateInput,
    });

    emitToCompany(companyId, SOCKET_EVENTS.financialUpdated, { id: transaction.id });
    return transaction;
  },

  async update(companyId: string, id: string, dto: UpdateTransactionDTO) {
    await this.get(id);
    const transaction = await prisma.financialTransaction.update({ where: { id }, data: dto });
    emitToCompany(companyId, SOCKET_EVENTS.financialUpdated, { id });
    return transaction;
  },

  async remove(id: string) {
    await this.get(id);
    return prisma.financialTransaction.delete({ where: { id } });
  },

  /** Registra um pagamento (total ou parcial) em um lançamento. */
  async pay(companyId: string, id: string, dto: PayTransactionDTO) {
    const transaction = await this.get(id);
    const alreadyPaid = num(transaction.paidAmount);
    const total = num(transaction.amount);
    const newPaid = alreadyPaid + dto.amount;

    if (newPaid > total + 0.001) {
      throw new BadRequestError(
        `Valor excede o saldo em aberto (R$ ${(total - alreadyPaid).toFixed(2)})`,
      );
    }

    const status: PaymentStatus =
      newPaid >= total - 0.001 ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

    const updated = await prisma.financialTransaction.update({
      where: { id },
      data: {
        paidAmount: newPaid,
        paymentStatus: status,
        paymentMethod: dto.paymentMethod,
        paidAt: status === PaymentStatus.PAID ? dto.paidAt : transaction.paidAt,
      },
    });

    emitToCompany(companyId, SOCKET_EVENTS.financialUpdated, { id });
    return updated;
  },

  /**
   * Cria a receita correspondente a um atendimento finalizado.
   * Chamada dentro da transação que finaliza o agendamento.
   */
  async registerAppointmentIncome(
    tx: TxClient,
    companyId: string,
    appointment: { id: string; customerId: string; totalPrice: Prisma.Decimal | number; startsAt: Date; customer?: { name: string } },
    payment?: { method: import('@prisma/client').PaymentMethod; amount?: number; paid: boolean },
    userId?: string,
  ) {
    const existing = await tx.financialTransaction.findFirst({
      where: { appointmentId: appointment.id, type: TransactionType.INCOME },
    });
    if (existing) return existing;

    const total = num(appointment.totalPrice);
    const paidAmount = payment?.paid ? payment.amount ?? total : 0;
    const status: PaymentStatus =
      paidAmount >= total - 0.001 && total > 0
        ? PaymentStatus.PAID
        : paidAmount > 0
          ? PaymentStatus.PARTIAL
          : PaymentStatus.PENDING;

    return tx.financialTransaction.create({
      data: {
        companyId,
        type: TransactionType.INCOME,
        origin: TransactionOrigin.APPOINTMENT,
        description: `Atendimento — ${appointment.customer?.name ?? 'cliente'}`,
        amount: total,
        paidAmount,
        paymentMethod: payment?.method ?? null,
        paymentStatus: status,
        paidAt: status === PaymentStatus.PAID ? new Date() : null,
        competenceDate: appointment.startsAt,
        customerId: appointment.customerId,
        appointmentId: appointment.id,
        createdById: userId ?? null,
      },
    });
  },

  /** Dashboard financeiro: dia, mês, pendências e próximos vencimentos. */
  async dashboard(query: DashboardQueryDTO) {
    const now = new Date();
    const from = query.from ?? startOfMonth(now);
    const to = query.to ?? endOfMonth(now);

    const [
      monthIncome,
      monthExpense,
      todayIncome,
      pendingIncome,
      pendingExpense,
      upcoming,
      byMethod,
      byCategory,
      dailySeries,
    ] = await Promise.all([
      prisma.financialTransaction.aggregate({
        where: { type: 'INCOME', competenceDate: { gte: from, lte: to } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.financialTransaction.aggregate({
        where: { type: 'EXPENSE', competenceDate: { gte: from, lte: to } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.financialTransaction.aggregate({
        where: {
          type: 'INCOME',
          competenceDate: { gte: startOfDay(now), lte: endOfDay(now) },
        },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.financialTransaction.aggregate({
        where: { type: 'INCOME', paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.financialTransaction.aggregate({
        where: { type: 'EXPENSE', paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.financialTransaction.findMany({
        where: {
          paymentStatus: { in: ['PENDING', 'PARTIAL'] },
          dueDate: { gte: startOfDay(now) },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
        include: { category: { select: { name: true, color: true } } },
      }),
      prisma.financialTransaction.groupBy({
        by: ['paymentMethod'],
        where: { type: 'INCOME', competenceDate: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.financialTransaction.groupBy({
        by: ['categoryId'],
        where: { type: 'EXPENSE', competenceDate: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.$queryRaw<{ day: Date; type: string; total: Prisma.Decimal }[]>`
        SELECT date_trunc('day', "competenceDate") AS day, "type", SUM("amount") AS total
        FROM "financial_transactions"
        WHERE "companyId" = ${await currentCompanyId()}
          AND "competenceDate" BETWEEN ${from} AND ${to}
        GROUP BY 1, 2
        ORDER BY 1 ASC
      `,
    ]);

    const categories = await prisma.expenseCategory.findMany();
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));

    const income = num(monthIncome._sum.amount);
    const expense = num(monthExpense._sum.amount);

    return {
      period: { from, to },
      today: {
        income: num(todayIncome._sum.amount),
        received: num(todayIncome._sum.paidAmount),
      },
      month: {
        income,
        incomeReceived: num(monthIncome._sum.paidAmount),
        expense,
        expensePaid: num(monthExpense._sum.paidAmount),
        profit: income - expense,
        margin: income > 0 ? ((income - expense) / income) * 100 : 0,
      },
      pending: {
        toReceive: num(pendingIncome._sum.amount) - num(pendingIncome._sum.paidAmount),
        toPay: num(pendingExpense._sum.amount) - num(pendingExpense._sum.paidAmount),
      },
      upcoming,
      byPaymentMethod: byMethod.map((m) => ({
        method: m.paymentMethod ?? 'NOT_INFORMED',
        total: num(m._sum.amount),
      })),
      byExpenseCategory: byCategory.map((c) => ({
        categoryId: c.categoryId,
        name: c.categoryId ? (categoryName.get(c.categoryId) ?? 'Sem categoria') : 'Sem categoria',
        total: num(c._sum.amount),
      })),
      dailySeries: dailySeries.map((d) => ({
        day: d.day,
        type: d.type,
        total: num(d.total),
      })),
    };
  },
};

export const expenseCategoriesService = {
  async list() {
    return prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } });
  },
  async create(companyId: string, dto: ExpenseCategoryDTO) {
    return prisma.expenseCategory.create({ data: { ...dto, companyId } });
  },
  async remove(id: string) {
    const category = await prisma.expenseCategory.findFirst({ where: { id } });
    if (!category) throw new NotFoundError('Categoria');
    await prisma.financialTransaction.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });
    return prisma.expenseCategory.delete({ where: { id } });
  },
};

/** O $queryRaw não passa pelo extension: a empresa é injetada manualmente. */
async function currentCompanyId(): Promise<string> {
  const { tenantContext } = await import('../../shared/database/tenantContext');
  const companyId = tenantContext.companyId;
  if (!companyId) throw new BadRequestError('Contexto de empresa ausente');
  return companyId;
}

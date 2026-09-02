import { prisma } from '../../shared/database/prisma';
import { endOfMonth, startOfMonth } from '../../shared/utils/datetime';
import { servicesService } from '../services/services.service';

function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

interface Period {
  from: Date;
  to: Date;
}

function resolvePeriod(period?: Partial<Period>): Period {
  const now = new Date();
  return {
    from: period?.from ?? startOfMonth(now),
    to: period?.to ?? endOfMonth(now),
  };
}

export const reportsService = {
  /** Visão geral de atendimentos: volume, ticket médio, taxa de cancelamento. */
  async appointments(period?: Partial<Period>) {
    const { from, to } = resolvePeriod(period);

    const [byStatus, completed, byWeekday] = await Promise.all([
      prisma.appointment.groupBy({
        by: ['status'],
        where: { startsAt: { gte: from, lte: to } },
        _count: { _all: true },
        _sum: { totalPrice: true },
      }),
      prisma.appointment.aggregate({
        where: { status: 'COMPLETED', startsAt: { gte: from, lte: to } },
        _sum: { totalPrice: true },
        _avg: { totalPrice: true },
        _count: true,
      }),
      prisma.appointment.findMany({
        where: { startsAt: { gte: from, lte: to } },
        select: { startsAt: true, status: true, totalPrice: true },
      }),
    ]);

    const total = byStatus.reduce((sum, s) => sum + s._count._all, 0);
    const canceled =
      (byStatus.find((s) => s.status === 'CANCELED')?._count._all ?? 0) +
      (byStatus.find((s) => s.status === 'NO_SHOW')?._count._all ?? 0);

    const weekdays = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      count: 0,
      revenue: 0,
    }));

    for (const appointment of byWeekday) {
      const bucket = weekdays[appointment.startsAt.getDay()];
      bucket.count += 1;
      if (appointment.status === 'COMPLETED') bucket.revenue += num(appointment.totalPrice);
    }

    return {
      period: { from, to },
      total,
      completed: completed._count,
      revenue: num(completed._sum.totalPrice),
      averageTicket: num(completed._avg.totalPrice),
      cancellationRate: total > 0 ? (canceled / total) * 100 : 0,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
        revenue: num(s._sum.totalPrice),
      })),
      byWeekday: weekdays,
    };
  },

  /** Desempenho por profissional. */
  async professionals(period?: Partial<Period>) {
    const { from, to } = resolvePeriod(period);

    const [grouped, professionals, commissions] = await Promise.all([
      prisma.appointment.groupBy({
        by: ['professionalId', 'status'],
        where: { startsAt: { gte: from, lte: to }, professionalId: { not: null } },
        _count: { _all: true },
        _sum: { totalPrice: true },
      }),
      prisma.professional.findMany({ select: { id: true, name: true, avatarUrl: true, color: true } }),
      prisma.commission.groupBy({
        by: ['professionalId'],
        where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELED' } },
        _sum: { amount: true },
      }),
    ]);

    return professionals
      .map((professional) => {
        const rows = grouped.filter((g) => g.professionalId === professional.id);
        const completed = rows.find((r) => r.status === 'COMPLETED');
        const canceled = rows
          .filter((r) => r.status === 'CANCELED' || r.status === 'NO_SHOW')
          .reduce((sum, r) => sum + r._count._all, 0);
        const totalCount = rows.reduce((sum, r) => sum + r._count._all, 0);

        return {
          professionalId: professional.id,
          name: professional.name,
          avatarUrl: professional.avatarUrl,
          color: professional.color,
          appointments: totalCount,
          completed: completed?._count._all ?? 0,
          canceled,
          revenue: num(completed?._sum.totalPrice),
          commissions: num(commissions.find((c) => c.professionalId === professional.id)?._sum.amount),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  },

  /** Serviços mais realizados e receita por serviço. */
  async services(period?: Partial<Period>) {
    const { from, to } = resolvePeriod(period);
    return {
      period: { from, to },
      top: await servicesService.topServices(from, to, 20),
    };
  },

  /** Clientes: novos, recorrentes e ranking por valor gasto. */
  async customers(period?: Partial<Period>) {
    const { from, to } = resolvePeriod(period);

    const [newCustomers, grouped] = await Promise.all([
      prisma.customer.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.appointment.groupBy({
        by: ['customerId'],
        where: { status: 'COMPLETED', startsAt: { gte: from, lte: to } },
        _sum: { totalPrice: true },
        _count: { _all: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 20,
      }),
    ]);

    const customers = await prisma.customer.findMany({
      where: { id: { in: grouped.map((g) => g.customerId) } },
      select: { id: true, name: true, phone: true },
    });

    const returning = grouped.filter((g) => g._count._all > 1).length;

    return {
      period: { from, to },
      newCustomers,
      activeCustomers: grouped.length,
      returningCustomers: returning,
      retentionRate: grouped.length > 0 ? (returning / grouped.length) * 100 : 0,
      top: grouped.map((g) => ({
        customerId: g.customerId,
        name: customers.find((c) => c.id === g.customerId)?.name ?? 'Cliente',
        visits: g._count._all,
        total: num(g._sum.totalPrice),
      })),
    };
  },

  /** Receitas x despesas mês a mês nos últimos 12 meses. */
  async financialEvolution() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const transactions = await prisma.financialTransaction.findMany({
      where: { competenceDate: { gte: from } },
      select: { competenceDate: true, type: true, amount: true },
    });

    const buckets = new Map<string, { month: string; income: number; expense: number }>();
    for (let i = 0; i < 12; i += 1) {
      const date = new Date(from.getFullYear(), from.getMonth() + i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { month: key, income: 0, expense: 0 });
    }

    for (const transaction of transactions) {
      const key = `${transaction.competenceDate.getFullYear()}-${String(transaction.competenceDate.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (transaction.type === 'INCOME') bucket.income += num(transaction.amount);
      else bucket.expense += num(transaction.amount);
    }

    return [...buckets.values()].map((b) => ({ ...b, profit: b.income - b.expense }));
  },
};

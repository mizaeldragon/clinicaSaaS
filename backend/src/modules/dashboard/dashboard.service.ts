import { ModuleKey } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from '../../shared/utils/datetime';
import { appointmentsService } from '../appointments/appointments.service';
import { financialService } from '../financial/financial.service';
import { resourcesService } from '../resources/resources.service';
import { rentalsService } from '../rentals/rentals.service';

function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

interface Viewer {
  /** Permissões efetivas de quem está pedindo o dashboard. */
  permissions: string[];
  /** Admins da empresa passam por qualquer permissão. */
  isAdmin: boolean;
}

/**
 * Dashboard principal. Cada bloco só é calculado quando o módulo
 * correspondente está habilitado **e** quem pede tem permissão de vê-lo —
 * caixa e aluguéis do espaço não são assunto de quem apenas atende ali.
 */
export const dashboardService = {
  async overview(modules: string[], viewer: Viewer = { permissions: [], isAdmin: true }) {
    const allowed = (permission: string) =>
      viewer.isAdmin || viewer.permissions.includes(permission);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const today = modules.includes(ModuleKey.appointments)
      ? await appointmentsService.todaySummary(now)
      : null;

    const [customers, professionals, completedMonth, canceledToday] = await Promise.all([
      modules.includes(ModuleKey.customers) ? prisma.customer.count({ where: { isActive: true } }) : 0,
      modules.includes(ModuleKey.professionals)
        ? prisma.professional.count({ where: { isActive: true } })
        : 0,
      modules.includes(ModuleKey.appointments)
        ? prisma.appointment.count({
            where: { status: 'COMPLETED', startsAt: { gte: monthStart, lte: monthEnd } },
          })
        : 0,
      modules.includes(ModuleKey.appointments)
        ? prisma.appointment.count({
            where: {
              status: { in: ['CANCELED', 'NO_SHOW'] },
              startsAt: { gte: startOfDay(now), lte: endOfDay(now) },
            },
          })
        : 0,
    ]);

    const financial =
      modules.includes(ModuleKey.financial) && allowed('financial:view')
        ? await financialService.dashboard({ from: monthStart, to: monthEnd })
        : null;

    const resources =
      modules.includes(ModuleKey.resources) && allowed('resources:view')
        ? await resourcesService.stats()
        : null;

    const rentals =
      modules.includes(ModuleKey.rentals) && allowed('rentals:view')
        ? await rentalsService.stats()
        : null;

    const revenueSeries = modules.includes(ModuleKey.appointments)
      ? await this.revenueLast30Days()
      : [];

    return {
      today: today
        ? {
            appointments: today.total,
            revenue: num(today.revenue),
            byStatus: today.byStatus,
            upcoming: today.upcoming,
            canceled: canceledToday,
          }
        : null,
      company: {
        customers,
        professionals,
        servicesCompletedMonth: completedMonth,
      },
      financial: financial
        ? {
            monthIncome: financial.month.income,
            monthExpense: financial.month.expense,
            monthProfit: financial.month.profit,
            toReceive: financial.pending.toReceive,
            toPay: financial.pending.toPay,
            upcoming: financial.upcoming,
          }
        : null,
      resources,
      rentals: rentals
        ? {
            active: rentals.activeRentals,
            overdue: rentals.overdueRentals,
            pendingAmount: rentals.pendingAmount,
            monthlyRecurringRevenue: rentals.monthlyRecurringRevenue,
            upcoming: rentals.upcoming,
          }
        : null,
      revenueSeries,
    };
  },

  /** Série de faturamento (atendimentos finalizados) dos últimos 30 dias. */
  async revenueLast30Days() {
    const from = new Date();
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);

    const appointments = await prisma.appointment.findMany({
      where: { status: 'COMPLETED', startsAt: { gte: from } },
      select: { startsAt: true, totalPrice: true },
    });

    const buckets = new Map<string, { date: string; revenue: number; count: number }>();

    for (let i = 0; i < 30; i += 1) {
      const day = new Date(from);
      day.setDate(from.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      buckets.set(key, { date: key, revenue: 0, count: 0 });
    }

    for (const appointment of appointments) {
      const key = appointment.startsAt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.revenue += num(appointment.totalPrice);
      bucket.count += 1;
    }

    return [...buckets.values()];
  },
};

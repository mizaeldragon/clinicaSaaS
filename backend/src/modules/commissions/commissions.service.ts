import { CommissionStatus, CommissionType, Prisma } from '@prisma/client';
import { prisma, TxClient } from '../../shared/database/prisma';
import { NotFoundError } from '../../shared/errors/AppError';
import { getPagination, paginated } from '../../shared/utils/http';
import { referenceMonth } from '../../shared/utils/datetime';

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

interface CommissionRule {
  type: CommissionType;
  value: number;
}

/**
 * Resolve a regra de comissão com a seguinte precedência:
 * 1. Regra específica do profissional para o serviço (ProfessionalService)
 * 2. Regra do serviço
 * 3. Regra padrão do profissional
 */
function resolveRule(
  professionalService: { commissionType: CommissionType | null; commissionValue: Prisma.Decimal | null } | null,
  service: { commissionType: CommissionType | null; commissionValue: Prisma.Decimal | null },
  professional: { commissionType: CommissionType | null; commissionValue: Prisma.Decimal | null },
): CommissionRule | null {
  if (professionalService?.commissionType && professionalService.commissionValue !== null) {
    return { type: professionalService.commissionType, value: num(professionalService.commissionValue) };
  }
  if (service.commissionType && service.commissionValue !== null) {
    return { type: service.commissionType, value: num(service.commissionValue) };
  }
  if (professional.commissionType && professional.commissionValue !== null) {
    return { type: professional.commissionType, value: num(professional.commissionValue) };
  }
  return null;
}

export const commissionsService = {
  /** Gera as comissões de um atendimento finalizado (idempotente). */
  async generateForAppointment(tx: TxClient, companyId: string, appointmentId: string) {
    const appointment = await tx.appointment.findFirst({
      where: { id: appointmentId },
      include: { services: true, professional: true },
    });

    if (!appointment?.professional) return [];

    const existing = await tx.commission.count({ where: { appointmentId } });
    if (existing > 0) return [];

    const serviceIds = appointment.services.map((s) => s.serviceId);
    const [services, overrides] = await Promise.all([
      tx.service.findMany({ where: { id: { in: serviceIds } } }),
      tx.professionalService.findMany({
        where: { professionalId: appointment.professional.id, serviceId: { in: serviceIds } },
      }),
    ]);

    const month = referenceMonth(appointment.startsAt);
    const created = [];

    for (const item of appointment.services) {
      const service = services.find((s) => s.id === item.serviceId);
      if (!service) continue;

      const override = overrides.find((o) => o.serviceId === item.serviceId) ?? null;
      const rule = resolveRule(override, service, appointment.professional);
      if (!rule) continue;

      const base = num(item.price) * item.quantity;
      const amount =
        rule.type === CommissionType.PERCENTAGE ? (base * rule.value) / 100 : rule.value * item.quantity;

      if (amount <= 0) continue;

      created.push(
        await tx.commission.create({
          data: {
            companyId,
            professionalId: appointment.professional.id,
            appointmentId: appointment.id,
            serviceId: service.id,
            baseAmount: base,
            type: rule.type,
            value: rule.value,
            amount,
            referenceMonth: month,
          },
        }),
      );
    }

    return created;
  },

  async list(query: {
    page?: number;
    perPage?: number;
    professionalId?: string;
    status?: CommissionStatus;
    referenceMonth?: string;
  }) {
    const pagination = getPagination(query);
    const where: Prisma.CommissionWhereInput = {
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.referenceMonth ? { referenceMonth: query.referenceMonth } : {}),
    };

    const [data, total, sum] = await Promise.all([
      prisma.commission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          professional: { select: { id: true, name: true, avatarUrl: true } },
          service: { select: { id: true, name: true } },
          appointment: { select: { id: true, startsAt: true, customer: { select: { name: true } } } },
        },
      }),
      prisma.commission.count({ where }),
      prisma.commission.groupBy({ by: ['status'], where, _sum: { amount: true } }),
    ]);

    return {
      ...paginated(data, total, pagination),
      totals: sum.map((s) => ({ status: s.status, total: num(s._sum.amount) })),
    };
  },

  /** Fechamento por profissional em um mês de referência. */
  async summary(month: string) {
    const grouped = await prisma.commission.groupBy({
      by: ['professionalId', 'status'],
      where: { referenceMonth: month },
      _sum: { amount: true, baseAmount: true },
      _count: { _all: true },
    });

    const professionals = await prisma.professional.findMany({
      where: { id: { in: [...new Set(grouped.map((g) => g.professionalId))] } },
      select: { id: true, name: true, avatarUrl: true },
    });

    const byProfessional = new Map<
      string,
      { professionalId: string; name: string; avatarUrl: string | null; pending: number; paid: number; total: number; count: number }
    >();

    for (const row of grouped) {
      const professional = professionals.find((p) => p.id === row.professionalId);
      const entry = byProfessional.get(row.professionalId) ?? {
        professionalId: row.professionalId,
        name: professional?.name ?? 'Profissional',
        avatarUrl: professional?.avatarUrl ?? null,
        pending: 0,
        paid: 0,
        total: 0,
        count: 0,
      };

      const amount = num(row._sum.amount);
      if (row.status === 'PENDING') entry.pending += amount;
      if (row.status === 'PAID') entry.paid += amount;
      if (row.status !== 'CANCELED') entry.total += amount;
      entry.count += row._count._all;

      byProfessional.set(row.professionalId, entry);
    }

    return { referenceMonth: month, professionals: [...byProfessional.values()] };
  },

  async pay(ids: string[]) {
    const commissions = await prisma.commission.findMany({ where: { id: { in: ids } } });
    if (commissions.length === 0) throw new NotFoundError('Comissão');

    await prisma.commission.updateMany({
      where: { id: { in: commissions.map((c) => c.id) }, status: 'PENDING' },
      data: { status: CommissionStatus.PAID, paidAt: new Date() },
    });

    return { paid: commissions.length };
  },

  async payMonth(professionalId: string, month: string) {
    const result = await prisma.commission.updateMany({
      where: { professionalId, referenceMonth: month, status: 'PENDING' },
      data: { status: CommissionStatus.PAID, paidAt: new Date() },
    });
    return { paid: result.count };
  },
};

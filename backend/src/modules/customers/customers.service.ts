import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { NotFoundError } from '../../shared/errors/AppError';
import { getPagination, paginated } from '../../shared/utils/http';
import { currentPortfolioOwner } from '../../shared/services/portfolio.service';
import type { CreateCustomerDTO, ListCustomersDTO, UpdateCustomerDTO } from './customers.schema';

const COMPLETED_OR_ACTIVE = ['COMPLETED', 'IN_PROGRESS', 'CONFIRMED', 'SCHEDULED'] as const;

export const customersService = {
  async list(query: ListCustomersDTO) {
    const pagination = getPagination(query);

    const where: Prisma.CustomerWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
              { whatsapp: { contains: query.search } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.CustomerOrderByWithRelationInput =
      query.orderBy === 'createdAt' ? { createdAt: 'desc' } : { name: 'asc' };

    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
        include: {
          _count: { select: { appointments: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return paginated(data, total, pagination);
  },

  async get(id: string) {
    const customer = await prisma.customer.findFirst({ where: { id } });
    if (!customer) throw new NotFoundError('Cliente');
    return customer;
  },

  async create(dto: CreateCustomerDTO) {
    // A cliente nasce na carteira de quem a cadastrou: da locatária quando é
    // ela que está logada, da casa nos demais casos.
    return prisma.customer.create({
      data: {
        ...(dto as Prisma.CustomerUncheckedCreateInput),
        ownerProfessionalId: currentPortfolioOwner(),
      },
    });
  },

  async update(id: string, dto: UpdateCustomerDTO) {
    await this.get(id);
    return prisma.customer.update({ where: { id }, data: dto });
  },

  async remove(id: string) {
    await this.get(id);
    const appointments = await prisma.appointment.count({ where: { customerId: id } });
    if (appointments > 0) {
      // Preserva histórico: inativa em vez de excluir.
      return prisma.customer.update({ where: { id }, data: { isActive: false } });
    }
    return prisma.customer.delete({ where: { id } });
  },

  /** Perfil completo: métricas, próximos agendamentos e timeline. */
  async profile(id: string) {
    const customer = await this.get(id);

    const [appointments, aggregates, transactions] = await Promise.all([
      prisma.appointment.findMany({
        where: { customerId: id },
        orderBy: { startsAt: 'desc' },
        take: 50,
        include: {
          professional: { select: { id: true, name: true, avatarUrl: true } },
          services: { select: { id: true, name: true, price: true, quantity: true } },
        },
      }),
      prisma.appointment.aggregate({
        where: { customerId: id, status: 'COMPLETED' },
        _sum: { totalPrice: true },
        _count: true,
      }),
      prisma.financialTransaction.findMany({
        where: { customerId: id },
        orderBy: { competenceDate: 'desc' },
        take: 30,
      }),
    ]);

    const now = new Date();

    // "Último atendimento" considera apenas visitas que já aconteceram —
    // um atendimento futuro finalizado antecipadamente não conta como última visita.
    const lastVisit = await prisma.appointment.findFirst({
      where: { customerId: id, status: 'COMPLETED', startsAt: { lte: now } },
      orderBy: { startsAt: 'desc' },
      select: { startsAt: true },
    });

    const upcoming = await prisma.appointment.findFirst({
      where: {
        customerId: id,
        startsAt: { gte: now },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      orderBy: { startsAt: 'asc' },
      include: {
        professional: { select: { id: true, name: true } },
        services: { select: { name: true } },
      },
    });

    const timeline = appointments
      .filter((a) => a.status === 'COMPLETED' || a.startsAt < now)
      .map((a) => ({
        id: a.id,
        date: a.startsAt,
        status: a.status,
        title: a.services.map((s) => s.name).join(' + ') || 'Atendimento',
        professional: a.professional?.name ?? null,
        amount: a.totalPrice,
      }));

    return {
      customer,
      metrics: {
        totalSpent: aggregates._sum.totalPrice ?? 0,
        totalAppointments: aggregates._count,
        lastVisit: lastVisit?.startsAt ?? null,
        upcomingAppointment: upcoming,
        statusBreakdown: await this.statusBreakdown(id),
      },
      appointments,
      transactions,
      timeline,
    };
  },

  async statusBreakdown(customerId: string) {
    const grouped = await prisma.appointment.groupBy({
      by: ['status'],
      where: { customerId },
      _count: { _all: true },
    });
    return grouped.map((g) => ({ status: g.status, count: g._count._all }));
  },

  /** Aniversariantes do mês — usado no dashboard e em campanhas. */
  async birthdays(month: number) {
    const customers = await prisma.customer.findMany({
      where: { isActive: true, birthDate: { not: null } },
      select: { id: true, name: true, birthDate: true, phone: true, whatsapp: true },
    });
    return customers
      .filter((c) => c.birthDate && c.birthDate.getMonth() + 1 === month)
      .sort((a, b) => (a.birthDate!.getDate() ?? 0) - (b.birthDate!.getDate() ?? 0));
  },

  async quickStats() {
    const [total, active, withUpcoming] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.customer.count({
        where: {
          appointments: {
            some: { startsAt: { gte: new Date() }, status: { in: [...COMPLETED_OR_ACTIVE] } },
          },
        },
      }),
    ]);
    return { total, active, withUpcoming };
  },
};

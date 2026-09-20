import { Prisma } from '@prisma/client';
import { prisma, TxClient } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { BadRequestError, NotFoundError, PlanLimitError } from '../../shared/errors/AppError';
import { getPagination, paginated } from '../../shared/utils/http';
import { getCompanyContext } from '../../shared/services/companyContext.service';
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from '../../shared/utils/datetime';
import { uniqueSlug } from '../../shared/utils/slug';
import type {
  CreateProfessionalDTO,
  CreateTimeOffDTO,
  ListProfessionalsDTO,
  SetWorkingHoursDTO,
  UpdateProfessionalDTO,
} from './professionals.schema';

/**
 * Endereço do link público individual. Cada profissional divulga o seu —
 * a dona do espaço o dela, cada locatária o dela.
 */
async function publicSlugFor(
  tx: TxClient,
  name: string,
  ignoreId?: string,
): Promise<string> {
  return uniqueSlug(name, async (candidate) => {
    const found = await tx.professional.findFirst({
      where: { publicSlug: candidate, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    return Boolean(found);
  });
}

const DEFAULT_WORKING_HOURS = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startsAt: '09:00',
  endsAt: '18:00',
  breakStart: '12:00',
  breakEnd: '13:00',
  isOff: false,
}));

export const professionalsService = {
  async list(query: ListProfessionalsDTO) {
    const pagination = getPagination(query);

    const where: Prisma.ProfessionalWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.serviceId ? { services: { some: { serviceId: query.serviceId } } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.professional.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          workingHours: { orderBy: { weekday: 'asc' } },
          services: { select: { serviceId: true } },
          user: { select: { id: true, email: true, role: true } },
          _count: { select: { appointments: true } },
        },
      }),
      prisma.professional.count({ where }),
    ]);

    return paginated(data, total, pagination);
  },

  async get(id: string) {
    const professional = await prisma.professional.findFirst({
      where: { id },
      include: {
        workingHours: { orderBy: { weekday: 'asc' } },
        timeOffs: { where: { endsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' } },
        services: { include: { service: { select: { id: true, name: true, price: true } } } },
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
    });
    if (!professional) throw new NotFoundError('Profissional');
    return professional;
  },

  async create(companyId: string, dto: CreateProfessionalDTO) {
    const context = await getCompanyContext(companyId);
    const max = context?.plan?.maxProfessionals ?? null;
    if (max !== null) {
      const current = await prisma.professional.count({ where: { isActive: true } });
      if (current >= max) {
        throw new PlanLimitError(
          `Seu plano permite até ${max} profissionais ativos. Faça upgrade para adicionar mais.`,
          { limit: max, current },
        );
      }
    }

    const { serviceIds, workingHours, ...data } = dto;

    return prisma.$transaction(async (tx) => {
      const professional = await tx.professional.create({
        data: {
          ...data,
          companyId,
          publicSlug: await publicSlugFor(tx, data.name),
        } as Prisma.ProfessionalUncheckedCreateInput,
      });

      await tx.workingHour.createMany({
        data: (workingHours ?? DEFAULT_WORKING_HOURS).map((h) => ({
          ...h,
          companyId,
          professionalId: professional.id,
        })),
      });

      if (serviceIds?.length) {
        await this.syncServices(tx, companyId, professional.id, serviceIds);
      }

      return professional;
    });
  },

  async update(companyId: string, id: string, dto: UpdateProfessionalDTO) {
    await this.get(id);
    const { serviceIds, workingHours, ...data } = dto;

    return prisma.$transaction(async (tx) => {
      const professional = await tx.professional.update({
        where: { id },
        // Renomear a profissional renova o endereço do link dela.
        data: { ...data, ...(data.name ? { publicSlug: await publicSlugFor(tx, data.name, id) } : {}) },
      });

      if (workingHours) {
        await tx.workingHour.deleteMany({ where: { professionalId: id } });
        await tx.workingHour.createMany({
          data: workingHours.map((h) => ({ ...h, companyId, professionalId: id })),
        });
      }

      if (serviceIds) {
        await this.syncServices(tx, companyId, id, serviceIds);
      }

      return professional;
    });
  },

  async remove(id: string) {
    await this.get(id);

    // Sem recorte de carteira: a locadora não enxerga a agenda de quem aluga,
    // e essa contagem é justamente o que decide entre inativar e apagar. Com o
    // recorte, uma locatária cheia de atendimentos parecia vazia e era apagada
    // de verdade — levando junto, em cascata, as reservas de turno dela.
    const [appointments, bookings] = await tenantContext.runUnscoped(() =>
      Promise.all([
        prisma.appointment.count({ where: { professionalId: id } }),
        prisma.rentalBooking.count({ where: { professionalId: id } }),
      ]),
    );

    // Quem já trabalhou aqui não se apaga: o atendimento, a comissão e o turno
    // alugado dela são história da casa, e sumiriam junto, em cascata. Vira
    // inativa — e a tela precisa dizer isso com todas as letras, senão a pessoa
    // clica em "remover" de novo achando que falhou.
    if (appointments > 0 || bookings > 0) {
      await prisma.professional.update({ where: { id }, data: { isActive: false } });
      return { deactivated: true, appointments, bookings };
    }

    await prisma.professional.delete({ where: { id } });
    return { deactivated: false, appointments: 0, bookings: 0 };
  },

  async syncServices(tx: TxClient, companyId: string, professionalId: string, serviceIds: string[]) {
    const valid = await tx.service.findMany({
      where: { id: { in: serviceIds }, companyId },
      select: { id: true },
    });
    if (valid.length !== serviceIds.length) {
      throw new BadRequestError('Um ou mais serviços informados não pertencem à empresa');
    }

    await tx.professionalService.deleteMany({ where: { professionalId } });
    if (serviceIds.length === 0) return;

    await tx.professionalService.createMany({
      data: serviceIds.map((serviceId) => ({ companyId, professionalId, serviceId })),
      skipDuplicates: true,
    });
  },

  async setWorkingHours(companyId: string, id: string, dto: SetWorkingHoursDTO) {
    await this.get(id);

    for (const h of dto.workingHours) {
      if (!h.isOff && h.startsAt >= h.endsAt) {
        throw new BadRequestError(`Jornada inválida no dia ${h.weekday}: início deve ser antes do fim`);
      }
    }

    await prisma.$transaction([
      prisma.workingHour.deleteMany({ where: { professionalId: id } }),
      prisma.workingHour.createMany({
        data: dto.workingHours.map((h) => ({ ...h, companyId, professionalId: id })),
      }),
    ]);

    return prisma.workingHour.findMany({
      where: { professionalId: id },
      orderBy: { weekday: 'asc' },
    });
  },

  async addTimeOff(companyId: string, id: string, dto: CreateTimeOffDTO) {
    await this.get(id);
    if (dto.startsAt >= dto.endsAt) {
      throw new BadRequestError('A data inicial deve ser anterior à data final');
    }
    return prisma.timeOff.create({
      data: { companyId, professionalId: id, ...dto },
    });
  },

  async removeTimeOff(timeOffId: string) {
    const timeOff = await prisma.timeOff.findFirst({ where: { id: timeOffId } });
    if (!timeOff) throw new NotFoundError('Ausência');
    return prisma.timeOff.delete({ where: { id: timeOffId } });
  },

  /** Painel do profissional: faturamento, atendimentos e comissões do mês. */
  async dashboard(id: string, reference = new Date()) {
    await this.get(id);
    const from = startOfMonth(reference);
    const to = endOfMonth(reference);
    const today = new Date();

    const [monthAggregate, todayCount, upcoming, commissions, statusBreakdown] = await Promise.all([
      prisma.appointment.aggregate({
        where: { professionalId: id, status: 'COMPLETED', startsAt: { gte: from, lte: to } },
        _sum: { totalPrice: true },
        _count: true,
      }),
      prisma.appointment.count({
        where: {
          professionalId: id,
          startsAt: { gte: startOfDay(today), lte: endOfDay(today) },
          status: { notIn: ['CANCELED'] },
        },
      }),
      prisma.appointment.findMany({
        where: {
          professionalId: id,
          startsAt: { gte: today },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        orderBy: { startsAt: 'asc' },
        take: 5,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          services: { select: { name: true } },
        },
      }),
      prisma.commission.aggregate({
        where: { professionalId: id, createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.appointment.groupBy({
        by: ['status'],
        where: { professionalId: id, startsAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
    ]);

    return {
      revenueMonth: monthAggregate._sum.totalPrice ?? 0,
      completedMonth: monthAggregate._count,
      appointmentsToday: todayCount,
      commissionsMonth: commissions._sum.amount ?? 0,
      upcoming,
      statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, count: s._count._all })),
    };
  },
};

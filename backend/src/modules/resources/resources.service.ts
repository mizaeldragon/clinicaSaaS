import { Prisma, ResourceStatus } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { ConflictError, NotFoundError } from '../../shared/errors/AppError';
import { getPagination, paginated } from '../../shared/utils/http';
import { endOfDay, startOfDay } from '../../shared/utils/datetime';
import { SOCKET_EVENTS, emitToCompany } from '../../websocket/io';
import { BLOCKING_STATUSES } from '../appointments/scheduling.service';
import type {
  CreateResourceCategoryDTO,
  CreateResourceDTO,
  ListResourcesDTO,
  UpdateResourceCategoryDTO,
  UpdateResourceDTO,
} from './resources.schema';

export const resourceCategoriesService = {
  async list() {
    return prisma.resourceCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { resources: true } } },
    });
  },

  async create(companyId: string, dto: CreateResourceCategoryDTO) {
    return prisma.resourceCategory.create({ data: { ...dto, companyId } });
  },

  async update(id: string, dto: UpdateResourceCategoryDTO) {
    const category = await prisma.resourceCategory.findFirst({ where: { id } });
    if (!category) throw new NotFoundError('Categoria de recurso');
    return prisma.resourceCategory.update({ where: { id }, data: dto });
  },

  async remove(id: string) {
    const category = await prisma.resourceCategory.findFirst({ where: { id } });
    if (!category) throw new NotFoundError('Categoria de recurso');
    await prisma.resource.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    return prisma.resourceCategory.delete({ where: { id } });
  },
};

export const resourcesService = {
  async list(query: ListResourcesDTO) {
    const pagination = getPagination(query);

    const where: Prisma.ResourceWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.isRentable !== undefined ? { isRentable: query.isRentable } : {}),
      ...(query.onlyRooms ? { category: { isRoom: true } } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.resource.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: pagination.skip,
        take: pagination.take,
        include: {
          category: { select: { id: true, name: true, isRoom: true } },
          rentals: {
            where: { status: 'ACTIVE' },
            select: { id: true, renterName: true, amount: true, billingCycle: true },
          },
        },
      }),
      prisma.resource.count({ where }),
    ]);

    return paginated(data, total, pagination);
  },

  async get(id: string) {
    const resource = await prisma.resource.findFirst({
      where: { id },
      include: {
        category: true,
        rentals: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!resource) throw new NotFoundError('Recurso');
    return resource;
  },

  async create(companyId: string, dto: CreateResourceDTO) {
    return prisma.resource.create({ data: { ...dto, companyId } as Prisma.ResourceUncheckedCreateInput });
  },

  async update(companyId: string, id: string, dto: UpdateResourceDTO) {
    await this.get(id);
    const resource = await prisma.resource.update({ where: { id }, data: dto });
    emitToCompany(companyId, SOCKET_EVENTS.resourceStatusChanged, {
      id: resource.id,
      status: resource.status,
    });
    return resource;
  },

  async changeStatus(companyId: string, id: string, status: ResourceStatus) {
    await this.get(id);
    const resource = await prisma.resource.update({ where: { id }, data: { status } });
    emitToCompany(companyId, SOCKET_EVENTS.resourceStatusChanged, { id, status });
    return resource;
  },

  async remove(id: string) {
    await this.get(id);

    const [appointments, rentals] = await Promise.all([
      prisma.appointment.count({ where: { OR: [{ roomId: id }, { resourceId: id }] } }),
      prisma.rental.count({ where: { resourceId: id, status: { in: ['ACTIVE', 'OVERDUE'] } } }),
    ]);

    if (rentals > 0) {
      throw new ConflictError('Este recurso possui contratos de aluguel ativos');
    }
    if (appointments > 0) {
      return prisma.resource.update({ where: { id }, data: { isActive: false, status: 'INACTIVE' } });
    }
    return prisma.resource.delete({ where: { id } });
  },

  /** Ocupação dos recursos em um dia (agenda + aluguéis ativos). */
  async occupancy(date: Date) {
    const from = startOfDay(date);
    const to = endOfDay(date);

    const [resources, appointments] = await Promise.all([
      prisma.resource.findMany({
        where: { isActive: true },
        include: { category: { select: { name: true, isRoom: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.appointment.findMany({
        where: {
          status: { in: BLOCKING_STATUSES },
          startsAt: { lt: to },
          endsAt: { gt: from },
          OR: [{ roomId: { not: null } }, { resourceId: { not: null } }],
        },
        select: {
          id: true,
          roomId: true,
          resourceId: true,
          startsAt: true,
          endsAt: true,
          customer: { select: { name: true } },
          professional: { select: { name: true } },
        },
      }),
    ]);

    return resources.map((resource) => ({
      ...resource,
      bookings: appointments.filter(
        (a) => a.roomId === resource.id || a.resourceId === resource.id,
      ),
    }));
  },

  async stats() {
    const grouped = await prisma.resource.groupBy({
      by: ['status'],
      where: { isActive: true },
      _count: { _all: true },
    });

    const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));

    return {
      total: grouped.reduce((sum, g) => sum + g._count._all, 0),
      available: byStatus.AVAILABLE ?? 0,
      inUse: byStatus.IN_USE ?? 0,
      maintenance: byStatus.MAINTENANCE ?? 0,
      inactive: byStatus.INACTIVE ?? 0,
    };
  },
};

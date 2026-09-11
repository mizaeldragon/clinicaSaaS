import { Prisma } from '@prisma/client';
import { prisma, TxClient } from '../../shared/database/prisma';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import { getPagination, paginated } from '../../shared/utils/http';
import { tenantContext } from '../../shared/database/tenantContext';
import { currentPortfolioOwner } from '../../shared/services/portfolio.service';
import type {
  CreateCategoryDTO,
  CreateServiceDTO,
  ListServicesDTO,
  UpdateCategoryDTO,
  UpdateServiceDTO,
} from './services.schema';

export const serviceCategoriesService = {
  async list() {
    return prisma.serviceCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { services: true } } },
    });
  },

  async create(dto: CreateCategoryDTO) {
    return prisma.serviceCategory.create({ data: dto as Prisma.ServiceCategoryUncheckedCreateInput });
  },

  async update(id: string, dto: UpdateCategoryDTO) {
    const category = await prisma.serviceCategory.findFirst({ where: { id } });
    if (!category) throw new NotFoundError('Categoria');
    return prisma.serviceCategory.update({ where: { id }, data: dto });
  },

  async remove(id: string) {
    const category = await prisma.serviceCategory.findFirst({ where: { id } });
    if (!category) throw new NotFoundError('Categoria');
    await prisma.service.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    return prisma.serviceCategory.delete({ where: { id } });
  },
};

export const servicesService = {
  async list(query: ListServicesDTO) {
    const pagination = getPagination(query);

    const where: Prisma.ServiceWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.professionalId
        ? { professionals: { some: { professionalId: query.professionalId } } }
        : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.service.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: pagination.skip,
        take: pagination.take,
        include: {
          category: { select: { id: true, name: true, color: true } },
          requiredResourceCat: { select: { id: true, name: true } },
          professionals: {
            select: {
              professionalId: true,
              customPrice: true,
              customDuration: true,
              professional: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      }),
      prisma.service.count({ where }),
    ]);

    return paginated(data, total, pagination);
  },

  async get(id: string) {
    const service = await prisma.service.findFirst({
      where: { id },
      include: {
        category: true,
        requiredResourceCat: true,
        professionals: { include: { professional: { select: { id: true, name: true } } } },
      },
    });
    if (!service) throw new NotFoundError('Serviço');
    return service;
  },

  async create(companyId: string, dto: CreateServiceDTO) {
    const { professionalIds, ...data } = dto;

    if (data.categoryId) await this.assertCategory(data.categoryId);
    if (data.resourceCategoryId) await this.assertResourceCategory(data.resourceCategoryId);

    return prisma.$transaction(async (tx) => {
      const service = await tx.service.create({
        // A carteira de quem cria é a dona do serviço: o que a locatária
        // cadastra fica no catálogo dela, e a casa não vê o preço que ela pratica.
        data: {
          ...data,
          companyId,
          ownerProfessionalId: currentPortfolioOwner(),
        } as Prisma.ServiceUncheckedCreateInput,
      });

      // A locatária é a única profissional da carteira dela: um serviço que ela
      // cadastra e não fica ligado a ninguém não apareceria no link público
      // dela nem na agenda — ela cadastraria no vazio.
      const owner = currentPortfolioOwner();
      const linked = professionalIds?.length
        ? professionalIds
        : owner
          ? [owner]
          : [];

      if (linked.length) {
        await this.syncProfessionals(tx, companyId, service.id, linked);
      }

      return service;
    });
  },

  async update(companyId: string, id: string, dto: UpdateServiceDTO) {
    await this.get(id);
    const { professionalIds, ...data } = dto;

    if (data.categoryId) await this.assertCategory(data.categoryId);
    if (data.resourceCategoryId) await this.assertResourceCategory(data.resourceCategoryId);

    return prisma.$transaction(async (tx) => {
      const service = await tx.service.update({ where: { id }, data });
      if (professionalIds) {
        await this.syncProfessionals(tx, companyId, id, professionalIds);
      }
      return service;
    });
  },

  async remove(id: string) {
    await this.get(id);
    const used = await prisma.appointmentService.count({ where: { serviceId: id } });
    if (used > 0) {
      return prisma.service.update({ where: { id }, data: { isActive: false } });
    }
    return prisma.service.delete({ where: { id } });
  },

  async assertCategory(categoryId: string) {
    const found = await prisma.serviceCategory.findFirst({ where: { id: categoryId } });
    if (!found) throw new NotFoundError('Categoria');
  },

  async assertResourceCategory(categoryId: string) {
    const found = await prisma.resourceCategory.findFirst({ where: { id: categoryId } });
    if (!found) throw new NotFoundError('Categoria de recurso');
  },

  async syncProfessionals(
    tx: TxClient,
    companyId: string,
    serviceId: string,
    professionalIds: string[],
  ) {
    const valid = await tx.professional.findMany({
      where: { id: { in: professionalIds }, companyId },
      select: { id: true },
    });
    if (valid.length !== professionalIds.length) {
      throw new BadRequestError('Um ou mais profissionais informados não pertencem à empresa');
    }

    await tx.professionalService.deleteMany({ where: { serviceId, companyId } });
    if (professionalIds.length === 0) return;

    await tx.professionalService.createMany({
      data: professionalIds.map((professionalId) => ({ companyId, serviceId, professionalId })),
      skipDuplicates: true,
    });
  },

  /** Serviços mais realizados no período — usado em relatórios. */
  async topServices(from: Date, to: Date, limit = 10) {
    const grouped = await prisma.appointmentService.groupBy({
      by: ['serviceId', 'name'],
      where: { appointment: { status: 'COMPLETED', startsAt: { gte: from, lte: to } } },
      _sum: { price: true, quantity: true },
      _count: { _all: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: limit,
    });

    return grouped.map((g) => ({
      serviceId: g.serviceId,
      name: g.name,
      count: g._count._all,
      revenue: g._sum.price ?? 0,
    }));
  },
};

/** Helper para services que precisam ignorar o contexto (jobs). */
export const withSystemContext = tenantContext.runAsSystem;

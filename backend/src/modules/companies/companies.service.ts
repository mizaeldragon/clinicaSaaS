import { ModuleKey } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import {
  getCompanyContext,
  invalidateCompanyContext,
} from '../../shared/services/companyContext.service';
import {
  CORE_MODULES,
  MODULE_DESCRIPTIONS,
  MODULE_LABELS,
  MODULE_ORDER,
} from './company.constants';
import type { BusinessHoursDTO, ToggleModuleDTO, UpdateCompanyDTO } from './companies.schema';

export const companiesService = {
  async get(companyId: string) {
    const company = await tenantContext.runAsSystem(() =>
      prisma.company.findUnique({
        where: { id: companyId },
        include: {
          businessHours: { orderBy: { weekday: 'asc' } },
          modules: true,
          subscription: { include: { plan: true } },
        },
      }),
    );
    if (!company) throw new NotFoundError('Empresa');
    return company;
  },

  async update(companyId: string, dto: UpdateCompanyDTO) {
    const company = await tenantContext.runAsSystem(() =>
      prisma.company.update({ where: { id: companyId }, data: dto }),
    );
    invalidateCompanyContext(companyId);
    return company;
  },

  async setBusinessHours(companyId: string, dto: BusinessHoursDTO) {
    for (const hour of dto.hours) {
      if (!hour.isClosed && hour.opensAt >= hour.closesAt) {
        throw new BadRequestError(
          `Horário inválido para o dia ${hour.weekday}: abertura deve ser antes do fechamento`,
        );
      }
    }

    await prisma.$transaction(
      dto.hours.map((hour) =>
        prisma.businessHour.upsert({
          where: { companyId_weekday: { companyId, weekday: hour.weekday } },
          create: { companyId, ...hour },
          update: { opensAt: hour.opensAt, closesAt: hour.closesAt, isClosed: hour.isClosed },
        }),
      ),
    );

    return prisma.businessHour.findMany({ orderBy: { weekday: 'asc' } });
  },

  /** Catálogo de módulos com status atual e disponibilidade segundo o plano. */
  async listModules(companyId: string) {
    const context = await getCompanyContext(companyId);
    if (!context) throw new NotFoundError('Empresa');

    const planModules = context.plan?.modules ?? MODULE_ORDER;

    return MODULE_ORDER.map((module) => ({
      module,
      label: MODULE_LABELS[module],
      description: MODULE_DESCRIPTIONS[module],
      enabled: context.modules.includes(module),
      availableInPlan: planModules.includes(module),
      required: CORE_MODULES.includes(module),
    }));
  },

  async toggleModule(companyId: string, dto: ToggleModuleDTO) {
    const context = await getCompanyContext(companyId);
    if (!context) throw new NotFoundError('Empresa');

    if (!dto.enabled && CORE_MODULES.includes(dto.module)) {
      throw new BadRequestError(
        `O módulo "${MODULE_LABELS[dto.module]}" é essencial e não pode ser desativado`,
      );
    }

    const planModules = context.plan?.modules ?? MODULE_ORDER;
    if (dto.enabled && !planModules.includes(dto.module)) {
      throw new BadRequestError(
        `O módulo "${MODULE_LABELS[dto.module]}" não está incluído no plano ${context.plan?.name ?? 'atual'}. Faça upgrade para utilizá-lo.`,
      );
    }

    await prisma.companyModule.upsert({
      where: { companyId_module: { companyId, module: dto.module } },
      create: { companyId, module: dto.module, enabled: dto.enabled },
      update: { enabled: dto.enabled },
    });

    invalidateCompanyContext(companyId);
    return this.listModules(companyId);
  },

  /** Habilita uma lista de módulos respeitando o plano (usado pelo onboarding). */
  /**
   * Liga os módulos pedidos, respeitando o plano assinado.
   *
   * O que o plano não cobre volta em `blocked` em vez de sumir em silêncio —
   * é assim que o wizard consegue dizer "aluguel de espaços está no Premium".
   */
  async enableModules(companyId: string, modules: ModuleKey[]) {
    const context = await getCompanyContext(companyId);
    const planModules = context?.plan?.modules ?? MODULE_ORDER;
    const requested = [...new Set([...CORE_MODULES, ...modules])];
    const allowed = requested.filter((m) => planModules.includes(m));
    const blocked = requested.filter((m) => !planModules.includes(m));

    await prisma.$transaction(
      allowed.map((module) =>
        prisma.companyModule.upsert({
          where: { companyId_module: { companyId, module } },
          create: { companyId, module, enabled: true },
          update: { enabled: true },
        }),
      ),
    );

    invalidateCompanyContext(companyId);
    return { enabled: allowed, blocked, plan: context?.plan?.name ?? null };
  },
};

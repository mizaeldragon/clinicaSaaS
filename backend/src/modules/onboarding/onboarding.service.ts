import { ModuleKey } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { invalidateCompanyContext } from '../../shared/services/companyContext.service';
import { companiesService } from '../companies/companies.service';
import { CORE_MODULES } from '../companies/company.constants';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  ONBOARDING_SERVICE_CATALOG,
  RENTAL_RESOURCE_TYPES,
} from './onboarding.constants';
import type { OnboardingDTO } from './onboarding.schema';

/** Traduz as respostas do wizard na lista de módulos sugeridos. */
export function deriveModules(dto: OnboardingDTO): ModuleKey[] {
  const modules = new Set<ModuleKey>(CORE_MODULES);

  if (dto.hasProfessionals || dto.usesCommission) modules.add(ModuleKey.professionals);
  if (dto.usesCommission) modules.add(ModuleKey.commissions);
  if (dto.hasRooms || dto.rentsSpaces) modules.add(ModuleKey.resources);
  if (dto.rentsSpaces) {
    modules.add(ModuleKey.rentals);
    modules.add(ModuleKey.financial);
  }

  // Sugeridos por padrão — o usuário pode desmarcar na última etapa.
  modules.add(ModuleKey.financial);
  modules.add(ModuleKey.reports);
  modules.add(ModuleKey.notifications);

  return [...modules];
}

export const onboardingService = {
  /** Prévia dos módulos sugeridos sem persistir nada. */
  preview(dto: OnboardingDTO) {
    return { modules: deriveModules(dto) };
  },

  async complete(companyId: string, dto: OnboardingDTO) {
    const suggested = deriveModules(dto);
    const chosen = dto.modules?.length
      ? ([...new Set([...CORE_MODULES, ...dto.modules])] as ModuleKey[])
      : suggested;

    await tenantContext.runAsSystem(() =>
      prisma.company.update({
        where: { id: companyId },
        data: {
          type: dto.companyType,
          onboardingCompleted: true,
          onboardingAnswers: {
            companyType: dto.companyType,
            serviceKeys: dto.serviceKeys,
            hasProfessionals: dto.hasProfessionals,
            usesCommission: dto.usesCommission,
            hasRooms: dto.hasRooms,
            rentsSpaces: dto.rentsSpaces,
            rentalResourceKeys: dto.rentalResourceKeys,
            answeredAt: new Date().toISOString(),
          },
        },
      }),
    );

    const { enabled, blocked, plan } = await companiesService.enableModules(companyId, chosen);

    if (dto.seedCatalog) {
      await this.seedCatalog(companyId, dto, enabled);
    }

    invalidateCompanyContext(companyId);

    return { modules: enabled, blocked, plan };
  },

  /** Cria categorias/serviços/recursos iniciais conforme as respostas. */
  async seedCatalog(companyId: string, dto: OnboardingDTO, enabled: ModuleKey[]) {
    const selected = ONBOARDING_SERVICE_CATALOG.filter((c) => dto.serviceKeys.includes(c.key));

    // 1. Categorias e serviços
    const categoriesByName = new Map<string, { color: string }>();
    for (const item of selected) {
      categoriesByName.set(item.category, { color: item.categoryColor });
    }

    for (const [name, { color }] of categoriesByName) {
      await prisma.serviceCategory.upsert({
        where: { companyId_name: { companyId, name } },
        create: { companyId, name, color },
        update: {},
      });
    }

    const categories = await prisma.serviceCategory.findMany();
    const categoryId = new Map(categories.map((c) => [c.name, c.id]));

    for (const item of selected) {
      for (const service of item.services) {
        const exists = await prisma.service.findFirst({ where: { name: service.name } });
        if (exists) continue;
        await prisma.service.create({
          data: {
            companyId,
            name: service.name,
            price: service.price,
            durationMinutes: service.durationMinutes,
            categoryId: categoryId.get(item.category) ?? null,
          },
        });
      }
    }

    // 2. Recursos (salas próprias e/ou recursos para aluguel)
    if (enabled.includes(ModuleKey.resources)) {
      const wanted = new Set<string>();
      if (dto.hasRooms) wanted.add('rooms');
      for (const key of dto.rentalResourceKeys) wanted.add(key);

      for (const type of RENTAL_RESOURCE_TYPES) {
        if (!wanted.has(type.key)) continue;

        const category = await prisma.resourceCategory.upsert({
          where: { companyId_name: { companyId, name: type.categoryName } },
          create: { companyId, name: type.categoryName, isRoom: type.isRoom },
          update: {},
        });

        for (const sample of type.samples) {
          const exists = await prisma.resource.findFirst({ where: { name: sample } });
          if (exists) continue;
          await prisma.resource.create({
            data: {
              companyId,
              name: sample,
              categoryId: category.id,
              isRentable: dto.rentsSpaces && dto.rentalResourceKeys.includes(type.key),
            },
          });
        }
      }
    }

    // 3. Plano de contas básico de despesas
    if (enabled.includes(ModuleKey.financial)) {
      for (const name of DEFAULT_EXPENSE_CATEGORIES) {
        await prisma.expenseCategory.upsert({
          where: { companyId_name: { companyId, name } },
          create: { companyId, name },
          update: {},
        });
      }
    }
  },

  async status(companyId: string) {
    const company = await tenantContext.runAsSystem(() =>
      prisma.company.findUnique({
        where: { id: companyId },
        select: { onboardingCompleted: true, onboardingAnswers: true, type: true },
      }),
    );
    return company;
  },
};

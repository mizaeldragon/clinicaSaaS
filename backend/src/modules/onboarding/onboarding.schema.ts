import { z } from 'zod';
import { CompanyType, ModuleKey } from '@prisma/client';
import { ONBOARDING_SERVICE_KEYS, RENTAL_RESOURCE_KEYS } from './onboarding.constants';

export const onboardingSchema = z.object({
  companyType: z.nativeEnum(CompanyType),
  serviceKeys: z.array(z.enum(ONBOARDING_SERVICE_KEYS as [string, ...string[]])).default([]),
  hasProfessionals: z.boolean(),
  usesCommission: z.boolean(),
  hasRooms: z.boolean(),
  rentsSpaces: z.boolean(),
  rentalResourceKeys: z
    .array(z.enum(RENTAL_RESOURCE_KEYS as unknown as [string, ...string[]]))
    .default([]),
  /** Opcional: o usuário pode ajustar na última etapa a sugestão do sistema. */
  modules: z.array(z.nativeEnum(ModuleKey)).optional(),
  /** Cria dados de exemplo (categorias e serviços) a partir das respostas. */
  seedCatalog: z.boolean().default(true),
});

export type OnboardingDTO = z.infer<typeof onboardingSchema>;

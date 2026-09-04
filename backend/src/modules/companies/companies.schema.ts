import { z } from 'zod';
import { CompanyType, ModuleKey } from '@prisma/client';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const updateCompanySchema = z.object({
  name: z.string().min(2).max(120).optional(),
  legalName: z.string().max(160).nullable().optional(),
  document: z.string().max(20).nullable().optional(),
  type: z.nativeEnum(CompanyType).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  whatsapp: z.string().max(20).nullable().optional(),
  addressStreet: z.string().max(160).nullable().optional(),
  addressNumber: z.string().max(20).nullable().optional(),
  addressCity: z.string().max(80).nullable().optional(),
  addressState: z.string().max(2).nullable().optional(),
  addressZip: z.string().max(12).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/, 'Cor deve estar no formato #RRGGBB')
    .optional(),
  timezone: z.string().max(60).optional(),
  publicBookingEnabled: z.boolean().optional(),
  publicDescription: z.string().max(600).nullable().optional(),
  publicRequiresApproval: z.boolean().optional(),
});

export const businessHoursSchema = z.object({
  hours: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        opensAt: z.string().regex(timeRegex, 'Horário inválido (use HH:mm)'),
        closesAt: z.string().regex(timeRegex, 'Horário inválido (use HH:mm)'),
        isClosed: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(7),
});

export const toggleModuleSchema = z.object({
  module: z.nativeEnum(ModuleKey),
  enabled: z.boolean(),
});

export type UpdateCompanyDTO = z.infer<typeof updateCompanySchema>;
export type BusinessHoursDTO = z.infer<typeof businessHoursSchema>;
export type ToggleModuleDTO = z.infer<typeof toggleModuleSchema>;

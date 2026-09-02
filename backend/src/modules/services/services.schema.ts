import { z } from 'zod';
import { CommissionType } from '@prisma/client';

export const createCategorySchema = z.object({
  name: z.string().min(2).max(80),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/).default('#7C3AED'),
  icon: z.string().max(40).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createServiceSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  price: z.coerce.number().min(0, 'Valor não pode ser negativo'),
  durationMinutes: z.coerce.number().int().min(5, 'Duração mínima de 5 minutos').max(1440),
  bufferMinutes: z.coerce.number().int().min(0).max(240).default(0),
  commissionType: z.nativeEnum(CommissionType).nullable().optional(),
  commissionValue: z.coerce.number().min(0).nullable().optional(),
  resourceCategoryId: z.string().uuid().nullable().optional(),
  professionalIds: z.array(z.string().uuid()).optional(),
});

export const updateServiceSchema = createServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listServicesSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  professionalId: z.string().uuid().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Identificador inválido') });

export type CreateCategoryDTO = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDTO = z.infer<typeof updateCategorySchema>;
export type CreateServiceDTO = z.infer<typeof createServiceSchema>;
export type UpdateServiceDTO = z.infer<typeof updateServiceSchema>;
export type ListServicesDTO = z.infer<typeof listServicesSchema>;

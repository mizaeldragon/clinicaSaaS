import { z } from 'zod';
import { ResourceStatus } from '@prisma/client';

export const createResourceCategorySchema = z.object({
  name: z.string().min(2).max(80),
  isRoom: z.boolean().default(false),
  icon: z.string().max(40).optional(),
});

export const updateResourceCategorySchema = createResourceCategorySchema.partial();

export const createResourceSchema = z.object({
  name: z.string().min(1).max(80),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  status: z.nativeEnum(ResourceStatus).default(ResourceStatus.AVAILABLE),
  isRentable: z.boolean().default(false),
  hourlyRate: z.coerce.number().min(0).nullable().optional(),
  dailyRate: z.coerce.number().min(0).nullable().optional(),
  weeklyRate: z.coerce.number().min(0).nullable().optional(),
  monthlyRate: z.coerce.number().min(0).nullable().optional(),
});

export const updateResourceSchema = createResourceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listResourcesSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.nativeEnum(ResourceStatus).optional(),
  isRentable: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  onlyRooms: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const changeStatusSchema = z.object({ status: z.nativeEnum(ResourceStatus) });

export const idParamSchema = z.object({ id: z.string().uuid('Identificador inválido') });

export type CreateResourceCategoryDTO = z.infer<typeof createResourceCategorySchema>;
export type UpdateResourceCategoryDTO = z.infer<typeof updateResourceCategorySchema>;
export type CreateResourceDTO = z.infer<typeof createResourceSchema>;
export type UpdateResourceDTO = z.infer<typeof updateResourceSchema>;
export type ListResourcesDTO = z.infer<typeof listResourcesSchema>;

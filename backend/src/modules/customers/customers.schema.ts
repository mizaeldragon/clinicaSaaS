import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(120),
  phone: z.string().max(20).optional(),
  whatsapp: z.string().max(20).optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')).transform((v) => (v === '' ? undefined : v)),
  birthDate: z.coerce.date().optional(),
  document: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  orderBy: z.enum(['name', 'createdAt', 'lastVisit']).default('name'),
});

export const idParamSchema = z.object({ id: z.string().uuid('Identificador inválido') });

export type CreateCustomerDTO = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDTO = z.infer<typeof updateCustomerSchema>;
export type ListCustomersDTO = z.infer<typeof listCustomersSchema>;

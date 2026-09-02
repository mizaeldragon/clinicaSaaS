import { z } from 'zod';
import { UserRole } from '@prisma/client';

const assignableRoles = z.enum([
  UserRole.COMPANY_ADMIN,
  UserRole.MANAGER,
  UserRole.RECEPTIONIST,
  UserRole.PROFESSIONAL,
]);

export const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres').max(72),
  phone: z.string().max(20).optional(),
  role: assignableRoles,
  permissions: z.array(z.string()).optional(),
  professionalId: z.string().uuid().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  phone: z.string().max(20).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  role: assignableRoles.optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(72).optional(),
  professionalId: z.string().uuid().nullable().optional(),
});

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  role: assignableRoles.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Identificador inválido') });

export type CreateUserDTO = z.infer<typeof createUserSchema>;
export type UpdateUserDTO = z.infer<typeof updateUserSchema>;
export type ListUsersDTO = z.infer<typeof listUsersSchema>;

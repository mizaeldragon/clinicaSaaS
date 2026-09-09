import { z } from 'zod';
import { CommissionType } from '@prisma/client';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const workingHourSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startsAt: z.string().regex(timeRegex, 'Horário inválido (HH:mm)'),
  endsAt: z.string().regex(timeRegex, 'Horário inválido (HH:mm)'),
  breakStart: z.string().regex(timeRegex).nullable().optional(),
  breakEnd: z.string().regex(timeRegex).nullable().optional(),
  isOff: z.boolean().default(false),
});

export const createProfessionalSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().optional().or(z.literal('')).transform((v) => (v === '' ? undefined : v)),
  phone: z.string().max(20).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  bio: z.string().max(1000).optional(),
  specialties: z.array(z.string().max(60)).default([]),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/).default('#7C3AED'),
  commissionType: z.nativeEnum(CommissionType).nullable().optional(),
  commissionValue: z.coerce.number().min(0).nullable().optional(),
  revenueOwner: z.enum(['COMPANY', 'PROFESSIONAL']).optional(),
  publicBookingEnabled: z.boolean().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  workingHours: z.array(workingHourSchema).optional(),
});

export const updateProfessionalSchema = createProfessionalSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listProfessionalsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  serviceId: z.string().uuid().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const setWorkingHoursSchema = z.object({
  workingHours: z.array(workingHourSchema).max(7),
});

export const createTimeOffSchema = z.object({
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  reason: z.string().max(200).optional(),
});

export const availabilityQuerySchema = z.object({
  date: z.coerce.date(),
  serviceId: z.string().uuid().optional(),
  durationMinutes: z.coerce.number().int().min(5).max(1440).optional(),
  slotMinutes: z.coerce.number().int().min(5).max(120).default(15),
});

export const idParamSchema = z.object({ id: z.string().uuid('Identificador inválido') });

export type CreateProfessionalDTO = z.infer<typeof createProfessionalSchema>;
export type UpdateProfessionalDTO = z.infer<typeof updateProfessionalSchema>;
export type ListProfessionalsDTO = z.infer<typeof listProfessionalsSchema>;
export type SetWorkingHoursDTO = z.infer<typeof setWorkingHoursSchema>;
export type CreateTimeOffDTO = z.infer<typeof createTimeOffSchema>;
export type AvailabilityQueryDTO = z.infer<typeof availabilityQuerySchema>;

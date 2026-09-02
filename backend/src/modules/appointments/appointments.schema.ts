import { z } from 'zod';
import { AppointmentStatus, PaymentMethod } from '@prisma/client';

export const appointmentServiceItemSchema = z.object({
  serviceId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
  price: z.coerce.number().min(0).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(1440).optional(),
});

export const createAppointmentSchema = z.object({
  customerId: z.string().uuid('Selecione um cliente'),
  professionalId: z.string().uuid().nullable().optional(),
  roomId: z.string().uuid().nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
  startsAt: z.coerce.date(),
  /** Quando omitido, é calculado pela soma da duração dos serviços. */
  endsAt: z.coerce.date().optional(),
  services: z.array(appointmentServiceItemSchema).min(1, 'Selecione ao menos um serviço'),
  status: z.nativeEnum(AppointmentStatus).default(AppointmentStatus.SCHEDULED),
  notes: z.string().max(2000).optional(),
});

export const updateAppointmentSchema = z.object({
  customerId: z.string().uuid().optional(),
  professionalId: z.string().uuid().nullable().optional(),
  roomId: z.string().uuid().nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  services: z.array(appointmentServiceItemSchema).min(1).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
  canceledReason: z.string().max(300).optional(),
  /** Ao finalizar, permite registrar o pagamento no mesmo passo. */
  payment: z
    .object({
      method: z.nativeEnum(PaymentMethod),
      amount: z.coerce.number().min(0).optional(),
      paid: z.boolean().default(true),
    })
    .optional(),
});

export const listAppointmentsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  professionalId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  status: z
    .union([z.nativeEnum(AppointmentStatus), z.array(z.nativeEnum(AppointmentStatus))])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(200).optional(),
});

export const checkAvailabilitySchema = z.object({
  professionalId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  ignoreAppointmentId: z.string().uuid().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Identificador inválido') });

export type CreateAppointmentDTO = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDTO = z.infer<typeof updateAppointmentSchema>;
export type UpdateStatusDTO = z.infer<typeof updateStatusSchema>;
export type ListAppointmentsDTO = z.infer<typeof listAppointmentsSchema>;
export type CheckAvailabilityDTO = z.infer<typeof checkAvailabilitySchema>;

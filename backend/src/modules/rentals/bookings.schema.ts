import { z } from 'zod';
import { PaymentMethod, RentalBookingKind, RentalBookingStatus } from '@prisma/client';

export const createBookingSchema = z
  .object({
    resourceId: z.string().uuid('Selecione o espaço'),
    professionalId: z.string().uuid('Selecione a profissional'),
    date: z.coerce.date(),
    kind: z.nativeEnum(RentalBookingKind).default(RentalBookingKind.SHIFT),
    shiftId: z.string().uuid().nullable().optional(),
    /** Quando omitido, usa o preço da tabela (recurso × turno). */
    price: z.coerce.number().min(0).optional(),
    notes: z.string().max(500).nullable().optional(),
    /** Repete a reserva nas próximas N semanas, no mesmo dia da semana. */
    repeatWeeks: z.coerce.number().int().min(0).max(52).default(0),
  })
  .refine((data) => data.kind === RentalBookingKind.DAILY || Boolean(data.shiftId), {
    message: 'Informe o turno',
    path: ['shiftId'],
  });

export const updateBookingSchema = z.object({
  status: z.nativeEnum(RentalBookingStatus).optional(),
  price: z.coerce.number().min(0).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const listBookingsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  resourceId: z.string().uuid().optional(),
  professionalId: z.string().uuid().optional(),
  status: z.nativeEnum(RentalBookingStatus).optional(),
  paymentStatus: z.enum(['PAID', 'PARTIAL', 'PENDING', 'CANCELED']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(200).optional(),
});

export const payBookingSchema = z.object({
  amount: z.coerce.number().min(0.01),
  paymentMethod: z.nativeEnum(PaymentMethod),
  paidAt: z.coerce.date().default(() => new Date()),
});

export const availabilityQuerySchema = z.object({
  date: z.coerce.date(),
  resourceId: z.string().uuid().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Identificador inválido') });

export type CreateBookingDTO = z.infer<typeof createBookingSchema>;
export type UpdateBookingDTO = z.infer<typeof updateBookingSchema>;
export type ListBookingsDTO = z.infer<typeof listBookingsSchema>;
export type PayBookingDTO = z.infer<typeof payBookingSchema>;

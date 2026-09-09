import { z } from 'zod';
import { PaymentMethod, RentalBookingKind, RentalBookingStatus } from '@prisma/client';
import { calendarDate } from '../../shared/utils/zod';

/**
 * Uma reserva ou um período inteiro, com a mesma forma.
 *
 * A locação real assume vários formatos: um turno solto, "a semana toda",
 * "terça e quinta de manhã até o fim do mês", "seg a sáb o mês inteiro".
 * Tudo isso é o mesmo desenho — um intervalo de datas, um filtro de dias da
 * semana e um ou mais turnos.
 */
export const createBookingSchema = z
  .object({
    resourceId: z.string().uuid('Selecione o espaço'),
    professionalId: z.string().uuid('Selecione a profissional'),
    /** Primeiro dia do período. */
    date: calendarDate,
    /** Último dia. Ausente = só o dia informado. */
    until: calendarDate.optional(),
    /** Dias da semana (0=domingo). Vazio = todos os dias do período. */
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional(),
    kind: z.nativeEnum(RentalBookingKind).default(RentalBookingKind.SHIFT),
    /** Um turno — mantido para os contratos recorrentes. */
    shiftId: z.string().uuid().nullable().optional(),
    /** Vários turnos no mesmo dia (manhã + tarde, por exemplo). */
    shiftIds: z.array(z.string().uuid()).max(10).optional(),
    /** Quando omitido, usa o preço da tabela (recurso × turno). */
    price: z.coerce.number().min(0).optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine(
    (data) =>
      data.kind === RentalBookingKind.DAILY ||
      Boolean(data.shiftId) ||
      Boolean(data.shiftIds?.length),
    { message: 'Informe o turno', path: ['shiftId'] },
  )
  .refine((data) => !data.until || data.until >= data.date, {
    message: 'O fim do período não pode ser antes do início',
    path: ['until'],
  });

export const updateBookingSchema = z.object({
  status: z.nativeEnum(RentalBookingStatus).optional(),
  price: z.coerce.number().min(0).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const listBookingsSchema = z.object({
  from: calendarDate.optional(),
  to: calendarDate.optional(),
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

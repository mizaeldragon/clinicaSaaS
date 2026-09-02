import { z } from 'zod';
import { PaymentMethod, RentalBillingCycle, RentalStatus } from '@prisma/client';

export const createRentalSchema = z
  .object({
    resourceId: z.string().uuid('Selecione o recurso'),
    professionalId: z.string().uuid().nullable().optional(),
    renterName: z.string().min(2, 'Informe o responsável').max(120),
    renterPhone: z.string().max(20).nullable().optional(),
    renterEmail: z.string().email().nullable().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().nullable().optional(),
    amount: z.coerce.number().min(0.01, 'Informe o valor do aluguel'),
    billingCycle: z.nativeEnum(RentalBillingCycle).default(RentalBillingCycle.MONTHLY),
    dueDay: z.coerce.number().int().min(1).max(31).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    /** Gera imediatamente a primeira cobrança do contrato. */
    generateFirstCharge: z.boolean().default(true),
  })
  .refine((data) => !data.endsAt || data.endsAt > data.startsAt, {
    message: 'A data final deve ser posterior à data inicial',
    path: ['endsAt'],
  });

export const updateRentalSchema = z.object({
  professionalId: z.string().uuid().nullable().optional(),
  renterName: z.string().min(2).max(120).optional(),
  renterPhone: z.string().max(20).nullable().optional(),
  renterEmail: z.string().email().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  amount: z.coerce.number().min(0.01).optional(),
  billingCycle: z.nativeEnum(RentalBillingCycle).optional(),
  dueDay: z.coerce.number().int().min(1).max(31).nullable().optional(),
  status: z.nativeEnum(RentalStatus).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const listRentalsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(200).optional(),
  status: z.nativeEnum(RentalStatus).optional(),
  resourceId: z.string().uuid().optional(),
  professionalId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
});

export const listPaymentsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(200).optional(),
  rentalId: z.string().uuid().optional(),
  status: z.enum(['PAID', 'PARTIAL', 'PENDING', 'CANCELED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const payRentalSchema = z.object({
  amount: z.coerce.number().min(0.01),
  paymentMethod: z.nativeEnum(PaymentMethod),
  paidAt: z.coerce.date().default(() => new Date()),
});

export const idParamSchema = z.object({ id: z.string().uuid('Identificador inválido') });

export type CreateRentalDTO = z.infer<typeof createRentalSchema>;
export type UpdateRentalDTO = z.infer<typeof updateRentalSchema>;
export type ListRentalsDTO = z.infer<typeof listRentalsSchema>;
export type ListPaymentsDTO = z.infer<typeof listPaymentsSchema>;
export type PayRentalDTO = z.infer<typeof payRentalSchema>;

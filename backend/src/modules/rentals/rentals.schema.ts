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
    shiftId: z.string().uuid().nullable().optional(),
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7).default([]),
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
  shiftId: z.string().uuid().nullable().optional(),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional(),
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

/**
 * A locatária e o acesso dela, num pedido só.
 *
 * Antes eram três telas para colocar uma pessoa no espaço: cadastrar a
 * profissional, criar o usuário em Configurações e voltar para fazer o
 * contrato. Quem aluga não existe sem login — é com ele que ela vê a própria
 * agenda —, então os dois nascem juntos.
 */
export const createRenterSchema = z.object({
  name: z.string().min(2, 'Informe o nome').max(120),
  phone: z.string().max(20).optional(),
  email: z.string().email('E-mail inválido').toLowerCase().trim(),
  /** Provisória: ela troca no primeiro acesso, em Minha conta. */
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres').max(72),
  specialties: z.array(z.string().max(60)).max(10).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Identificador inválido') });

export type CreateRentalDTO = z.infer<typeof createRentalSchema>;
export type UpdateRentalDTO = z.infer<typeof updateRentalSchema>;
export type ListRentalsDTO = z.infer<typeof listRentalsSchema>;
export type ListPaymentsDTO = z.infer<typeof listPaymentsSchema>;
export type PayRentalDTO = z.infer<typeof payRentalSchema>;
export type CreateRenterDTO = z.infer<typeof createRenterSchema>;

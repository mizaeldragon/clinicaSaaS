import { z } from 'zod';
import { PaymentMethod, PaymentStatus, TransactionOrigin, TransactionType } from '@prisma/client';

export const createTransactionSchema = z.object({
  type: z.nativeEnum(TransactionType),
  origin: z.nativeEnum(TransactionOrigin).default(TransactionOrigin.MANUAL),
  description: z.string().min(2).max(200),
  amount: z.coerce.number().min(0.01, 'Informe um valor maior que zero'),
  paidAmount: z.coerce.number().min(0).default(0),
  paymentMethod: z.nativeEnum(PaymentMethod).nullable().optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).default(PaymentStatus.PENDING),
  dueDate: z.coerce.date().nullable().optional(),
  paidAt: z.coerce.date().nullable().optional(),
  competenceDate: z.coerce.date().default(() => new Date()),
  categoryId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  appointmentId: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const payTransactionSchema = z.object({
  amount: z.coerce.number().min(0.01),
  paymentMethod: z.nativeEnum(PaymentMethod),
  paidAt: z.coerce.date().default(() => new Date()),
});

export const listTransactionsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(200).optional(),
  type: z.nativeEnum(TransactionType).optional(),
  origin: z.nativeEnum(TransactionOrigin).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  categoryId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().optional(),
});

export const dashboardQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const expenseCategorySchema = z.object({
  name: z.string().min(2).max(80),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/).default('#EF4444'),
});

export const idParamSchema = z.object({ id: z.string().uuid('Identificador inválido') });

export type CreateTransactionDTO = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionDTO = z.infer<typeof updateTransactionSchema>;
export type PayTransactionDTO = z.infer<typeof payTransactionSchema>;
export type ListTransactionsDTO = z.infer<typeof listTransactionsSchema>;
export type DashboardQueryDTO = z.infer<typeof dashboardQuerySchema>;
export type ExpenseCategoryDTO = z.infer<typeof expenseCategorySchema>;

import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createShiftSchema = z
  .object({
    name: z.string().min(2, 'Informe o nome do turno').max(40),
    startsAt: z.string().regex(timeRegex, 'Horário inválido (use HH:mm)'),
    endsAt: z.string().regex(timeRegex, 'Horário inválido (use HH:mm)'),
    sortOrder: z.coerce.number().int().min(0).default(0),
  })
  .refine((data) => data.startsAt < data.endsAt, {
    message: 'O fim do turno deve ser depois do início',
    path: ['endsAt'],
  });

export const updateShiftSchema = z.object({
  name: z.string().min(2).max(40).optional(),
  startsAt: z.string().regex(timeRegex).optional(),
  endsAt: z.string().regex(timeRegex).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/** Preço de cada turno em um recurso — sala de cabelo à noite ≠ de manhã. */
export const setShiftPricesSchema = z.object({
  resourceId: z.string().uuid(),
  prices: z
    .array(
      z.object({
        shiftId: z.string().uuid(),
        price: z.coerce.number().min(0),
      }),
    )
    .max(20),
});

export const idParamSchema = z.object({ id: z.string().uuid('Identificador inválido') });

export type CreateShiftDTO = z.infer<typeof createShiftSchema>;
export type UpdateShiftDTO = z.infer<typeof updateShiftSchema>;
export type SetShiftPricesDTO = z.infer<typeof setShiftPricesSchema>;

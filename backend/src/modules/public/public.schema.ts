import { z } from 'zod';

export const slugParamSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Endereço inválido'),
});

export const availabilityQuerySchema = z.object({
  serviceId: z.string().uuid('Selecione um serviço'),
  date: z.coerce.date(),
  professionalId: z.string().uuid().optional(),
});

export const agendaQuerySchema = z.object({
  from: z.coerce.date(),
  days: z.coerce.number().int().min(1).max(31).default(7),
  /** No link individual, só interessa a agenda daquela profissional. */
  professionalId: z.string().uuid().optional(),
});

export const professionalSlugParamSchema = slugParamSchema.extend({
  professionalSlug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Endereço inválido'),
});

export const createPublicAppointmentSchema = z.object({
  serviceId: z.string().uuid('Selecione um serviço'),
  professionalId: z.string().uuid('Selecione a profissional'),
  startsAt: z.coerce.date(),
  customer: z.object({
    name: z.string().min(2, 'Informe seu nome').max(120),
    phone: z
      .string()
      .min(8, 'Informe um telefone válido')
      .max(20)
      .regex(/^[0-9()\-\s+]+$/, 'Telefone inválido'),
    email: z
      .string()
      .email('E-mail inválido')
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? undefined : v)),
  }),
  notes: z.string().max(500).optional(),
});

export type AvailabilityQueryDTO = z.infer<typeof availabilityQuerySchema>;
export type AgendaQueryDTO = z.infer<typeof agendaQuerySchema>;
export type CreatePublicAppointmentDTO = z.infer<typeof createPublicAppointmentSchema>;

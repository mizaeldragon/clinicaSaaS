import { z } from 'zod';
import { parseCalendarDate } from './datetime';

/**
 * Campo que representa um **dia**, não um instante.
 *
 * Aceita "2026-12-25" (o que um `<input type="date">` manda) e ISO completo.
 * A forma sem hora é interpretada no fuso local — ver `parseCalendarDate`.
 */
export const calendarDate = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    const parsed = parseCalendarDate(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Data inválida' });
      return z.NEVER;
    }
    return parsed;
  });

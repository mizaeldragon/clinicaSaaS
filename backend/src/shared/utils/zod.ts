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
      ctx.addIssue({ code: 'custom', message: 'Data inválida' });
      return z.NEVER;
    }
    return parsed;
  });

type SemDefault<T extends z.core.$ZodType> =
  T extends z.ZodDefault<infer Inner extends z.core.$ZodType> ? Inner : T;

/**
 * O schema de criação, sem os `.default()`, pronto para virar o de edição.
 *
 * No Zod 4 o `.partial()` aplica o default de campo ausente. Num PATCH isso
 * reescreveria o que a pessoa não mandou — editar só a descrição de um
 * lançamento pago o devolveria a "pendente" com R$ 0,00 recebido. Por isso
 * todo schema de edição nasce daqui: `semDefaults(createX).partial()`.
 */
export function semDefaults<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      field instanceof z.ZodDefault ? field.unwrap() : field,
    ]),
  );
  return z.object(shape) as z.ZodObject<{ [K in keyof Shape]: SemDefault<Shape[K]> }>;
}

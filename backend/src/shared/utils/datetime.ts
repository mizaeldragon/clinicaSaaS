/** Converte "HH:mm" em minutos desde a meia-noite. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Verifica sobreposição de intervalos [aStart, aEnd) x [bStart, bEnd). */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/** "2026-09" a partir de uma data. */
export function referenceMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Data de vencimento no mês informado, respeitando meses curtos. */
export function dueDateFor(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay), 12, 0, 0, 0);
}

/**
 * Data de calendário vinda do cliente.
 *
 * Um `<input type="date">` manda "2026-12-25", sem hora. O parser padrão lê
 * isso como meia-noite **UTC** — que em São Paulo é 21h do dia 24. Marcar o
 * Natal acabava fechando a véspera.
 *
 * Aqui a data sem hora é montada no fuso local, ancorada ao meio-dia para que
 * nenhuma virada de horário de verão empurre de novo. Strings com hora
 * (ISO completo) continuam sendo instantes e passam direto.
 */
export function parseCalendarDate(value: string | Date): Date {
  if (value instanceof Date) return value;

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnly.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  return new Date(value);
}

import { prisma } from '../../shared/database/prisma';
import { ConflictError, NotFoundError } from '../../shared/errors/AppError';
import { startOfDay } from '../../shared/utils/datetime';

/**
 * Feriados e fechamentos.
 *
 * A empresa não atende nesses dias, independentemente do horário de
 * funcionamento cadastrado. Serve tanto para o feriado nacional quanto para o
 * fechamento próprio da casa ("recesso", "reforma").
 */

interface HolidaySpec {
  name: string;
  /** Deslocamento em dias a partir do domingo de Páscoa. */
  fromEaster?: number;
  month?: number;
  day?: number;
}

/**
 * Feriados nacionais brasileiros. Os móveis saem da Páscoa, calculada pelo
 * algoritmo de Meeus/Jones/Butcher — assim a lista vale para qualquer ano, sem
 * depender de serviço externo.
 */
const NATIONAL: HolidaySpec[] = [
  { name: 'Confraternização Universal', month: 1, day: 1 },
  { name: 'Carnaval', fromEaster: -47 },
  { name: 'Sexta-feira Santa', fromEaster: -2 },
  { name: 'Tiradentes', month: 4, day: 21 },
  { name: 'Dia do Trabalho', month: 5, day: 1 },
  { name: 'Corpus Christi', fromEaster: 60 },
  { name: 'Independência do Brasil', month: 9, day: 7 },
  { name: 'Nossa Senhora Aparecida', month: 10, day: 12 },
  { name: 'Finados', month: 11, day: 2 },
  { name: 'Proclamação da República', month: 11, day: 15 },
  { name: 'Consciência Negra', month: 11, day: 20 },
  { name: 'Natal', month: 12, day: 25 },
];

/** Domingo de Páscoa do ano informado. */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12);
}

export function nationalHolidays(year: number): { date: Date; name: string }[] {
  const base = easter(year);

  return NATIONAL.map((spec) => {
    if (spec.fromEaster !== undefined) {
      const date = new Date(base);
      date.setDate(date.getDate() + spec.fromEaster);
      return { date: startOfDay(date), name: spec.name };
    }
    return { date: startOfDay(new Date(year, (spec.month ?? 1) - 1, spec.day ?? 1, 12)), name: spec.name };
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export const holidaysService = {
  /** Feriados de um ano (padrão: o ano corrente). */
  async list(year = new Date().getFullYear()) {
    return prisma.holiday.findMany({
      where: {
        date: {
          gte: startOfDay(new Date(year, 0, 1, 12)),
          lte: startOfDay(new Date(year, 11, 31, 12)),
        },
      },
      orderBy: { date: 'asc' },
    });
  },

  async create(companyId: string, dto: { date: Date; name: string }) {
    const date = startOfDay(dto.date);

    const existing = await prisma.holiday.findFirst({ where: { date } });
    if (existing) {
      throw new ConflictError(`Este dia já está marcado como "${existing.name}"`);
    }

    return prisma.holiday.create({
      data: { companyId, date, name: dto.name, national: false },
    });
  },

  async remove(id: string) {
    const holiday = await prisma.holiday.findFirst({ where: { id } });
    if (!holiday) throw new NotFoundError('Feriado');
    return prisma.holiday.delete({ where: { id } });
  },

  /**
   * Importa os feriados nacionais do ano. Dias já marcados são mantidos como
   * estão — um fechamento próprio nunca é sobrescrito pela lista oficial.
   */
  async importNational(companyId: string, year: number) {
    const holidays = nationalHolidays(year);

    const existing = await prisma.holiday.findMany({
      where: { date: { in: holidays.map((h) => h.date) } },
      select: { date: true },
    });
    const taken = new Set(existing.map((h) => h.date.getTime()));

    const missing = holidays.filter((h) => !taken.has(h.date.getTime()));

    if (missing.length > 0) {
      await prisma.holiday.createMany({
        data: missing.map((h) => ({ companyId, date: h.date, name: h.name, national: true })),
      });
    }

    return { imported: missing.length, skipped: holidays.length - missing.length, year };
  },
};

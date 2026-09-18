import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  return typeof value === 'string' ? parseISO(value) : value;
}

export const currency = (value: number | string | null | undefined): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));

export const compactCurrency = (value: number | null | undefined): string => {
  const n = Number(value ?? 0);
  if (Math.abs(n) >= 1000) {
    return `R$ ${new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)}`;
  }
  return currency(n);
};

export const percent = (value: number | null | undefined, digits = 1): string =>
  `${Number(value ?? 0).toFixed(digits).replace('.', ',')}%`;

export const number = (value: number | null | undefined): string =>
  new Intl.NumberFormat('pt-BR').format(Number(value ?? 0));

/**
 * Data de calendário (coluna DATE), sem hora.
 *
 * A API devolve "2026-01-01T00:00:00.000Z". Interpretar isso no fuso local
 * jogaria para 31/12 — então só a parte da data conta, ancorada ao meio-dia
 * para nenhum horário de verão empurrar de novo.
 */
export function calendarDate(value: string | Date): Date {
  const iso = typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  return new Date(`${iso}T12:00:00`);
}

export function dateLabel(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return format(date, "dd 'de' MMM 'de' yyyy", { locale: ptBR });
}

export function shortDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return format(date, 'dd/MM/yyyy', { locale: ptBR });
}

export function timeLabel(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return format(date, 'HH:mm');
}

export function dateTimeLabel(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function relativeDay(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  if (isToday(date)) return 'Hoje';
  if (isTomorrow(date)) return 'Amanhã';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
}

export function fromNow(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

export function weekdayName(weekday: number, short = false): string {
  const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const shortNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return short ? shortNames[weekday] : names[weekday];
}

/**
 * Máscara de telefone enquanto a pessoa digita.
 *
 * Diferente de `phoneMask`, que só formata número completo para exibir: esta
 * formata a cada tecla, ainda pela metade. Trabalha sempre a partir dos dígitos,
 * nunca do texto já formatado — assim apagar com backspace funciona sem deixar
 * parênteses órfãos para trás.
 *
 * Os dois formatos do Brasil: fixo com 8 dígitos e celular com 9. Qual é só se
 * sabe no 11º dígito, então até lá vale o de fixo e o traço anda um lugar
 * quando o último chega.
 */
export function phoneTyping(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);

  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Máscara de CPF ou CNPJ enquanto a pessoa digita.
 *
 * Qual dos dois é só se sabe no 12º dígito — até lá vale o formato de CPF, e a
 * pontuação se reescreve sozinha quando o número passa de 11. Como em
 * `phoneTyping`, formata sempre a partir dos dígitos, nunca do texto já
 * pontuado, para o backspace não esbarrar em ponto e barra.
 */
export function documentTyping(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14);

  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function phoneMask(value?: string | null): string {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return value;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return format(new Date(year, month - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
}

import { useMemo, useState } from 'react';
import { endOfMonth, endOfWeek, format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchSelect } from '@/components/ui/search-select';
import {
  useBookingMutations,
  useBookingPreview,
  useProfessionals,
  useResources,
  useShifts,
} from '@/api/queries';
import { currency } from '@/lib/format';
import type { BookingPreview } from '@/api/queries';
import { cn } from '@/lib/utils';

export interface BookingTarget {
  resourceId: string;
  resourceName: string;
  shiftId: string | null;
  shiftName: string;
}

type Period = 'day' | 'week' | 'month' | 'custom';

/** O atalho diz onde o período **termina** — ele sempre começa no dia aberto. */
const PERIOD_LABEL: Record<Period, string> = {
  day: 'Só este dia',
  week: 'Até o fim da semana',
  month: 'Até o fim do mês',
  custom: 'Escolher período',
};

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/**
 * Reserva de um turno ou de um período inteiro.
 *
 * A locação real tem vários formatos — um turno solto, a semana toda, "terça e
 * quinta de manhã até o fim do mês", "segunda a sábado o mês inteiro". Todos
 * cabem no mesmo desenho: um intervalo de datas, quais dias da semana valem e
 * quais turnos. O resumo mostra quantos turnos e quanto dá antes de gravar.
 */
export function BookingDialog({
  target,
  date,
  onClose,
}: {
  target: BookingTarget | null;
  date: Date;
  onClose: () => void;
}) {
  const { create } = useBookingMutations();
  const { data: shifts } = useShifts();
  const { data: professionals } = useProfessionals({ isActive: 'true' });
  const { data: resources } = useResources({ isRentable: 'true' });

  const [professionalId, setProfessionalId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [shiftIds, setShiftIds] = useState<string[]>([]);
  const [kind, setKind] = useState<'SHIFT' | 'DAILY'>('SHIFT');
  const [period, setPeriod] = useState<Period>('day');
  const [customUntil, setCustomUntil] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [customPrice, setCustomPrice] = useState('');

  const open = Boolean(target);

  // Sincroniza com a célula clicada no mapa do dia.
  const effectiveResource = resourceId || target?.resourceId || '';
  const effectiveShifts = shiftIds.length ? shiftIds : target?.shiftId ? [target.shiftId] : [];

  const until = useMemo(() => {
    if (period === 'day') return null;
    if (period === 'week') return endOfWeek(date, { weekStartsOn: 0 });
    if (period === 'month') return endOfMonth(date);
    return customUntil ? new Date(`${customUntil}T00:00:00`) : null;
  }, [period, date, customUntil]);

  const ready =
    Boolean(effectiveResource) &&
    Boolean(professionalId) &&
    (kind === 'DAILY' || effectiveShifts.length > 0) &&
    (period !== 'custom' || Boolean(customUntil));

  const body = ready
    ? {
        resourceId: effectiveResource,
        professionalId,
        date: date.toISOString(),
        until: until ? until.toISOString() : undefined,
        weekdays: weekdays.length ? weekdays : undefined,
        kind,
        shiftIds: kind === 'SHIFT' ? effectiveShifts : undefined,
        price: customPrice ? Number(customPrice) : undefined,
      }
    : null;

  const preview = useBookingPreview(body);

  /**
   * Dias corridos que o período cobre.
   *
   * O período começa no dia que está aberto no mapa, não no começo da semana:
   * abrindo numa sexta, "até o fim da semana" alcança só sexta e sábado. Sem
   * dizer isso, marcar quarta e quinta e ver dois turnos parece erro de conta.
   */
  const rangeDays = useMemo(() => {
    const start = startOfDay(date);
    const end = until ? startOfDay(until) : start;
    if (end < start) return [];

    const list: Date[] = [];
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      list.push(new Date(cursor));
    }
    return list;
  }, [date, until]);

  // Dia da semana marcado que não aparece nenhuma vez no período escolhido.
  const outOfRange = useMemo(() => {
    if (weekdays.length === 0 || rangeDays.length === 0) return [];
    const present = new Set(rangeDays.map((day) => day.getDay()));
    return weekdays.filter((weekday) => !present.has(weekday)).sort();
  }, [weekdays, rangeDays]);

  function reset() {
    setProfessionalId('');
    setResourceId('');
    setShiftIds([]);
    setKind('SHIFT');
    setPeriod('day');
    setCustomUntil('');
    setWeekdays([]);
    setCustomPrice('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body) return;
    await create
      .mutateAsync(body)
      .then(() => {
        onClose();
        reset();
      })
      .catch(() => undefined);
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reservar espaço</DialogTitle>
          <DialogDescription>
            A partir de {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            {target?.resourceName ? ` · ${target.resourceName}` : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Espaço *</Label>
            <SearchSelect
              options={(resources?.data ?? []).map((resource) => ({
                value: resource.id,
                label: resource.name,
                description: resource.category?.name,
              }))}
              value={effectiveResource}
              onChange={setResourceId}
              placeholder="Selecione o espaço"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Profissional *</Label>
            <SearchSelect
              options={(professionals?.data ?? []).map((professional) => ({
                value: professional.id,
                label: professional.name,
                description: professional.specialties.join(', '),
                color: professional.color,
              }))}
              value={professionalId}
              onChange={setProfessionalId}
              placeholder="Quem vai usar o espaço"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as 'SHIFT' | 'DAILY')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SHIFT">Por turno</SelectItem>
                <SelectItem value="DAILY">Diária (dia inteiro)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === 'SHIFT' ? (
            <div className="space-y-1.5">
              <Label>Turnos *</Label>
              <div className="flex flex-wrap gap-2">
                {(shifts ?? []).map((shift) => {
                  const active = effectiveShifts.includes(shift.id);
                  return (
                    <button
                      key={shift.id}
                      type="button"
                      onClick={() => setShiftIds(toggle(effectiveShifts, shift.id))}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'hover:bg-muted',
                      )}
                    >
                      {shift.name}
                      <span
                        className={cn(
                          'ml-1.5 text-xs',
                          active ? 'opacity-80' : 'text-muted-foreground',
                        )}
                      >
                        {shift.startsAt}–{shift.endsAt}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Pode marcar mais de um — manhã e tarde no mesmo dia, por exemplo.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Por quanto tempo</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PERIOD_LABEL) as Period[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPeriod(option)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    period === option
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'hover:bg-muted',
                  )}
                >
                  {PERIOD_LABEL[option]}
                </button>
              ))}
            </div>
          </div>

          {rangeDays.length > 0 ? (
            <p className="-mt-1 text-xs text-muted-foreground">
              De {format(rangeDays[0], "EEE dd/MM", { locale: ptBR })} até{' '}
              {format(rangeDays[rangeDays.length - 1], "EEE dd/MM", { locale: ptBR })} ·{' '}
              {rangeDays.length} {rangeDays.length === 1 ? 'dia' : 'dias'}
            </p>
          ) : null}

          {period === 'custom' ? (
            <div className="space-y-1.5">
              <Label htmlFor="until">Até o dia *</Label>
              <Input
                id="until"
                type="date"
                min={format(date, 'yyyy-MM-dd')}
                value={customUntil}
                onChange={(e) => setCustomUntil(e.target.value)}
              />
            </div>
          ) : null}

          {period !== 'day' ? (
            <div className="space-y-1.5">
              <Label>Dias da semana</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_LABELS.map((label, weekday) => {
                  const active = weekdays.includes(weekday);
                  return (
                    <button
                      key={weekday}
                      type="button"
                      onClick={() => setWeekdays(toggle(weekdays, weekday))}
                      className={cn(
                        'size-9 rounded-lg border text-sm transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'hover:bg-muted',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {outOfRange.length > 0 ? (
                <p className="text-xs text-amber-600">
                  {outOfRange.map((weekday) => WEEKDAY_NAMES[weekday]).join(' e ')}{' '}
                  {outOfRange.length === 1 ? 'não cai' : 'não caem'} dentro deste período — só
                  contam os dias a partir de {format(rangeDays[0], "dd/MM", { locale: ptBR })}.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nenhum marcado = todos os dias do período.
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="price">Valor por turno (opcional)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              placeholder="Usa a tabela do espaço × turno"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
            />
          </div>

          {preview.data ? <PeriodSummary preview={preview.data} /> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={create.isPending}
              disabled={!ready || preview.data?.available === 0}
            >
              Reservar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Resumo do período antes de gravar.
 *
 * Mostra os três números juntos — quantos turnos o período gera, quantos estão
 * livres e quantos já estão ocupados — porque exibir só o total livre faz
 * parecer que a conta saiu errada quando a dona marcou dois dias e viu um.
 */
function PeriodSummary({ preview }: { preview: BookingPreview }) {
  const blocked = preview.days.filter((day) => !day.available);

  if (preview.available === 0) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <p className="font-medium text-destructive">Nenhum dia livre neste período</p>
        <BlockedList days={blocked} />
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
      {blocked.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {preview.total} {preview.total === 1 ? 'turno' : 'turnos'} no período
        </p>
      ) : null}

      <p className="font-medium">
        {preview.available} {preview.available === 1 ? 'turno livre' : 'turnos livres'} ·{' '}
        {currency(preview.amount)}
      </p>

      {blocked.length > 0 ? (
        <div className="border-t pt-2">
          <p className="text-xs font-medium text-amber-600">
            {blocked.length}{' '}
            {blocked.length === 1 ? 'turno já ocupado será pulado' : 'turnos já ocupados serão pulados'}
          </p>
          <BlockedList days={blocked} />
        </div>
      ) : null}
    </div>
  );
}

function BlockedList({ days }: { days: BookingPreview['days'] }) {
  return (
    <ul className="mt-1.5 space-y-1">
      {days.slice(0, 4).map((day) => (
        <li key={`${day.date}-${day.shiftId}`} className="text-xs text-muted-foreground">
          <span className="font-medium capitalize">
            {format(new Date(day.date), "EEE dd/MM", { locale: ptBR })} · {day.shift}
          </span>
          {day.reason ? ` — ${day.reason}` : ''}
        </li>
      ))}
      {days.length > 4 ? (
        <li className="text-xs text-muted-foreground">e mais {days.length - 4}…</li>
      ) : null}
    </ul>
  );
}

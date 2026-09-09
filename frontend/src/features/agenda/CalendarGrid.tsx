import { useMemo } from 'react';
import { isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { timeLabel } from '@/lib/format';
import { APPOINTMENT_STATUS } from '@/config/labels';
import type { Appointment } from '@/types';

const HOUR_HEIGHT = 60;

interface CalendarGridProps {
  days: Date[];
  appointments: Appointment[];
  startHour?: number;
  endHour?: number;
  onSelectAppointment: (appointment: Appointment) => void;
  onSelectSlot: (date: Date) => void;
}

/**
 * Posiciona eventos sobrepostos lado a lado dentro da coluna do dia.
 *
 * A largura é calculada por **grupo de sobreposição**, não pelo dia inteiro:
 * um atendimento sozinho às 13h ocupa a coluna toda mesmo que outros dois se
 * cruzem às 10h. Antes todos encolhiam junto.
 */
function layout(appointments: Appointment[]) {
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  const placed: { appointment: Appointment; columnIndex: number; total: number }[] = [];

  // Um grupo termina quando surge um evento que começa depois do fim de todos
  // os anteriores — daí ninguém mais se cruza e a largura recomeça.
  let group: Appointment[] = [];
  let groupEnd = 0;

  const flush = () => {
    if (group.length === 0) return;

    const columns: Appointment[][] = [];
    for (const appointment of group) {
      const start = new Date(appointment.startsAt).getTime();
      const column = columns.find(
        (candidate) => new Date(candidate[candidate.length - 1].endsAt).getTime() <= start,
      );
      if (column) column.push(appointment);
      else columns.push([appointment]);
    }

    for (const appointment of group) {
      placed.push({
        appointment,
        columnIndex: columns.findIndex((column) => column.includes(appointment)),
        total: columns.length,
      });
    }

    group = [];
    groupEnd = 0;
  };

  for (const appointment of sorted) {
    const start = new Date(appointment.startsAt).getTime();
    const end = new Date(appointment.endsAt).getTime();

    if (group.length > 0 && start >= groupEnd) flush();

    group.push(appointment);
    groupEnd = Math.max(groupEnd, end);
  }

  flush();
  return placed;
}

export function CalendarGrid({
  days,
  appointments,
  startHour = 7,
  endHour = 22,
  onSelectAppointment,
  onSelectSlot,
}: CalendarGridProps) {
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour],
  );

  const now = new Date();
  const nowOffset = (now.getHours() - startHour) * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        {/* Cabeçalho dos dias */}
        <div
          className="sticky top-0 z-10 grid border-b bg-card"
          style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div />
          {days.map((day) => {
            const today = isSameDay(day, now);
            return (
              <div key={day.toISOString()} className="border-l px-2 py-2 text-center">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {day.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                </p>
                <p
                  className={cn(
                    'mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold',
                    today && 'bg-primary text-primary-foreground',
                  )}
                >
                  {day.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Grade de horários */}
        {/* O rótulo da hora sobe meia linha para encostar na divisória; o
            respiro no topo evita que o primeiro fique escondido sob o cabeçalho. */}
        <div
          className="relative grid pt-2.5"
          style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="relative border-b border-border/50 pr-2 text-right"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2 right-2 text-[11px] text-muted-foreground">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayAppointments = appointments.filter((appointment) =>
              isSameDay(new Date(appointment.startsAt), day),
            );
            const positioned = layout(dayAppointments);
            const isToday = isSameDay(day, now);

            return (
              <div key={day.toISOString()} className="relative border-l">
                {hours.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => {
                      const slot = new Date(day);
                      slot.setHours(hour, 0, 0, 0);
                      onSelectSlot(slot);
                    }}
                    className="w-full border-b border-border/50 transition-colors hover:bg-primary/5"
                    style={{ height: HOUR_HEIGHT }}
                    aria-label={`Criar agendamento às ${hour}:00`}
                  />
                ))}

                {isToday && nowOffset > 0 && nowOffset < hours.length * HOUR_HEIGHT ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                    style={{ top: nowOffset }}
                  >
                    <span className="size-2 rounded-full bg-rose-500" />
                    <span className="h-px flex-1 bg-rose-500" />
                  </div>
                ) : null}

                {positioned.map(({ appointment, columnIndex, total }) => {
                  const start = new Date(appointment.startsAt);
                  const end = new Date(appointment.endsAt);
                  const top =
                    (start.getHours() - startHour) * HOUR_HEIGHT +
                    (start.getMinutes() / 60) * HOUR_HEIGHT;
                  const height = Math.max(
                    20,
                    ((end.getTime() - start.getTime()) / 3_600_000) * HOUR_HEIGHT - 2,
                  );
                  const status = APPOINTMENT_STATUS[appointment.status];
                  const color = appointment.professional?.color ?? '#7C3AED';
                  // Abaixo de ~45px não cabem duas linhas: o serviço sairia
                  // cortado por baixo do bloco. Fica só o essencial, e o resto
                  // no title e no detalhe.
                  const compact = height < 46;

                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => onSelectAppointment(appointment)}
                      className={cn(
                        'absolute overflow-hidden rounded-md border-l-[3px] px-2 text-left text-[11px] leading-tight shadow-soft transition-all hover:z-20 hover:shadow-pop',
                        compact ? 'flex items-center py-0' : 'py-1',
                        appointment.status === 'CANCELED' && 'opacity-50 line-through',
                      )}
                      style={{
                        top,
                        height,
                        left: `calc(${(columnIndex / total) * 100}% + 2px)`,
                        width: `calc(${100 / total}% - 4px)`,
                        borderLeftColor: color,
                        backgroundColor: `${color}1a`,
                      }}
                      title={`${timeLabel(appointment.startsAt)} · ${appointment.customer.name} — ${appointment.services.map((item) => item.name).join(', ')} (${status.label})`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground">
                          {timeLabel(appointment.startsAt)} {appointment.customer.name}
                        </span>
                        {compact ? null : (
                          <span className="block truncate text-muted-foreground">
                            {appointment.services.map((item) => item.name).join(', ')}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

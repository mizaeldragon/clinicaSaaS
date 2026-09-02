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

/** Posiciona eventos sobrepostos lado a lado dentro da coluna do dia. */
function layout(appointments: Appointment[]) {
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  const columns: Appointment[][] = [];

  for (const appointment of sorted) {
    const start = new Date(appointment.startsAt).getTime();
    let placed = false;

    for (const column of columns) {
      const last = column[column.length - 1];
      if (new Date(last.endsAt).getTime() <= start) {
        column.push(appointment);
        placed = true;
        break;
      }
    }

    if (!placed) columns.push([appointment]);
  }

  const total = Math.max(1, columns.length);
  return sorted.map((appointment) => {
    const columnIndex = columns.findIndex((column) => column.includes(appointment));
    return { appointment, columnIndex, total };
  });
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
        <div
          className="relative grid"
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
                    22,
                    ((end.getTime() - start.getTime()) / 3_600_000) * HOUR_HEIGHT - 2,
                  );
                  const status = APPOINTMENT_STATUS[appointment.status];
                  const color = appointment.professional?.color ?? '#7C3AED';

                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => onSelectAppointment(appointment)}
                      className={cn(
                        'absolute overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left text-[11px] shadow-soft transition-all hover:z-20 hover:shadow-pop',
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
                      title={`${appointment.customer.name} — ${status.label}`}
                    >
                      <span className="block truncate font-semibold text-foreground">
                        {timeLabel(appointment.startsAt)} {appointment.customer.name}
                      </span>
                      <span className="block truncate text-muted-foreground">
                        {appointment.services.map((s) => s.name).join(', ')}
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

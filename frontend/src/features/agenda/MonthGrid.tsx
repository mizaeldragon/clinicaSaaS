import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { APPOINTMENT_STATUS } from '@/config/labels';
import { cn } from '@/lib/utils';
import { timeLabel } from '@/lib/format';
import type { Appointment } from '@/types';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function MonthGrid({
  reference,
  appointments,
  onSelectDay,
  onSelectAppointment,
}: {
  reference: Date;
  appointments: Appointment[];
  onSelectDay: (date: Date) => void;
  onSelectAppointment: (appointment: Appointment) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(reference), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(reference), { weekStartsOn: 0 }),
  });

  const today = new Date();

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayAppointments = appointments
              .filter((appointment) => isSameDay(new Date(appointment.startsAt), day))
              .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

            const outside = !isSameMonth(day, reference);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[116px] border-b border-r p-1.5 transition-colors last:border-r-0',
                  outside && 'bg-muted/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectDay(day)}
                  className={cn(
                    'mb-1 flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-colors hover:bg-primary/10',
                    isSameDay(day, today) && 'bg-primary text-primary-foreground',
                    outside && 'text-muted-foreground',
                  )}
                >
                  {day.getDate()}
                </button>

                <div className="space-y-1">
                  {dayAppointments.slice(0, 3).map((appointment) => {
                    const status = APPOINTMENT_STATUS[appointment.status];
                    const proColor = appointment.professional?.color ?? '#7C3AED';
                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => onSelectAppointment(appointment)}
                        className={cn(
                          'flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] transition-colors hover:brightness-95',
                          appointment.status === 'CANCELED' && 'opacity-50 line-through',
                        )}
                        style={{ backgroundColor: `${status.color}1f` }}
                        title={`${appointment.customer.name} — ${status.label}`}
                      >
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: proColor }}
                        />
                        <span className="shrink-0 font-medium">{timeLabel(appointment.startsAt)}</span>
                        <span className="truncate text-muted-foreground">
                          {appointment.customer.name}
                        </span>
                      </button>
                    );
                  })}

                  {dayAppointments.length > 3 ? (
                    <button
                      type="button"
                      onClick={() => onSelectDay(day)}
                      className="px-1.5 text-[11px] font-medium text-primary hover:underline"
                    >
                      +{dayAppointments.length - 3} mais
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

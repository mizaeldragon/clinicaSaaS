import { isSameDay } from 'date-fns';
import { CalendarPlus, Clock } from 'lucide-react';
import { APPOINTMENT_STATUS } from '@/config/labels';
import { EmptyState } from '@/components/ui/feedback';
import { UserAvatar } from '@/components/ui/primitives';
import { AppointmentStatusBadge } from '@/components/StatusBadge';
import { currency, timeLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/types';

/**
 * Experiência de agenda pensada para o celular: lista cronológica por dia,
 * com alvos de toque grandes em vez da grade de horários.
 */
export function MobileAgenda({
  days,
  appointments,
  onSelectAppointment,
  onCreate,
}: {
  days: Date[];
  appointments: Appointment[];
  onSelectAppointment: (appointment: Appointment) => void;
  onCreate: () => void;
}) {
  const hasAny = appointments.length > 0;

  if (!hasAny) {
    return (
      <EmptyState
        icon={CalendarPlus}
        title="Nenhum atendimento no período"
        description="Toque em novo agendamento para começar a preencher a agenda."
        action={{ label: 'Novo agendamento', onClick: onCreate }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {days.map((day) => {
        const dayAppointments = appointments
          .filter((appointment) => isSameDay(new Date(appointment.startsAt), day))
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

        if (dayAppointments.length === 0) return null;

        return (
          <section key={day.toISOString()} className="space-y-2">
            <div className="sticky top-16 z-10 -mx-4 bg-background/95 px-4 py-1.5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {day.toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                })}
              </p>
            </div>

            <div className="space-y-2">
              {dayAppointments.map((appointment) => {
                // A faixa da esquerda mostra a situação, como na semana; a
                // profissional continua no avatar da direita.
                const status = APPOINTMENT_STATUS[appointment.status];
                const proColor = appointment.professional?.color ?? '#7C3AED';
                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => onSelectAppointment(appointment)}
                    className={cn(
                      'flex w-full items-stretch gap-3 rounded-xl border border-border/70 bg-card p-3 text-left shadow-soft transition-colors active:bg-muted',
                      appointment.status === 'CANCELED' && 'opacity-60',
                    )}
                  >
                    <div
                      className="w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: status.color }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Clock className="size-3.5 text-muted-foreground" />
                        {timeLabel(appointment.startsAt)} – {timeLabel(appointment.endsAt)}
                      </div>
                      <p className="truncate text-sm">{appointment.customer.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {appointment.services.map((s) => s.name).join(', ')}
                        {appointment.room ? ` · ${appointment.room.name}` : ''}
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <AppointmentStatusBadge status={appointment.status} />
                        <span className="text-xs font-medium">{currency(appointment.totalPrice)}</span>
                      </div>
                    </div>
                    {appointment.professional ? (
                      <UserAvatar
                        name={appointment.professional.name}
                        color={proColor}
                        className="size-9 self-center"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

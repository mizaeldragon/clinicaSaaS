import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { addDays, format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Clock,
  MapPin,
  MessageCircle,
  Sparkles,
  User,
} from 'lucide-react';
import {
  usePublicAppointment,
  usePublicAppointmentActions,
  usePublicAvailability,
  type PublicSlot,
} from '@/api/public';
import { Button } from '@/components/ui/button';
import { PageLoader, Spinner } from '@/components/ui/feedback';
import { ApiError } from '@/lib/api';
import { applyBrandColor, cn } from '@/lib/utils';
import { currency, dateTimeLabel } from '@/lib/format';

/**
 * O horário da cliente, aberto pelo link que ela recebeu.
 *
 * Sem conta e sem senha: o token do endereço é a credencial. Ela consulta,
 * remarca dentro da disponibilidade real da profissional ou cancela — sem
 * precisar ligar para o espaço.
 */
export function PublicAppointmentPage() {
  const { slug = '', token } = useParams();
  const { data, isLoading, error } = usePublicAppointment(slug, token);
  const { cancel, reschedule } = usePublicAppointmentActions(slug, token);

  const [mode, setMode] = useState<'view' | 'reschedule' | 'confirm-cancel'>('view');
  const [date, setDate] = useState<Date>(() => new Date());

  useEffect(() => {
    if (data?.company.primaryColor) applyBrandColor(data.company.primaryColor);
  }, [data]);

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)), []);

  const availability = usePublicAvailability(
    slug,
    mode === 'reschedule' ? data?.appointment.service?.serviceId : undefined,
    date.toISOString(),
    data?.appointment.professional?.id,
    data?.appointment.id,
  );

  if (isLoading) return <PageLoader label="Carregando seu horário..." />;

  if (error || !data) {
    const message =
      error instanceof ApiError ? error.message : 'Não encontramos este agendamento.';
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Link indisponível</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  const { company, appointment } = data;
  const address = [company.addressStreet, company.addressNumber, company.addressCity]
    .filter(Boolean)
    .join(', ');

  const canceled = appointment.status === 'CANCELED';
  const slots = availability.data?.professionals[0]?.slots ?? [];

  async function confirmReschedule(slot: PublicSlot) {
    await reschedule.mutateAsync(slot.startsAt).then(() => setMode('view')).catch(() => undefined);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground">
            {company.logoUrl ? (
              <img src={company.logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <Sparkles className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">{company.name}</h1>
            {address ? (
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {address}
              </p>
            ) : null}
          </div>
          {company.whatsapp ? (
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://wa.me/55${company.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            </Button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6 pb-16">
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                Olá, {appointment.customerName.split(' ')[0]}
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {canceled ? 'Agendamento cancelado' : 'Seu horário está marcado'}
              </h2>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                canceled
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-emerald-500/10 text-emerald-600',
              )}
            >
              {canceled ? 'Cancelado' : 'Confirmado'}
            </span>
          </div>

          <ul className="space-y-3 border-t pt-4 text-sm">
            <li className="flex items-center gap-3">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">{dateTimeLabel(appointment.startsAt)}</span>
            </li>
            {appointment.service ? (
              <li className="flex items-center gap-3">
                <Clock className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  {appointment.service.name} · {appointment.service.durationMinutes} min ·{' '}
                  {currency(appointment.totalPrice)}
                </span>
              </li>
            ) : null}
            {appointment.professional ? (
              <li className="flex items-center gap-3">
                <User className="size-4 shrink-0 text-muted-foreground" />
                <span>com {appointment.professional.name}</span>
              </li>
            ) : null}
          </ul>
        </div>

        {!appointment.changeable ? (
          <p className="mt-4 rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
            {canceled
              ? 'Este horário foi cancelado. Para marcar de novo, use o link de agendamento do espaço.'
              : 'Este horário não pode mais ser alterado por aqui. Fale com o espaço pelo WhatsApp.'}
          </p>
        ) : mode === 'view' ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="flex-1" onClick={() => setMode('reschedule')}>
              <CalendarCheck />
              Remarcar
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setMode('confirm-cancel')}>
              <CalendarX />
              Cancelar
            </Button>
          </div>
        ) : mode === 'confirm-cancel' ? (
          <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
            <p className="font-medium">Cancelar este horário?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A vaga volta para a agenda e outra pessoa pode marcar. Não dá para desfazer.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="destructive"
                loading={cancel.isPending}
                onClick={() => cancel.mutateAsync(undefined).then(() => setMode('view')).catch(() => undefined)}
              >
                Sim, cancelar
              </Button>
              <Button variant="ghost" onClick={() => setMode('view')}>
                Manter o horário
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setMode('view')}>
              <ArrowLeft />
              Voltar
            </Button>

            <div>
              <p className="mb-2 text-sm font-medium">Escolha o novo dia</p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                {days.map((day) => {
                  const active = isSameDay(day, date);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => setDate(day)}
                      className={cn(
                        'flex w-16 shrink-0 flex-col items-center rounded-xl border py-2.5 transition-colors',
                        active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                      )}
                    >
                      <span className="text-[10px] uppercase opacity-70">
                        {format(day, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)}
                      </span>
                      <span className="text-lg font-semibold leading-tight">
                        {format(day, 'dd')}
                      </span>
                      <span className="text-[10px] opacity-70">
                        {format(day, 'MMM', { locale: ptBR })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Horários livres</p>
              {availability.isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : slots.length === 0 ? (
                <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Nenhum horário livre neste dia. Escolha outra data.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      disabled={reschedule.isPending}
                      onClick={() => confirmReschedule(slot)}
                      className="rounded-xl border py-2.5 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

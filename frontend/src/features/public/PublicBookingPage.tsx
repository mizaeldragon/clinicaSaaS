import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { addDays, format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Check,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
} from 'lucide-react';
import {
  useProfessionalStorefront,
  usePublicAvailability,
  usePublicBooking,
  useStorefront,
  type PublicSlot,
  type Storefront,
} from '@/api/public';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/field';
import { Label, UserAvatar } from '@/components/ui/primitives';
import { PageLoader, Spinner } from '@/components/ui/feedback';
import { ApiError } from '@/lib/api';
import { applyBrandColor, cn } from '@/lib/utils';
import { useAgendaPublicaAoVivo } from '@/hooks/useAgendaPublicaAoVivo';
import { currency, dateTimeLabel } from '@/lib/format';

type Step = 'service' | 'date' | 'slot' | 'form' | 'done';

const STEP_LABELS: Record<Exclude<Step, 'done'>, string> = {
  service: 'Serviço',
  date: 'Data',
  slot: 'Horário',
  form: 'Seus dados',
};

/**
 * Página pública de agendamento, em dois formatos:
 *
 * - `/e/{empresa}` — a vitrine do espaço inteiro, com todas as profissionais;
 * - `/e/{empresa}/{profissional}` — o link individual, que cada uma divulga
 *   para as próprias clientes. A dona do espaço tem o dela e cada locatária
 *   tem o seu.
 */
export function PublicBookingPage() {
  const { slug = '', professionalSlug } = useParams();

  // Enquanto a cliente decide, outra pode estar marcando o mesmo horario.
  useAgendaPublicaAoVivo(slug);
  const solo = Boolean(professionalSlug);

  const space = useStorefront(slug, !solo);
  const individual = useProfessionalStorefront(slug, professionalSlug);

  const source = solo ? individual : space;
  const isLoading = source.isLoading;
  const error = source.error;

  // A vitrine individual traz uma profissional só; o resto da tela é igual.
  const data: Storefront | undefined = useMemo(() => {
    if (!solo) return space.data;
    if (!individual.data) return undefined;
    const { company, categories, services, professional } = individual.data;
    return { company, categories, services, professionals: [professional] };
  }, [solo, space.data, individual.data]);

  const host = solo ? individual.data?.professional : null;

  const [step, setStep] = useState<Step>('service');
  const [serviceId, setServiceId] = useState<string>('');
  const [date, setDate] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<{ professionalId: string; slot: PublicSlot } | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });

  const availability = usePublicAvailability(
    slug,
    step === 'slot' || step === 'form' ? serviceId : undefined,
    date.toISOString(),
    host?.id,
  );
  const booking = usePublicBooking(slug);

  useEffect(() => {
    if (data?.company.primaryColor) applyBrandColor(data.company.primaryColor);
  }, [data]);

  const service = useMemo(
    () => data?.services.find((s) => s.id === serviceId),
    [data, serviceId],
  );

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)),
    [],
  );

  if (isLoading) return <PageLoader label="Carregando..." />;

  if (error || !data) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'Não encontramos esta página de agendamento.';
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Página indisponível</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  const { company } = data;
  const address = [company.addressStreet, company.addressNumber, company.addressCity, company.addressState]
    .filter(Boolean)
    .join(', ');

  async function confirm() {
    if (!selected || !service) return;
    await booking
      .mutateAsync({
        serviceId: service.id,
        professionalId: selected.professionalId,
        startsAt: selected.slot.startsAt,
        customer: {
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
        },
        notes: form.notes || undefined,
      })
      .then(() => setStep('done'))
      .catch(() => undefined);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground">
            {host?.avatarUrl ? (
              <img src={host.avatarUrl} alt="" className="size-full object-cover" />
            ) : company.logoUrl ? (
              <img src={company.logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <Sparkles className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {host ? (
              <>
                <h1 className="truncate text-lg font-semibold tracking-tight">{host.name}</h1>
                <p className="truncate text-xs text-muted-foreground">
                  {company.name}
                  {address ? ` · ${address}` : ''}
                </p>
              </>
            ) : (
              <>
                <h1 className="truncate text-lg font-semibold tracking-tight">{company.name}</h1>
                {address ? (
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    {address}
                  </p>
                ) : null}
              </>
            )}
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

      <main className="mx-auto max-w-3xl px-5 py-6 pb-16">
        {step === 'done' ? (
          <Confirmation
            company={company}
            slug={slug}
            result={booking.data}
            onRestart={() => {
              setStep('service');
              setServiceId('');
              setSelected(null);
              setForm({ name: '', phone: '', email: '', notes: '' });
              booking.reset();
            }}
          />
        ) : (
          <>
            {step === 'service' && (host?.bio || company.publicDescription) ? (
              <p className="mb-6 rounded-xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">
                {host?.bio ?? company.publicDescription}
              </p>
            ) : null}

            <div className="mb-6 flex items-center gap-2">
              {(Object.keys(STEP_LABELS) as Exclude<Step, 'done'>[]).map((key, index) => {
                const order: Step[] = ['service', 'date', 'slot', 'form'];
                const currentIndex = order.indexOf(step);
                return (
                  <div key={key} className="flex flex-1 flex-col gap-1.5">
                    <div
                      className={cn(
                        'h-1.5 rounded-full transition-colors',
                        index <= currentIndex ? 'bg-primary' : 'bg-border',
                      )}
                    />
                    <span
                      className={cn(
                        'text-[11px] font-medium',
                        index === currentIndex ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {STEP_LABELS[key]}
                    </span>
                  </div>
                );
              })}
            </div>

            {step !== 'service' ? (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 mb-3"
                onClick={() =>
                  setStep(step === 'date' ? 'service' : step === 'slot' ? 'date' : 'slot')
                }
              >
                <ArrowLeft />
                Voltar
              </Button>
            ) : null}

            {/* ------------------------------------------------- 1. serviço */}
            {step === 'service' ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">O que você quer agendar?</h2>
                  <p className="text-sm text-muted-foreground">
                    Escolha o serviço e mostramos quem está disponível.
                  </p>
                </div>

                {data.categories.map((category) => {
                  const services = data.services.filter((s) => s.categoryId === category.id);
                  if (services.length === 0) return null;

                  return (
                    <section key={category.id} className="space-y-2">
                      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </h3>
                      <div className="grid gap-2">
                        {services.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setServiceId(item.id);
                              setStep('date');
                            }}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 text-left transition-all hover:border-primary hover:shadow-panel"
                          >
                            <div className="min-w-0">
                              <p className="font-medium">{item.name}</p>
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="size-3" />
                                {item.durationMinutes} min
                              </p>
                            </div>
                            <span className="shrink-0 font-semibold">{currency(item.price)}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : null}

            {/* ---------------------------------------------------- 2. data */}
            {step === 'date' ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Para quando?</h2>
                  <p className="text-sm text-muted-foreground">
                    {service?.name} · {service?.durationMinutes} min
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {days.map((day) => (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => {
                        setDate(day);
                        setStep('slot');
                      }}
                      className={cn(
                        'flex flex-col items-center gap-0.5 rounded-xl border border-border/70 bg-card p-3 transition-all hover:border-primary',
                        isSameDay(day, date) && 'border-primary ring-1 ring-primary',
                      )}
                    >
                      <span className="text-[11px] uppercase text-muted-foreground">
                        {format(day, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)}
                      </span>
                      <span className="text-lg font-semibold">{day.getDate()}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(day, 'MMM', { locale: ptBR })}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ------------------------------------------------- 3. horário */}
            {step === 'slot' ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Escolha o horário</h2>
                  <p className="text-sm capitalize text-muted-foreground">
                    {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>

                {availability.isLoading ? (
                  <div className="flex justify-center py-10">
                    <Spinner />
                  </div>
                ) : availability.data?.professionals.length ? (
                  availability.data.professionals.map((entry) => (
                    <section
                      key={entry.professional.id}
                      className="space-y-3 rounded-xl border border-border/70 bg-card p-4"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={entry.professional.name}
                          src={entry.professional.avatarUrl}
                          color={entry.professional.color}
                          className="size-10"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{entry.professional.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {currency(entry.price)} · {entry.durationMinutes} min
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {entry.slots.map((slot) => (
                          <button
                            key={slot.startsAt}
                            type="button"
                            disabled={!slot.disponivel}
                            aria-label={
                              slot.disponivel ? slot.time : `${slot.time} — horário ocupado`
                            }
                            title={slot.disponivel ? undefined : 'Este horário já foi marcado'}
                            onClick={() => {
                              setSelected({ professionalId: entry.professional.id, slot });
                              setStep('form');
                            }}
                            className={cn(
                              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                              slot.disponivel
                                ? 'border-border hover:border-primary hover:bg-primary hover:text-primary-foreground'
                                : // Apagado e riscado: o cinza sozinho ainda parece
                                  // clicável, e o traço diz "ocupado" sem precisar de
                                  // legenda.
                                  'cursor-not-allowed border-transparent bg-muted/60 text-muted-foreground/60 line-through',
                            )}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center">
                    <CalendarDays className="mx-auto mb-2 size-8 text-muted-foreground" />
                    <p className="font-medium">Nenhum horário livre neste dia</p>
                    <p className="text-sm text-muted-foreground">Tente outra data.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setStep('date')}>
                      Escolher outra data
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {/* ---------------------------------------------------- 4. dados */}
            {step === 'form' && selected && service ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Confirme seus dados</h2>
                  <p className="text-sm text-muted-foreground">
                    Falta pouco para o seu horário ficar reservado.
                  </p>
                </div>

                <div className="space-y-1 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                  <p className="font-semibold">{service.name}</p>
                  <p className="text-muted-foreground">
                    {dateTimeLabel(selected.slot.startsAt)} ·{' '}
                    {
                      availability.data?.professionals.find(
                        (p) => p.professional.id === selected.professionalId,
                      )?.professional.name
                    }
                  </p>
                  <p className="pt-1 font-semibold">{currency(service.price)}</p>
                </div>

                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void confirm();
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Seu nome *</Label>
                    <Input
                      id="name"
                      required
                      minLength={2}
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone">WhatsApp *</Label>
                    <PhoneInput
                      id="phone"
                      required
                      icon={<Phone />}
                      value={form.phone}
                      onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail (opcional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Observações (opcional)</Label>
                    <Textarea
                      id="notes"
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>

                  {booking.error ? (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {booking.error instanceof ApiError
                        ? booking.error.message
                        : 'Não foi possível concluir o agendamento.'}
                    </p>
                  ) : null}

                  <Button type="submit" size="lg" className="w-full" loading={booking.isPending}>
                    <CalendarCheck />
                    Confirmar agendamento
                  </Button>
                </form>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function Confirmation({
  company,
  slug,
  result,
  onRestart,
}: {
  company: Storefront['company'];
  slug: string;
  result?: {
    startsAt: string;
    professional: { name: string } | null;
    service: string;
    requiresApproval: boolean;
    token?: string | null;
  };
  onRestart: () => void;
}) {
  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600">
        <Check className="size-8" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {result?.requiresApproval ? 'Pedido enviado!' : 'Agendamento confirmado!'}
        </h2>
        <p className="text-muted-foreground">
          {result?.requiresApproval
            ? 'Assim que confirmarmos, você recebe um aviso.'
            : 'Esperamos por você.'}
        </p>
      </div>

      <div className="mx-auto max-w-sm space-y-1 rounded-xl border border-border/70 bg-card p-5 text-left text-sm">
        <p className="font-semibold">{result?.service}</p>
        <p className="text-muted-foreground">{dateTimeLabel(result?.startsAt)}</p>
        {result?.professional ? (
          <p className="text-muted-foreground">com {result.professional.name}</p>
        ) : null}
        <p className="pt-2 text-xs text-muted-foreground">{company.name}</p>
      </div>

      {result?.token ? (
        <div className="mx-auto max-w-sm rounded-xl border border-primary/30 bg-primary/5 p-4 text-left">
          <p className="text-sm font-medium">Precisa mudar depois?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Guarde este link — por ele você remarca ou cancela sozinha, sem precisar ligar.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3 w-full">
            <a href={`/e/${slug}/agendamento/${result.token}`}>
              <CalendarDays />
              Abrir meu horário
            </a>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-2">
        {company.whatsapp ? (
          <Button asChild variant="outline">
            <a
              href={`https://wa.me/55${company.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle />
              Falar no WhatsApp
            </a>
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onRestart}>
          Agendar outro horário
        </Button>
      </div>
    </div>
  );
}

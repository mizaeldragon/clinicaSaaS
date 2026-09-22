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
    const { company, businessHours, categories, services, professional } = individual.data;
    return { company, businessHours, categories, services, professionals: [professional] };
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
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/10 via-background to-background">
      {/* Recado da casa, acima de tudo. Fica antes da capa de propósito: é
          informação que muda a decisão ("fechado dia 30") e precisa ser lida
          antes de a pessoa começar a escolher serviço. */}
      {company.publicNoticeEnabled && company.publicNotice ? (
        <div className="bg-primary px-5 py-2.5 text-center text-sm font-medium text-primary-foreground">
          {company.publicNotice}
        </div>
      ) : null}

      {/* Capa. Sem foto, nada é renderizado — uma faixa cinza vazia seria pior
          do que não ter capa nenhuma. */}
      {company.publicCoverUrl ? (
        /*
          Altura livre, acompanhando a imagem.
          
          Com altura fixa e `object-cover`, o banner era cortado em cima e
          embaixo: a casa subia uma arte inteira e a cliente via só a faixa do
          meio. Deixando a altura seguir a proporção da foto, aparece o que foi
          enviado — que é o ponto de ter capa.
          
          O teto de 70vh é o freio para uma foto em pé: sem ele, uma imagem
          vertical empurraria a escolha de serviço para fora da tela.
        */
        <div className="relative w-full overflow-hidden bg-muted/30">
          {/* `max-h` limita a altura e `w-auto max-w-full` deixa a largura
              acompanhar: a imagem encolhe inteira, sem cortar nada, e fica
              centrada quando sobra espaço dos lados. */}
          <img
            src={company.publicCoverUrl}
            alt=""
            className="mx-auto max-h-[30vh] w-auto max-w-full object-contain sm:max-h-[38vh]"
            loading="eager"
          />

          {/* Desfoque na base, esmaecendo para cima.
              
              `backdrop-blur` borra o que está atrás; a máscara em gradiente faz
              esse borrão nascer do nada no meio da faixa e chegar cheio na
              borda de baixo. É o que dissolve o corte reto entre a foto e o
              cabeçalho, em vez de uma linha dura. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 backdrop-blur-md [mask-image:linear-gradient(to_top,black_10%,transparent)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background via-background/60 to-transparent"
          />
        </div>
      ) : null}

      <header className="border-b border-border/60 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-4">
          {/*
            O fundo colorido é só para quando NÃO há imagem.

            Ele existe para o ícone genérico não flutuar no branco. Com foto por
            cima, virava uma moldura colorida em volta dela — e numa logo com
            fundo transparente a cor vazava por dentro do desenho, que foi o que
            apareceu na Clínica Bella.
          */}
          <div
            className={cn(
              'flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl',
              host?.avatarUrl || company.logoUrl
                ? ''
                : 'bg-primary text-primary-foreground',
            )}
          >
            {host?.avatarUrl ? (
              <img src={host.avatarUrl} alt="" className="size-full object-contain" />
            ) : company.logoUrl ? (
              <img src={company.logoUrl} alt="" className="size-full object-contain" />
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

      <main className="mx-auto w-full max-w-5xl px-5 py-6 pb-16">
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
                        'flex flex-col items-center gap-0.5 rounded-xl border p-3 transition-all',
                        // Selecionado se pinta por inteiro.
                        //
                        // Só o contorno se perdia entre catorze cartões iguais:
                        // a diferença era uma linha de 1px, e a pessoa voltava
                        // para conferir qual dia tinha escolhido. Preenchido,
                        // ela vê de relance.
                        isSameDay(day, date)
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : 'border-border/70 bg-card hover:border-primary',
                      )}
                    >
                      <span
                        className={cn(
                          'text-[11px] uppercase',
                          isSameDay(day, date) ? 'text-primary-foreground/80' : 'text-muted-foreground',
                        )}
                      >
                        {format(day, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)}
                      </span>
                      <span className="text-lg font-semibold">{day.getDate()}</span>
                      <span
                        className={cn(
                          'text-[10px]',
                          isSameDay(day, date) ? 'text-primary-foreground/80' : 'text-muted-foreground',
                        )}
                      >
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

      <RodapeDaCasa company={company} businessHours={data.businessHours} />
    </div>
  );
}

const DIAS_CURTOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * Endereço, contato e horário de funcionamento no pé da página.
 *
 * Tudo isto já estava no cadastro da empresa e não aparecia em lugar nenhum do
 * link. A cliente que abria fora do expediente só descobria que estava fechado
 * depois de escolher serviço, data e esbarrar em "nenhum horário livre".
 *
 * `mt-auto` gruda o rodapé embaixo: nas telas curtas do fluxo — a escolha de
 * data, por exemplo — sobrava meia tela branca no desktop.
 */
function RodapeDaCasa({
  company,
  businessHours,
}: {
  company: Storefront['company'];
  businessHours: Storefront['businessHours'];
}) {
  const endereco = [
    [company.addressStreet, company.addressNumber].filter(Boolean).join(', '),
    [company.addressCity, company.addressState].filter(Boolean).join(' - '),
    company.addressZip,
  ].filter(Boolean);

  /*
   * Dias seguidos com o mesmo horário viram uma linha só.
   *
   * Sete linhas para uma casa que abre igual de segunda a sexta é ruído: a
   * pessoa lê "Segunda a Sexta · 09:00 às 19:00" de relance, e sete linhas
   * quase idênticas ela não lê.
   */
  const faixas = businessHours.reduce<
    { de: number; ate: number; texto: string }[]
  >((acc, hora) => {
    const texto = hora.isClosed ? 'Fechado' : `${hora.opensAt} às ${hora.closesAt}`;
    const ultima = acc[acc.length - 1];
    if (ultima && ultima.texto === texto && ultima.ate === hora.weekday - 1) {
      ultima.ate = hora.weekday;
      return acc;
    }
    acc.push({ de: hora.weekday, ate: hora.weekday, texto });
    return acc;
  }, []);

  const temContato = company.phone || company.whatsapp;
  if (!endereco.length && !temContato && !faixas.length) return null;

  return (
    <footer className="mt-auto border-t border-border/60 bg-card/50">
      {/*
        Colunas que se ajustam ao que a casa preencheu.

        Com `sm:grid-cols-3` fixo, uma clínica sem endereço cadastrado ficava
        com duas colunas à esquerda e um buraco à direita — parecia defeito. O
        `auto-fit` distribui só o que existe: duas informações ocupam metade
        cada, três ocupam um terço.
      */}
      <div className="mx-auto grid max-w-5xl gap-x-10 gap-y-6 px-5 py-8 text-sm [grid-template-columns:repeat(auto-fit,minmax(min(15rem,100%),1fr))]">
        {endereco.length ? (
          <div>
            <h2 className="mb-2 flex items-center gap-1.5 font-semibold">
              <MapPin className="size-3.5 text-primary" />
              Onde fica
            </h2>
            <address className="not-italic leading-relaxed text-muted-foreground">
              {endereco.map((linha) => (
                <div key={linha}>{linha}</div>
              ))}
            </address>
          </div>
        ) : null}

        {faixas.length ? (
          <div>
            <h2 className="mb-2 flex items-center gap-1.5 font-semibold">
              <Clock className="size-3.5 text-primary" />
              Horário
            </h2>
            {/*
              Grade de duas colunas coladas ao conteúdo, não `justify-between`.

              Espalhando, numa coluna larga o dia ficava numa ponta e o horário
              na outra, com um vão no meio — o olho perdia qual horário era de
              qual dia. `w-fit` mantém os dois juntos e o par legível.
            */}
            <dl className="grid w-fit grid-cols-[auto_auto] gap-x-5 gap-y-1 text-muted-foreground">
              {faixas.map((faixa) => (
                <div key={faixa.de} className="contents">
                  <dt>
                    {faixa.de === faixa.ate
                      ? DIAS_CURTOS[faixa.de]
                      : `${DIAS_CURTOS[faixa.de]} a ${DIAS_CURTOS[faixa.ate]}`}
                  </dt>
                  <dd className="tabular-nums">{faixa.texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {temContato ? (
          <div>
            <h2 className="mb-2 flex items-center gap-1.5 font-semibold">
              <Phone className="size-3.5 text-primary" />
              Falar com a gente
            </h2>
            <div className="space-y-1.5 text-muted-foreground">
              {company.phone ? (
                <a href={`tel:${company.phone.replace(/\D/g, '')}`} className="block hover:text-primary">
                  {company.phone}
                </a>
              ) : null}
              {company.whatsapp ? (
                <a
                  href={`https://wa.me/55${company.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-primary"
                >
                  <MessageCircle className="size-3.5" />
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border/60 px-5 py-3 text-center text-xs text-muted-foreground">
        {company.name}
      </div>
    </footer>
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

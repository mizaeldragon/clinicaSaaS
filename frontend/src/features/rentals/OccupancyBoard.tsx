import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarPlus, ChevronLeft, ChevronRight, KeyRound, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { UserAvatar } from '@/components/ui/primitives';
import { PaymentStatusBadge } from '@/components/StatusBadge';
import { useOccupancy, useShifts, type Occupancy, type RentalBooking } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ShiftBoard } from './ShiftBoard';
import { BookingDialog, type BookingTarget } from './BookingDialog';
import { BookingDetail } from './BookingDetail';

/**
 * Quem alugou o quê — no dia, na semana e no mês.
 *
 * A pergunta é sempre a mesma; o que muda é a distância de onde se olha. No dia
 * a dona resolve ("a Ana pagou?"), na semana ela planeja ("quarta à tarde ainda
 * está vazia") e no mês ela fecha ("quanto o espaço rendeu, e de quem").
 *
 * Por isso as três dividem a mesma barra de navegação e o mesmo cartão de
 * detalhe: trocar de visão não pode parecer trocar de tela.
 *
 * O resumo por profissional aparece embaixo da semana e do mês porque é a
 * resposta literal à pergunta "quem alugou o local nesse período" — uma tabela,
 * não uma varredura de células.
 */

type Range = 'dia' | 'semana' | 'mes';

const RANGES: { value: Range; label: string }[] = [
  { value: 'dia', label: 'Dia' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
];

const iso = (date: Date) => format(date, 'yyyy-MM-dd');

/** O intervalo que cada visão pede ao servidor. */
function periodOf(range: Range, date: Date): { from: Date; to: Date } {
  if (range === 'dia') return { from: date, to: date };
  if (range === 'semana') {
    return { from: startOfWeek(date, { weekStartsOn: 0 }), to: endOfWeek(date, { weekStartsOn: 0 }) };
  }
  // O mês inteiro, e não a grade inteira do calendário: os dias vizinhos que
  // completam a primeira e a última semana não são deste mês nem desta conta.
  return { from: startOfMonth(date), to: endOfMonth(date) };
}

function titleOf(range: Range, date: Date): string {
  if (range === 'dia') return format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
  if (range === 'mes') return format(date, "MMMM 'de' yyyy", { locale: ptBR });

  const { from, to } = periodOf('semana', date);
  const mesmoMes = isSameMonth(from, to);
  return mesmoMes
    ? `${format(from, 'dd')}–${format(to, "dd 'de' MMMM", { locale: ptBR })}`
    : `${format(from, "dd 'de' MMM", { locale: ptBR })} – ${format(to, "dd 'de' MMM", { locale: ptBR })}`;
}

export function OccupancyBoard() {
  const canManage = useAuthStore((s) => s.can('rentals:manage'));

  const [range, setRange] = useState<Range>('dia');
  const [date, setDate] = useState(() => new Date());
  const [detail, setDetail] = useState<RentalBooking | null>(null);
  const [target, setTarget] = useState<BookingTarget | null>(null);
  const [targetDate, setTargetDate] = useState<Date>(() => new Date());

  const { data: shifts } = useShifts();
  const hasShifts = (shifts?.length ?? 0) > 0;

  const { from, to } = periodOf(range, date);
  // No dia quem busca é o próprio quadro (ele precisa das células livres).
  const { data, isLoading } = useOccupancy(iso(from), iso(to), range !== 'dia');

  const passo = (direcao: -1 | 1) => {
    if (range === 'dia') return setDate((d) => addDays(d, direcao));
    if (range === 'semana') return setDate((d) => addDays(d, 7 * direcao));
    return setDate((d) => addMonths(d, direcao));
  };

  const abrirReserva = (dia: Date, resourceId: string, resourceName: string, shiftId: string) => {
    setTargetDate(dia);
    setTarget({
      resourceId,
      resourceName,
      shiftId,
      shiftName: shifts?.find((s) => s.id === shiftId)?.name ?? '',
    });
  };

  return (
    <div className="space-y-4">
      {/* -------------------------------------------------------- navegação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <div className="mr-2 flex rounded-lg border p-0.5">
            {RANGES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setRange(item.value)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  range === item.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Button variant="outline" size="icon-sm" onClick={() => passo(-1)}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => passo(1)}>
            <ChevronRight />
          </Button>
          <span className="ml-2 text-sm font-medium capitalize">{titleOf(range, date)}</span>
        </div>

        {canManage && hasShifts ? (
          <Button
            size="sm"
            onClick={() => {
              setTargetDate(date);
              setTarget({
                resourceId: '',
                resourceName: '',
                shiftId: shifts?.[0]?.id ?? null,
                shiftName: shifts?.[0]?.name ?? '',
              });
            }}
          >
            <CalendarPlus />
            Reservar turno
          </Button>
        ) : null}
      </div>

      {range === 'dia' ? (
        <ShiftBoard date={date} />
      ) : isLoading || !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : !hasShifts ? (
        <EmptyState
          icon={CalendarPlus}
          title="Configure os turnos primeiro"
          description="Crie os turnos (manhã, tarde, noite) e os preços por espaço na aba Configuração."
        />
      ) : (
        <>
          {range === 'semana' ? (
            <WeekGrid
              data={data}
              from={from}
              canManage={canManage}
              onOpen={setDetail}
              onReserve={abrirReserva}
            />
          ) : (
            <MonthGrid
              data={data}
              date={date}
              onPickDay={(dia) => {
                setDate(dia);
                setRange('dia');
              }}
            />
          )}

          <RenterSummary data={data} />
        </>
      )}

      <BookingDialog target={target} date={targetDate} onClose={() => setTarget(null)} />
      <BookingDetail booking={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ semana */

/**
 * Espaço por dia da semana. Cada célula lista os turnos daquele dia — ocupado
 * com o nome de quem alugou, livre com o convite para reservar.
 *
 * É a visão de venda: o buraco de quarta à tarde salta aos olhos.
 */
function WeekGrid({
  data,
  from,
  canManage,
  onOpen,
  onReserve,
}: {
  data: Occupancy;
  from: Date;
  canManage: boolean;
  onOpen: (booking: RentalBooking) => void;
  onReserve: (dia: Date, resourceId: string, resourceName: string, shiftId: string) => void;
}) {
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(from, i)), [from]);

  /** Índice (recurso|dia|turno) → reserva, para não varrer a lista por célula. */
  const mapa = useMemo(() => {
    const m = new Map<string, RentalBooking>();
    for (const b of data.bookings) {
      const dia = iso(new Date(b.date));
      m.set(`${b.resource.id}|${dia}|${b.shift?.id ?? 'diaria'}`, b);
    }
    return m;
  }, [data.bookings]);

  if (!data.resources.length) {
    return (
      <EmptyState
        icon={CalendarPlus}
        title="Nenhum espaço locável"
        description="Marque um recurso como locável em Recursos para começar a alugar turnos."
      />
    );
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b">
            <th className="w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Espaço
            </th>
            {dias.map((dia) => (
              <th
                key={dia.toISOString()}
                className={cn(
                  'px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide',
                  isToday(dia) ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {format(dia, 'EEE', { locale: ptBR })}
                <span className="ml-1 font-normal normal-case">{format(dia, 'dd/MM')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.resources.map((resource) => (
            <tr key={resource.id} className="border-b border-border/70 last:border-0">
              <td className="px-4 py-3 align-top">
                <p className="font-medium leading-tight">{resource.name}</p>
                <p className="text-xs text-muted-foreground">{resource.category?.name}</p>
              </td>

              {dias.map((dia) => {
                const chave = iso(dia);
                const diaria = mapa.get(`${resource.id}|${chave}|diaria`);

                return (
                  <td key={chave} className="px-1.5 py-2 align-top">
                    {diaria ? (
                      <button
                        type="button"
                        onClick={() => onOpen(diaria)}
                        className="w-full rounded-lg border p-1.5 text-left text-[11px] transition-colors hover:bg-muted/60"
                        style={{ borderLeftWidth: 3, borderLeftColor: diaria.professional.color }}
                      >
                        <span className="block truncate font-medium">
                          {diaria.professional.name}
                        </span>
                        <span className="text-muted-foreground">Diária</span>
                      </button>
                    ) : (
                      <div className="space-y-1">
                        {data.shifts.map((shift) => {
                          const booking = mapa.get(`${resource.id}|${chave}|${shift.id}`);
                          const inicial = shift.name.slice(0, 1).toUpperCase();

                          if (booking) {
                            return (
                              <button
                                key={shift.id}
                                type="button"
                                onClick={() => onOpen(booking)}
                                title={`${shift.name} · ${booking.professional.name} · ${currency(booking.price)}`}
                                className="flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-muted/60"
                                style={{
                                  borderLeftWidth: 3,
                                  borderLeftColor: booking.professional.color,
                                }}
                              >
                                <span className="text-muted-foreground">{inicial}</span>
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {booking.professional.name}
                                </span>
                                {booking.paymentStatus !== 'PAID' ? (
                                  <span
                                    className="size-1.5 shrink-0 rounded-full bg-warning"
                                    title="Pagamento em aberto"
                                  />
                                ) : null}
                              </button>
                            );
                          }

                          return canManage ? (
                            <button
                              key={shift.id}
                              type="button"
                              onClick={() => onReserve(dia, resource.id, resource.name, shift.id)}
                              title={`${shift.name} livre`}
                              className="flex w-full items-center gap-1 rounded-md border border-dashed px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                            >
                              <Plus className="size-3" />
                              {inicial}
                            </button>
                          ) : (
                            <div
                              key={shift.id}
                              className="rounded-md border border-dashed border-border/60 px-1.5 py-1 text-[11px] text-muted-foreground"
                            >
                              {inicial}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* --------------------------------------------------------------------- mês */

/**
 * O mês em calendário: cada dia mostra o quanto do espaço foi vendido e quem
 * esteve lá. Clicar em um dia leva para a visão do dia — é sempre assim que a
 * pergunta termina ("e no dia 12, quem estava?").
 */
function MonthGrid({
  data,
  date,
  onPickDay,
}: {
  data: Occupancy;
  date: Date;
  onPickDay: (dia: Date) => void;
}) {
  // A grade do calendário: o mês inteiro mais os dias vizinhos que completam a
  // primeira e a última semana.
  const dias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(date), { weekStartsOn: 0 });
    const fim = endOfWeek(endOfMonth(date), { weekStartsOn: 0 });

    const lista: Date[] = [];
    for (let cursor = inicio; cursor <= fim; cursor = addDays(cursor, 1)) lista.push(cursor);
    return lista;
  }, [date]);

  const porDia = useMemo(() => {
    const m = new Map<string, RentalBooking[]>();
    for (const b of data.bookings) {
      const chave = iso(new Date(b.date));
      m.set(chave, [...(m.get(chave) ?? []), b]);
    }
    return m;
  }, [data.bookings]);

  const capacidade = data.resources.length * Math.max(data.shifts.length, 1);

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((nome) => (
          <div
            key={nome}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {nome}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const doMes = isSameMonth(dia, date);
          const reservas = porDia.get(iso(dia)) ?? [];
          const nomes = [...new Set(reservas.map((b) => b.professional.name))];

          return (
            <button
              key={dia.toISOString()}
              type="button"
              onClick={() => onPickDay(dia)}
              className={cn(
                'min-h-[92px] border-b border-r p-1.5 text-left transition-colors hover:bg-muted/60',
                !doMes && 'bg-muted/30 text-muted-foreground',
              )}
            >
              <span className="flex items-center justify-between">
                <span
                  className={cn(
                    'text-xs font-medium',
                    isToday(dia) &&
                      'flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground',
                  )}
                >
                  {format(dia, 'd')}
                </span>
                {reservas.length && capacidade ? (
                  <span className="text-[10px] text-muted-foreground">
                    {reservas.length}/{capacidade}
                  </span>
                ) : null}
              </span>

              <span className="mt-1 flex flex-col gap-0.5">
                {reservas.slice(0, 3).map((booking) => (
                  <span
                    key={booking.id}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]"
                    style={{ backgroundColor: `${booking.professional.color}1f` }}
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: booking.professional.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {booking.professional.name.split(' ')[0]}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {booking.shift ? booking.shift.name.slice(0, 1) : 'D'}
                    </span>
                  </span>
                ))}
                {reservas.length > 3 ? (
                  <span className="px-1 text-[10px] text-muted-foreground">
                    +{reservas.length - 3} · {nomes.length} profissionais
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------- quem alugou */

/** A resposta direta: quem esteve no espaço no período, e quanto isso deu. */
function RenterSummary({ data }: { data: Occupancy }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quem alugou no período</CardTitle>
      </CardHeader>
      <CardContent>
        {!data.porProfissional.length ? (
          <EmptyState
            icon={KeyRound}
            title="Nenhum turno alugado neste período"
            description="Reserve um turno pela grade ao lado ou crie um contrato recorrente."
          />
        ) : (
          <div className="space-y-2">
            {data.porProfissional.map((linha) => (
              <div
                key={linha.professional.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
              >
                <UserAvatar
                  name={linha.professional.name}
                  color={linha.professional.color}
                  className="size-9"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{linha.professional.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {linha.turnos} {linha.turnos === 1 ? 'turno' : 'turnos'} ·{' '}
                    {linha.espacos.join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{currency(linha.total)}</p>
                  {linha.aberto > 0.001 ? (
                    <Badge variant="warning">{currency(linha.aberto)} em aberto</Badge>
                  ) : (
                    <PaymentStatusBadge status="PAID" />
                  )}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">
                {data.totais.profissionais}{' '}
                {data.totais.profissionais === 1 ? 'profissional' : 'profissionais'} ·{' '}
                {data.totais.turnos} {data.totais.turnos === 1 ? 'turno' : 'turnos'}
              </span>
              <span className="flex items-center gap-3">
                {data.totais.aberto > 0.001 ? (
                  <span className="text-xs text-muted-foreground">
                    a receber {currency(data.totais.aberto)}
                  </span>
                ) : null}
                <span className="font-semibold tabular-nums">{currency(data.totais.total)}</span>
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { CalendarDays, KeyRound, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageHeader, Pagination, StatCard, TBody, TD, TH, THead, TR, Table } from '@/components/ui/data';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/primitives';
import { PaymentStatusBadge } from '@/components/StatusBadge';
import { useBookings } from '@/api/queries';
import { currency, shortDate } from '@/lib/format';

/**
 * Painel da locatária: os turnos que ela alugou, o que já pagou e o que
 * está em aberto. O backend já limita a resposta aos turnos dela.
 */
export function MyShiftsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'upcoming' | 'all' | 'pending'>('upcoming');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, isLoading } = useBookings({
    page,
    perPage: 20,
    ...(filter === 'upcoming' ? { from: today.toISOString() } : {}),
    ...(filter === 'pending' ? { paymentStatus: 'PENDING' } : {}),
  });

  const pending = data?.totals.find((t) => t.status === 'PENDING');
  const paid = data?.totals.find((t) => t.status === 'PAID');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Meus turnos"
        description="Os horários que você alugou no espaço e as faturas de cada um"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Turnos no período" value={data?.meta.total ?? 0} icon={KeyRound} />
        <StatCard
          label="Em aberto"
          value={currency((pending?.amount ?? 0) - (pending?.paidAmount ?? 0))}
          icon={Wallet}
          tone="warning"
        />
        <StatCard label="Já pago" value={currency(paid?.paidAmount ?? 0)} tone="success" />
      </div>

      <Tabs value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="upcoming">Próximos</TabsTrigger>
          <TabsTrigger value="pending">Em aberto</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="h-40" />
          </div>
        ) : data?.data.length ? (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Data</TH>
                  <TH>Espaço</TH>
                  <TH>Turno</TH>
                  <TH>Valor</TH>
                  <TH>Pagamento</TH>
                </TR>
              </THead>
              <TBody>
                {data.data.map((booking) => (
                  <TR key={booking.id}>
                    <TD className="text-sm font-medium">{shortDate(booking.date)}</TD>
                    <TD>
                      <p className="text-sm">{booking.resource.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.resource.category?.name}
                      </p>
                    </TD>
                    <TD className="text-sm text-muted-foreground">
                      {booking.shift
                        ? `${booking.shift.name} · ${booking.shift.startsAt}–${booking.shift.endsAt}`
                        : 'Diária'}
                    </TD>
                    <TD className="text-sm font-medium">{currency(booking.price)}</TD>
                    <TD>
                      <PaymentStatusBadge status={booking.paymentStatus} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="px-4">
              <Pagination
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                total={data.meta.total}
                onChange={setPage}
              />
            </div>
          </>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="Nenhum turno por aqui"
            description="Quando você alugar um turno no espaço, ele aparece nesta lista."
          />
        )}
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, Pagination, StatCard, TBody, TD, TH, THead, TR, Table } from '@/components/ui/data';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { UserAvatar } from '@/components/ui/primitives';
import { CommissionStatusBadge } from '@/components/StatusBadge';
import { useCommissionMutations, useCommissionSummary, useCommissions } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { currency, monthKey, monthLabel, shortDate } from '@/lib/format';

export function CommissionsPage() {
  const canManage = useAuthStore((s) => s.can('commissions:manage'));

  const [reference, setReference] = useState(() => new Date());
  const [page, setPage] = useState(1);

  const month = monthKey(reference);
  const { data: summary, isLoading } = useCommissionSummary(month);
  const { data: commissions } = useCommissions({ page, perPage: 20, referenceMonth: month });
  const { payMonth } = useCommissionMutations();

  function shiftMonth(delta: number) {
    setReference((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setPage(1);
  }

  const totals = (summary?.professionals ?? []).reduce(
    (acc, item) => ({
      pending: acc.pending + item.pending,
      paid: acc.paid + item.paid,
      total: acc.total + item.total,
    }),
    { pending: 0, paid: 0, total: 0 },
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Comissões"
        description="Cálculo automático a partir dos atendimentos finalizados"
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => shiftMonth(-1)}>
              <ChevronLeft />
            </Button>
            <span className="min-w-[150px] text-center text-sm font-medium capitalize">
              {monthLabel(month)}
            </span>
            <Button variant="outline" size="icon-sm" onClick={() => shiftMonth(1)}>
              <ChevronRight />
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total do mês" value={currency(totals.total)} icon={Percent} />
        <StatCard label="A pagar" value={currency(totals.pending)} tone="warning" />
        <StatCard label="Já pago" value={currency(totals.paid)} tone="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fechamento por profissional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : summary?.professionals.length ? (
            summary.professionals.map((professional) => (
              <div
                key={professional.professionalId}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 p-3"
              >
                <UserAvatar name={professional.name} src={professional.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{professional.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {professional.count} comissão(ões) no mês
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{currency(professional.total)}</p>
                  <p className="text-xs text-muted-foreground">
                    A pagar: {currency(professional.pending)}
                  </p>
                </div>
                {canManage && professional.pending > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={payMonth.isPending}
                    onClick={() =>
                      payMonth.mutate({
                        professionalId: professional.professionalId,
                        referenceMonth: month,
                      })
                    }
                  >
                    <CheckCircle2 />
                    Pagar mês
                  </Button>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState
              icon={Percent}
              title="Nenhuma comissão neste mês"
              description="As comissões são geradas automaticamente quando um atendimento é finalizado."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos</CardTitle>
        </CardHeader>
        {commissions?.data.length ? (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Profissional</TH>
                  <TH>Serviço</TH>
                  <TH>Atendimento</TH>
                  <TH>Base</TH>
                  <TH>Regra</TH>
                  <TH>Comissão</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {commissions.data.map((commission) => (
                  <TR key={commission.id}>
                    <TD className="text-sm">{commission.professional?.name}</TD>
                    <TD className="text-sm text-muted-foreground">{commission.service?.name ?? '—'}</TD>
                    <TD className="text-sm text-muted-foreground">
                      {commission.appointment
                        ? `${commission.appointment.customer.name} · ${shortDate(commission.appointment.startsAt)}`
                        : '—'}
                    </TD>
                    <TD className="text-sm">{currency(commission.baseAmount)}</TD>
                    <TD className="text-sm text-muted-foreground">
                      {commission.type === 'PERCENTAGE'
                        ? `${commission.value}%`
                        : currency(commission.value)}
                    </TD>
                    <TD className="text-sm font-semibold">{currency(commission.amount)}</TD>
                    <TD>
                      <CommissionStatusBadge status={commission.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="px-4">
              <Pagination
                page={commissions.meta.page}
                totalPages={commissions.meta.totalPages}
                total={commissions.meta.total}
                onChange={setPage}
              />
            </div>
          </>
        ) : (
          <CardContent>
            <EmptyState icon={Percent} title="Sem lançamentos no período" />
          </CardContent>
        )}
      </Card>
    </div>
  );
}

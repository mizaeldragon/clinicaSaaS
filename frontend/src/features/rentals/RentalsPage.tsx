import { useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  KeyRound,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/field';
import { PageHeader, Pagination, StatCard, TBody, TD, TH, THead, TR, Table } from '@/components/ui/data';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Label, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchSelect } from '@/components/ui/search-select';
import { PaymentStatusBadge, RentalStatusBadge } from '@/components/StatusBadge';
import {
  useProfessionals,
  useRentalMutations,
  useRentalPayments,
  useRentalStats,
  useRentals,
  useResources,
} from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { BILLING_CYCLE, PAYMENT_METHOD } from '@/config/labels';
import { currency, monthLabel, shortDate } from '@/lib/format';
import type { PaymentMethod, RentalPayment } from '@/types';
import { ShiftBoard } from './ShiftBoard';
import { ShiftSettings } from './ShiftSettings';

const EMPTY = {
  resourceId: '',
  professionalId: '',
  renterName: '',
  renterPhone: '',
  startsAt: new Date().toISOString().slice(0, 10),
  endsAt: '',
  amount: '',
  billingCycle: 'MONTHLY',
  dueDay: '10',
  notes: '',
};

export function RentalsPage() {
  const canManage = useAuthStore((s) => s.can('rentals:manage'));

  const [page, setPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const { data: rentals, isLoading } = useRentals({ page, perPage: 20 });
  const { data: payments } = useRentalPayments({ page: paymentsPage, perPage: 20 });
  const { data: stats } = useRentalStats();
  const { data: resources } = useResources({ isRentable: 'true' });
  const { data: professionals } = useProfessionals({ isActive: 'true' });
  const mutations = useRentalMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [payTarget, setPayTarget] = useState<RentalPayment | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', paymentMethod: 'PIX' as PaymentMethod });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await mutations.create
      .mutateAsync({
        resourceId: form.resourceId,
        professionalId: form.professionalId || null,
        renterName: form.renterName,
        renterPhone: form.renterPhone || null,
        startsAt: new Date(`${form.startsAt}T12:00:00`).toISOString(),
        endsAt: form.endsAt ? new Date(`${form.endsAt}T12:00:00`).toISOString() : null,
        amount: Number(form.amount),
        billingCycle: form.billingCycle,
        dueDay: form.billingCycle === 'MONTHLY' ? Number(form.dueDay) : null,
        notes: form.notes || null,
        generateFirstCharge: true,
      })
      .then(() => {
        setDialogOpen(false);
        setForm(EMPTY);
      })
      .catch(() => undefined);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Aluguel de Espaços"
        description="Contratos de mesas, cadeiras e salas com cobrança recorrente automática"
        actions={
          canManage ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus />
              Novo contrato
            </Button>
          ) : null
        }
      />

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Contratos ativos" value={stats.activeRentals} icon={KeyRound} />
          <StatCard
            label="Receita recorrente"
            value={currency(stats.monthlyRecurringRevenue)}
            hint="Contratos mensais"
            icon={Banknote}
            tone="success"
          />
          <StatCard
            label="A receber"
            value={currency(stats.pendingAmount)}
            hint={`${stats.pendingCount} cobrança(s) em aberto`}
            icon={Wallet}
            tone="warning"
          />
          <StatCard
            label="Contratos atrasados"
            value={stats.overdueRentals}
            icon={AlertTriangle}
            tone={stats.overdueRentals > 0 ? 'danger' : 'default'}
          />
        </div>
      ) : null}

      <Tabs defaultValue="shifts">
        <TabsList className="flex-wrap">
          <TabsTrigger value="shifts">Turnos do dia</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="payments">Cobranças</TabsTrigger>
          <TabsTrigger value="settings">Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts">
          <ShiftBoard />
        </TabsContent>

        <TabsContent value="contracts">
          <Card>
            {isLoading ? (
              <div className="p-4">
                <Skeleton className="h-40" />
              </div>
            ) : rentals?.data.length ? (
              <>
                <Table>
                  <THead>
                    <TR>
                      <TH>Recurso</TH>
                      <TH>Responsável</TH>
                      <TH>Cobrança</TH>
                      <TH>Vencimento</TH>
                      <TH>Status</TH>
                      <TH className="w-12" />
                    </TR>
                  </THead>
                  <TBody>
                    {rentals.data.map((rental) => (
                      <TR key={rental.id}>
                        <TD>
                          <p className="font-medium">{rental.resource?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {rental.resource?.category?.name}
                          </p>
                        </TD>
                        <TD>
                          <p className="text-sm">{rental.renterName}</p>
                          <p className="text-xs text-muted-foreground">{rental.renterPhone ?? '—'}</p>
                        </TD>
                        <TD className="text-sm">
                          {currency(rental.amount)}
                          <span className="text-muted-foreground">
                            {' '}
                            · {BILLING_CYCLE[rental.billingCycle]}
                          </span>
                        </TD>
                        <TD className="text-sm text-muted-foreground">
                          {rental.dueDay ? `Todo dia ${rental.dueDay}` : '—'}
                        </TD>
                        <TD>
                          <RentalStatusBadge status={rental.status} />
                        </TD>
                        <TD>
                          {canManage ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm">
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => mutations.generateCharges.mutate(rental.id)}
                                >
                                  <RefreshCw />
                                  Gerar cobranças
                                </DropdownMenuItem>
                                {rental.status === 'ACTIVE' ? (
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      mutations.update.mutate({ id: rental.id, status: 'ENDED' })
                                    }
                                  >
                                    Encerrar contrato
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem
                                  destructive
                                  onSelect={() => mutations.remove.mutate(rental.id)}
                                >
                                  <Trash2 />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                <div className="px-4">
                  <Pagination
                    page={rentals.meta.page}
                    totalPages={rentals.meta.totalPages}
                    total={rentals.meta.total}
                    onChange={setPage}
                  />
                </div>
              </>
            ) : (
              <EmptyState
                icon={KeyRound}
                title="Nenhum contrato de aluguel"
                description="Crie contratos para mesas, cadeiras ou salas e o sistema gera as cobranças recorrentes automaticamente."
                action={canManage ? { label: 'Novo contrato', onClick: () => setDialogOpen(true) } : undefined}
              />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            {payments?.data.length ? (
              <>
                <Table>
                  <THead>
                    <TR>
                      <TH>Referência</TH>
                      <TH>Contrato</TH>
                      <TH>Vencimento</TH>
                      <TH>Valor</TH>
                      <TH>Status</TH>
                      <TH className="w-24" />
                    </TR>
                  </THead>
                  <TBody>
                    {payments.data.map((payment) => (
                      <TR key={payment.id}>
                        <TD className="text-sm capitalize">
                          {payment.referenceMonth.length === 7
                            ? monthLabel(payment.referenceMonth)
                            : payment.referenceMonth}
                        </TD>
                        <TD>
                          <p className="text-sm">{payment.rental?.renterName}</p>
                          <p className="text-xs text-muted-foreground">
                            {payment.rental?.resource.name}
                          </p>
                        </TD>
                        <TD className="text-sm text-muted-foreground">{shortDate(payment.dueDate)}</TD>
                        <TD className="text-sm font-medium">
                          {currency(payment.amount)}
                          {payment.paidAmount > 0 && payment.status !== 'PAID' ? (
                            <span className="text-xs text-muted-foreground">
                              {' '}
                              (pago {currency(payment.paidAmount)})
                            </span>
                          ) : null}
                        </TD>
                        <TD>
                          <PaymentStatusBadge status={payment.status} />
                        </TD>
                        <TD>
                          {canManage && payment.status !== 'PAID' && payment.status !== 'CANCELED' ? (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => {
                                setPayTarget(payment);
                                setPayForm({
                                  amount: String(payment.amount - payment.paidAmount),
                                  paymentMethod: 'PIX',
                                });
                              }}
                            >
                              Registrar pagamento
                            </Button>
                          ) : null}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                <div className="px-4">
                  <Pagination
                    page={payments.meta.page}
                    totalPages={payments.meta.totalPages}
                    total={payments.meta.total}
                    onChange={setPaymentsPage}
                  />
                </div>
              </>
            ) : (
              <EmptyState icon={Wallet} title="Nenhuma cobrança gerada" />
            )}
          </Card>
        </TabsContent>
        <TabsContent value="settings">
          <ShiftSettings />
        </TabsContent>
      </Tabs>

      {/* -------------------------------------------------- Novo contrato */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Novo contrato de aluguel</DialogTitle>
            <DialogDescription>
              As cobranças futuras são geradas automaticamente conforme o ciclo escolhido.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Recurso *</Label>
              <SearchSelect
                options={(resources?.data ?? []).map((resource) => ({
                  value: resource.id,
                  label: resource.name,
                  description: resource.category?.name,
                }))}
                value={form.resourceId}
                onChange={(v) => setForm((f) => ({ ...f, resourceId: v }))}
                placeholder="Selecione o recurso locável"
                emptyText="Marque um recurso como locável primeiro"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="renterName">Responsável *</Label>
                <Input
                  id="renterName"
                  required
                  value={form.renterName}
                  onChange={(e) => setForm((f) => ({ ...f, renterName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="renterPhone">Telefone</Label>
                <PhoneInput
                  id="renterPhone"
                  value={form.renterPhone}
                  onChange={(v) => setForm((f) => ({ ...f, renterPhone: v }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Vincular a um profissional (opcional)</Label>
              <SearchSelect
                allowClear
                options={(professionals?.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                value={form.professionalId}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    professionalId: v,
                    renterName:
                      f.renterName ||
                      (professionals?.data.find((p) => p.id === v)?.name ?? f.renterName),
                  }))
                }
                placeholder="Sem vínculo"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="startsAt">Início *</Label>
                <Input
                  id="startsAt"
                  type="date"
                  required
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endsAt">Fim (opcional)</Label>
                <Input
                  id="endsAt"
                  type="date"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Valor (R$) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min={0.01}
                  required
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Forma de cobrança</Label>
                <Select
                  value={form.billingCycle}
                  onValueChange={(v) => setForm((f) => ({ ...f, billingCycle: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BILLING_CYCLE).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dueDay">Dia de vencimento</Label>
                <Input
                  id="dueDay"
                  type="number"
                  min={1}
                  max={31}
                  disabled={form.billingCycle !== 'MONTHLY'}
                  value={form.dueDay}
                  onChange={(e) => setForm((f) => ({ ...f, dueDay: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={mutations.create.isPending} disabled={!form.resourceId}>
                Criar contrato
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------- Registrar pagamento */}
      <Dialog open={Boolean(payTarget)} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              {payTarget?.rental?.renterName} · {payTarget?.rental?.resource.name}
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!payTarget) return;
              await mutations.pay
                .mutateAsync({
                  id: payTarget.id,
                  amount: Number(payForm.amount),
                  paymentMethod: payForm.paymentMethod,
                })
                .then(() => setPayTarget(null))
                .catch(() => undefined);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="payAmount">Valor recebido</Label>
              <Input
                id="payAmount"
                type="number"
                step="0.01"
                min={0.01}
                required
                value={payForm.amount}
                onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select
                value={payForm.paymentMethod}
                onValueChange={(v) => setPayForm((f) => ({ ...f, paymentMethod: v as PaymentMethod }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={mutations.pay.isPending}>
                Confirmar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

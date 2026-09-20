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
import { PasswordInput, PhoneInput } from '@/components/ui/field';
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
  useShifts,
} from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { BILLING_CYCLE, PAYMENT_METHOD } from '@/config/labels';
import { currency, dateInput, monthLabel, shortDate } from '@/lib/format';
import type { PaymentMethod, RentalPayment } from '@/types';
import { OccupancyBoard } from './OccupancyBoard';
import { ShiftSettings } from './ShiftSettings';

const DIAS = [
  { valor: 0, curto: 'D' },
  { valor: 1, curto: 'S' },
  { valor: 2, curto: 'T' },
  { valor: 3, curto: 'Q' },
  { valor: 4, curto: 'Q' },
  { valor: 5, curto: 'S' },
  { valor: 6, curto: 'S' },
];

const EMPTY = {
  resourceId: '',
  professionalId: '',
  shiftId: '',
  weekdays: [] as number[],
  renterName: '',
  renterPhone: '',
  startsAt: dateInput(),
  endsAt: '',
  amount: '',
  billingCycle: 'MONTHLY',
  dueDay: '10',
  notes: '',
};

/** Locatária nova: o cadastro e o acesso dela, digitados no próprio contrato. */
const NOVA = { name: '', phone: '', email: '', password: '' };

export function RentalsPage() {
  const canManage = useAuthStore((s) => s.can('rentals:manage'));
  const canManageUsers = useAuthStore((s) => s.can('users:manage'));

  const [page, setPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const { data: rentals, isLoading } = useRentals({ page, perPage: 20 });
  const { data: payments } = useRentalPayments({ page: paymentsPage, perPage: 20 });
  const { data: stats } = useRentalStats();
  const { data: resources } = useResources({ isRentable: 'true' });
  const { data: professionals } = useProfessionals({ isActive: 'true' });
  const { data: shifts } = useShifts();
  const mutations = useRentalMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  /*
   * Quem vai ocupar o espaço: alguém que já aluga, ou uma pessoa nova.
   *
   * Antes o contrato só perguntava um nome solto e, opcionalmente, "vincular a
   * um profissional". Quem aluga precisa de login — é por ele que ela vê a
   * própria agenda —, e criar esse login era outra tela, em Configurações, que
   * ninguém adivinhava ser necessária. Agora os dois nascem aqui.
   */
  const [modo, setModo] = useState<'existente' | 'nova'>('nova');
  const [nova, setNova] = useState(NOVA);

  // Só locatárias: a equipe da casa não aluga o espaço em que trabalha.
  const locatarias = (professionals?.data ?? []).filter(
    (p) => p.revenueOwner === 'PROFESSIONAL' && p.isActive,
  );
  const [payTarget, setPayTarget] = useState<RentalPayment | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', paymentMethod: 'PIX' as PaymentMethod });

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    /*
     * A locatária vem antes do contrato, e não depois: se o cadastro falhar
     * (e-mail repetido, limite do plano), nada é criado e a pessoa corrige com
     * o formulário ainda preenchido. Na ordem inversa, sobraria um contrato
     * órfão de alguém que não existe.
     */
    let professionalId = form.professionalId;
    let renterName = form.renterName;
    let renterPhone = form.renterPhone;

    if (modo === 'nova') {
      const criada = await mutations.createRenter
        .mutateAsync({
          name: nova.name,
          phone: nova.phone || undefined,
          email: nova.email,
          password: nova.password,
        })
        .catch(() => null);

      if (!criada) return;

      professionalId = criada.professional.id;
      renterName = criada.professional.name;
      renterPhone = nova.phone;
    }

    await mutations.create
      .mutateAsync({
        resourceId: form.resourceId,
        professionalId: professionalId || null,
        renterName,
        renterPhone: renterPhone || null,
        shiftId: form.shiftId || null,
        weekdays: form.shiftId ? form.weekdays : [],
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
        setNova(NOVA);
        setModo('nova');
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
          <TabsTrigger value="shifts">Ocupação</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="payments">Cobranças</TabsTrigger>
          <TabsTrigger value="settings">Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts">
          <OccupancyBoard />
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

            {/* ------------------------------------------------ locatária */}
            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-sm font-semibold">Quem vai alugar</Label>
                <div className="flex rounded-lg border p-0.5">
                  {(
                    [
                      { valor: 'nova' as const, texto: 'Cadastrar agora' },
                      { valor: 'existente' as const, texto: 'Já cadastrada' },
                    ]
                  ).map((opcao) => (
                    <button
                      key={opcao.valor}
                      type="button"
                      onClick={() => setModo(opcao.valor)}
                      className={
                        modo === opcao.valor
                          ? 'rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                          : 'rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground'
                      }
                    >
                      {opcao.texto}
                    </button>
                  ))}
                </div>
              </div>

              {modo === 'existente' ? (
                <SearchSelect
                  options={locatarias.map((p) => ({ value: p.id, label: p.name }))}
                  value={form.professionalId}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      professionalId: v,
                      renterName: locatarias.find((p) => p.id === v)?.name ?? f.renterName,
                      renterPhone: locatarias.find((p) => p.id === v)?.phone ?? f.renterPhone,
                    }))
                  }
                  placeholder="Selecione a locatária"
                  emptyText="Nenhuma locatária cadastrada ainda"
                />
              ) : !canManageUsers ? (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                  Criar acesso é coisa de administrador. Peça para quem administra a conta
                  cadastrar a locatária, ou escolha uma já cadastrada.
                </p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="novaNome">Nome *</Label>
                      <Input
                        id="novaNome"
                        required
                        minLength={2}
                        value={nova.name}
                        onChange={(e) => setNova((n) => ({ ...n, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="novaTelefone">Telefone</Label>
                      <PhoneInput
                        id="novaTelefone"
                        value={nova.phone}
                        onChange={(v) => setNova((n) => ({ ...n, phone: v }))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="novaEmail">E-mail de acesso *</Label>
                      <Input
                        id="novaEmail"
                        type="email"
                        required
                        value={nova.email}
                        onChange={(e) => setNova((n) => ({ ...n, email: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="novaSenha">Senha provisória *</Label>
                      <PasswordInput
                        id="novaSenha"
                        required
                        minLength={8}
                        placeholder="Mínimo de 8 caracteres"
                        value={nova.password}
                        onChange={(e) => setNova((n) => ({ ...n, password: e.target.value }))}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Com esse acesso ela entra no sistema e vê a agenda e as clientes dela — que
                    ficam fora da sua. O link de agendamento dela sai pronto em Profissionais, e ela
                    troca a senha no primeiro acesso.
                  </p>
                </>
              )}
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

            {/* ------------------------------------------- turnos do contrato */}
            {/*
              É isto que abre a agenda dela.

              A disponibilidade de uma locatária vem dos turnos que ela alugou —
              não de jornada de trabalho. Sem turno e sem dias, o contrato só
              gera cobrança, e o link público dela responde "nenhum horário
              livre" para sempre, sem dizer por quê.
            */}
            <div className="space-y-3 rounded-xl border p-4">
              <div>
                <Label className="text-sm font-semibold">Quando ela usa o espaço</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  É o turno reservado que abre a agenda dela no link de agendamento.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Turno</Label>
                  <Select
                    value={form.shiftId || 'nenhum'}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, shiftId: v === 'nenhum' ? '' : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o turno" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Sem turno fixo (só cobrança)</SelectItem>
                      {(shifts ?? []).map((shift) => (
                        <SelectItem key={shift.id} value={shift.id}>
                          {shift.name} · {shift.startsAt}–{shift.endsAt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Dias da semana</Label>
                  <div className="flex gap-1">
                    {DIAS.map((dia, i) => {
                      const marcado = form.weekdays.includes(dia.valor);
                      return (
                        <button
                          key={dia.valor}
                          type="button"
                          disabled={!form.shiftId}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              weekdays: marcado
                                ? f.weekdays.filter((d) => d !== dia.valor)
                                : [...f.weekdays, dia.valor],
                            }))
                          }
                          className={
                            marcado
                              ? 'size-9 rounded-lg bg-primary text-sm font-medium text-primary-foreground'
                              : 'size-9 rounded-lg border text-sm text-muted-foreground transition-colors enabled:hover:border-primary enabled:hover:text-primary disabled:opacity-40'
                          }
                          aria-label={`Dia ${i}`}
                        >
                          {dia.curto}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {form.shiftId && form.weekdays.length ? (
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Os turnos dos próximos 30 dias são reservados automaticamente, e o link de
                  agendamento dela passa a abrir nesses horários.
                </p>
              ) : (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  Sem turno e dias, o contrato só gera cobrança: a agenda dela{' '}
                  <strong>não abre</strong> no link. Dá para reservar turnos avulsos depois, pela
                  grade da aba Ocupação.
                </p>
              )}
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

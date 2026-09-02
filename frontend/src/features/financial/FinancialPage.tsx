import { useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { PageHeader, Pagination, StatCard, TBody, TD, TH, THead, TR, Table } from '@/components/ui/data';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Label, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
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
import { PaymentStatusBadge } from '@/components/StatusBadge';
import {
  useExpenseCategories,
  useFinancialDashboard,
  useFinancialMutations,
  useTransactions,
} from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { PAYMENT_METHOD, TRANSACTION_ORIGIN } from '@/config/labels';
import { compactCurrency, currency, percent, shortDate } from '@/lib/format';
import type { PaymentMethod, TransactionType } from '@/types';

const CHART_COLORS = ['#7C3AED', '#EC4899', '#0EA5E9', '#14B8A6', '#F59E0B', '#EF4444', '#64748B'];

const EMPTY = {
  type: 'EXPENSE' as TransactionType,
  description: '',
  amount: '',
  categoryId: '',
  paymentMethod: 'PIX' as PaymentMethod,
  paymentStatus: 'PAID',
  competenceDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  notes: '',
};

export function FinancialPage() {
  const canManage = useAuthStore((s) => s.can('financial:manage'));

  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data: dashboard, isLoading } = useFinancialDashboard({});
  const { data: transactions } = useTransactions({
    page,
    perPage: 20,
    ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
  });
  const { data: categories } = useExpenseCategories();
  const mutations = useFinancialMutations();

  const dailyChart = (() => {
    const map = new Map<string, { day: string; income: number; expense: number }>();
    for (const point of dashboard?.dailySeries ?? []) {
      const key = shortDate(point.day).slice(0, 5);
      const entry = map.get(key) ?? { day: key, income: 0, expense: 0 };
      if (point.type === 'INCOME') entry.income += point.total;
      else entry.expense += point.total;
      map.set(key, entry);
    }
    return [...map.values()];
  })();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await mutations.create
      .mutateAsync({
        type: form.type,
        description: form.description,
        amount: Number(form.amount),
        categoryId: form.type === 'EXPENSE' && form.categoryId ? form.categoryId : null,
        paymentMethod: form.paymentMethod,
        paymentStatus: form.paymentStatus,
        paidAmount: form.paymentStatus === 'PAID' ? Number(form.amount) : 0,
        competenceDate: new Date(`${form.competenceDate}T12:00:00`).toISOString(),
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : null,
        notes: form.notes || null,
      })
      .then(() => {
        setDialogOpen(false);
        setForm(EMPTY);
      })
      .catch(() => undefined);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Financeiro"
        description="Receitas, despesas, formas de pagamento e resultado do mês"
        actions={
          canManage ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus />
              Novo lançamento
            </Button>
          ) : null
        }
      />

      {dashboard ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Receita do mês"
              value={currency(dashboard.month.income)}
              hint={`Recebido: ${currency(dashboard.month.incomeReceived)}`}
              icon={ArrowUpCircle}
              tone="success"
            />
            <StatCard
              label="Despesas do mês"
              value={currency(dashboard.month.expense)}
              hint={`Pago: ${currency(dashboard.month.expensePaid)}`}
              icon={ArrowDownCircle}
              tone="danger"
            />
            <StatCard
              label="Lucro estimado"
              value={currency(dashboard.month.profit)}
              hint={`Margem de ${percent(dashboard.month.margin)}`}
              icon={TrendingUp}
              tone={dashboard.month.profit >= 0 ? 'success' : 'danger'}
            />
            <StatCard
              label="Receita de hoje"
              value={currency(dashboard.today.income)}
              hint={`A receber: ${currency(dashboard.pending.toReceive)}`}
              icon={Wallet}
              tone="info"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Receitas x Despesas no mês</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyChart} margin={{ left: -18, right: 8 }}>
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={64}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(v) => compactCurrency(Number(v))}
                      />
                      <ReTooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid hsl(var(--border))',
                          background: 'hsl(var(--card))',
                          fontSize: 12,
                        }}
                        formatter={(value: number, name) => [
                          currency(value),
                          name === 'income' ? 'Receita' : 'Despesa',
                        ]}
                      />
                      <Bar isAnimationActive={false} dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar isAnimationActive={false} dataKey="expense" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recebimentos por forma</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.byPaymentMethod.length === 0 ? (
                  <EmptyState icon={Receipt} title="Sem recebimentos no período" className="py-10" />
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie isAnimationActive={false}
                          data={dashboard.byPaymentMethod.map((item) => ({
                            name: PAYMENT_METHOD[item.method as PaymentMethod] ?? 'Não informado',
                            value: item.total,
                          }))}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={54}
                          outerRadius={84}
                          paddingAngle={3}
                        >
                          {dashboard.byPaymentMethod.map((_, index) => (
                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <ReTooltip formatter={(value: number) => currency(value)} />
                        <Legend
                          verticalAlign="bottom"
                          height={48}
                          formatter={(value) => <span className="text-xs">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <Tabs value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="INCOME">Receitas</TabsTrigger>
          <TabsTrigger value="EXPENSE">Despesas</TabsTrigger>
        </TabsList>

        <TabsContent value={typeFilter}>
          <Card>
            {transactions?.data.length ? (
              <>
                <Table>
                  <THead>
                    <TR>
                      <TH>Descrição</TH>
                      <TH>Origem</TH>
                      <TH>Data</TH>
                      <TH>Valor</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {transactions.data.map((transaction) => (
                      <TR key={transaction.id}>
                        <TD>
                          <p className="text-sm font-medium">{transaction.description}</p>
                          {transaction.category ? (
                            <p className="text-xs text-muted-foreground">{transaction.category.name}</p>
                          ) : null}
                        </TD>
                        <TD className="text-xs text-muted-foreground">
                          {TRANSACTION_ORIGIN[transaction.origin] ?? transaction.origin}
                        </TD>
                        <TD className="text-sm text-muted-foreground">
                          {shortDate(transaction.competenceDate)}
                        </TD>
                        <TD
                          className={
                            transaction.type === 'INCOME'
                              ? 'font-semibold text-emerald-600'
                              : 'font-semibold text-rose-600'
                          }
                        >
                          {transaction.type === 'INCOME' ? '+' : '−'} {currency(transaction.amount)}
                        </TD>
                        <TD>
                          <PaymentStatusBadge status={transaction.paymentStatus} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                <div className="px-4">
                  <Pagination
                    page={transactions.meta.page}
                    totalPages={transactions.meta.totalPages}
                    total={transactions.meta.total}
                    onChange={setPage}
                  />
                </div>
              </>
            ) : (
              <EmptyState
                icon={Banknote}
                title="Nenhum lançamento"
                description="Atendimentos finalizados geram receitas automaticamente. Você também pode lançar despesas manualmente."
                action={canManage ? { label: 'Novo lançamento', onClick: () => setDialogOpen(true) } : undefined}
              />
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo lançamento</DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="flex gap-2">
              {(['INCOME', 'EXPENSE'] as TransactionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type }))}
                  className={`flex-1 rounded-lg border p-3 text-sm font-medium transition-all ${
                    form.type === type
                      ? type === 'INCOME'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700'
                        : 'border-rose-500 bg-rose-500/10 text-rose-700'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {type === 'INCOME' ? 'Receita' : 'Despesa'}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição *</Label>
              <Input
                id="description"
                required
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label htmlFor="competenceDate">Data *</Label>
                <Input
                  id="competenceDate"
                  type="date"
                  required
                  value={form.competenceDate}
                  onChange={(e) => setForm((f) => ({ ...f, competenceDate: e.target.value }))}
                />
              </div>
            </div>

            {form.type === 'EXPENSE' ? (
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={form.categoryId || 'none'}
                  onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Forma de pagamento</Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v as PaymentMethod }))}
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
              <div className="space-y-1.5">
                <Label>Situação</Label>
                <Select
                  value={form.paymentStatus}
                  onValueChange={(v) => setForm((f) => ({ ...f, paymentStatus: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAID">Pago</SelectItem>
                    <SelectItem value="PARTIAL">Parcial</SelectItem>
                    <SelectItem value="PENDING">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.paymentStatus !== 'PAID' ? (
              <div className="space-y-1.5">
                <Label htmlFor="dueDate">Vencimento</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            ) : null}

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
              <Button type="submit" loading={mutations.create.isPending}>
                Lançar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

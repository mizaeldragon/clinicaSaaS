import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarCheck,
  CalendarDays,
  DoorOpen,
  KeyRound,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import { useDashboard } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/data';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, SkeletonCards, Skeleton } from '@/components/ui/feedback';
import { UserAvatar } from '@/components/ui/primitives';
import { PublicLinkCard } from '@/components/PublicLinkCard';
import { compactCurrency, currency, number, shortDate, timeLabel } from '@/lib/format';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();
  const user = useAuthStore((s) => s.user);
  const company = useAuthStore((s) => s.company);
  const hasModule = useAuthStore((s) => s.hasModule);

  // Quem atende tem link próprio para divulgar; quem só administra, não.
  const ownLink = user?.professional?.publicSlug ?? null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <SkeletonCards />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  const chartData = data.revenueSeries.map((point) => ({
    ...point,
    label: shortDate(point.date).slice(0, 5),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {user?.name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {ownLink && company?.slug ? (
        <PublicLinkCard companySlug={company.slug} professionalSlug={ownLink} />
      ) : null}

      {/* ------------------------------------------------------------ Hoje */}
      {data.today ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Atendimentos hoje"
            value={number(data.today.appointments)}
            hint={`${data.today.canceled} cancelamento(s)`}
            icon={CalendarCheck}
          />
          <StatCard
            label="Receita do dia"
            value={currency(data.today.revenue)}
            hint="Atendimentos finalizados"
            icon={Wallet}
            tone="success"
          />
          <StatCard
            label="Clientes"
            value={number(data.company.customers)}
            hint="Cadastros ativos"
            icon={Users}
            tone="info"
          />
          {hasModule('professionals') ? (
            <StatCard
              label="Profissionais"
              value={number(data.company.professionals)}
              hint={`${number(data.company.servicesCompletedMonth)} atendimentos no mês`}
              icon={UserCog}
            />
          ) : (
            <StatCard
              label="Atendimentos no mês"
              value={number(data.company.servicesCompletedMonth)}
              hint="Serviços finalizados"
              icon={CalendarDays}
            />
          )}
        </div>
      ) : null}

      {/* ------------------------------------------------------- Financeiro */}
      {data.financial ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Receita do mês"
            value={currency(data.financial.monthIncome)}
            icon={TrendingUp}
            tone="success"
          />
          <StatCard
            label="Despesas do mês"
            value={currency(data.financial.monthExpense)}
            icon={TrendingDown}
            tone="danger"
          />
          <StatCard
            label="Lucro estimado"
            value={currency(data.financial.monthProfit)}
            hint={data.financial.monthProfit >= 0 ? 'No azul' : 'Atenção ao resultado'}
            icon={Banknote}
            tone={data.financial.monthProfit >= 0 ? 'success' : 'danger'}
          />
          <StatCard
            label="A receber"
            value={currency(data.financial.toReceive)}
            hint={`A pagar: ${currency(data.financial.toPay)}`}
            icon={AlertTriangle}
            tone="warning"
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ------------------------------------------------------- Gráfico */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Faturamento dos últimos 30 dias</CardTitle>
              <p className="text-sm text-muted-foreground">Atendimentos finalizados por dia</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={24}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => compactCurrency(Number(value))}
                  />
                  <ReTooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [currency(value), 'Faturamento']}
                  />
                  <Area isAnimationActive={false}
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#revenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* --------------------------------------------------- Próximos */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Próximos atendimentos</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/agenda">
                Agenda
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.today?.upcoming.length ? (
              data.today.upcoming.slice(0, 6).map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-md bg-primary/10 py-1 text-primary">
                    <span className="text-sm font-semibold">{timeLabel(appointment.startsAt)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{appointment.customer.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {appointment.services.map((s) => s.name).join(', ')}
                    </p>
                  </div>
                  {appointment.professional ? (
                    <UserAvatar
                      name={appointment.professional.name}
                      color={appointment.professional.color}
                      className="size-7"
                    />
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Agenda livre"
                description="Nenhum atendimento restante para hoje."
                className="py-10"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* -------------------------------------------- Recursos e aluguéis */}
      {data.resources || data.rentals ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.resources ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Recursos</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/app/recursos">
                    Ver todos
                    <ArrowRight />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Total" value={data.resources.total} icon={DoorOpen} />
                <MiniStat label="Disponíveis" value={data.resources.available} tone="text-emerald-600" />
                <MiniStat label="Em uso" value={data.resources.inUse} tone="text-sky-600" />
                <MiniStat label="Manutenção" value={data.resources.maintenance} tone="text-amber-600" />
              </CardContent>
            </Card>
          ) : null}

          {data.rentals ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Aluguéis</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/app/alugueis">
                    Ver todos
                    <ArrowRight />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="Ativos" value={data.rentals.active} icon={KeyRound} />
                  <MiniStat label="Atrasados" value={data.rentals.overdue} tone="text-rose-600" />
                  <MiniStat
                    label="Receita/mês"
                    value={compactCurrency(data.rentals.monthlyRecurringRevenue)}
                    tone="text-emerald-600"
                  />
                </div>

                {data.rentals.upcoming.length ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Próximos vencimentos
                    </p>
                    {data.rentals.upcoming.slice(0, 3).map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                      >
                        <span className="truncate">
                          {payment.rental?.renterName} · {payment.rental?.resource.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {shortDate(payment.dueDate)} · {currency(payment.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = 'text-foreground',
  icon: Icon,
}: {
  label: string;
  value: number | string;
  tone?: string;
  icon?: typeof DoorOpen;
}) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </div>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

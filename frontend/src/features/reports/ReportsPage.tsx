import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, CalendarDays, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader, StatCard, TBody, TD, TH, THead, TR, Table } from '@/components/ui/data';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Label, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/primitives';
import { useReport } from '@/api/queries';
import { ResumoDoMesCard } from '@/features/insights/ResumoDoMesCard';
import { APPOINTMENT_STATUS } from '@/config/labels';
import { compactCurrency, currency, percent, weekdayName } from '@/lib/format';
import type { AppointmentStatus } from '@/types';

interface AppointmentsReport {
  total: number;
  completed: number;
  revenue: number;
  averageTicket: number;
  cancellationRate: number;
  byStatus: { status: string; count: number; revenue: number }[];
  byWeekday: { weekday: number; count: number; revenue: number }[];
}

interface ProfessionalRow {
  professionalId: string;
  name: string;
  color: string;
  appointments: number;
  completed: number;
  canceled: number;
  revenue: number;
  commissions: number;
}

interface ServicesReport {
  top: { serviceId: string; name: string; count: number; revenue: number }[];
}

interface CustomersReport {
  newCustomers: number;
  activeCustomers: number;
  returningCustomers: number;
  retentionRate: number;
  top: { customerId: string; name: string; visits: number; total: number }[];
}

function firstDayOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

export function ReportsPage() {
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const params = {
    from: new Date(`${from}T00:00:00`).toISOString(),
    to: new Date(`${to}T23:59:59`).toISOString(),
  };

  const appointments = useReport<AppointmentsReport>('appointments', params);
  const professionals = useReport<ProfessionalRow[]>('professionals', params);
  const services = useReport<ServicesReport>('services', params);
  const customers = useReport<CustomersReport>('customers', params);
  const evolution = useReport<{ month: string; income: number; expense: number; profit: number }[]>(
    'financial-evolution',
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Relatórios"
        description="Desempenho de atendimentos, equipe, serviços e clientes"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
          </div>
        }
      />

      {/* Antes das tabelas: quem abre relatorios quer a conclusao, e so depois
          conferir de onde ela veio. */}
      <ResumoDoMesCard />

      {appointments.isLoading ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : appointments.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Atendimentos" value={appointments.data.total} icon={CalendarDays} />
          <StatCard
            label="Faturamento"
            value={currency(appointments.data.revenue)}
            hint={`${appointments.data.completed} finalizados`}
            tone="success"
          />
          <StatCard label="Ticket médio" value={currency(appointments.data.averageTicket)} tone="info" />
          <StatCard
            label="Taxa de cancelamento"
            value={percent(appointments.data.cancellationRate)}
            tone={appointments.data.cancellationRate > 15 ? 'danger' : 'default'}
          />
        </div>
      ) : null}

      <Tabs defaultValue="operacao">
        <TabsList>
          <TabsTrigger value="operacao">Operação</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="financeiro">Evolução</TabsTrigger>
        </TabsList>

        <TabsContent value="operacao" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Atendimentos por dia da semana</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(appointments.data?.byWeekday ?? []).map((row) => ({
                        ...row,
                        label: weekdayName(row.weekday, true),
                      }))}
                      margin={{ left: -20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <ReTooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid hsl(var(--border))',
                          background: 'hsl(var(--card))',
                          fontSize: 12,
                        }}
                        formatter={(value: number, name) => [
                          name === 'revenue' ? currency(value) : value,
                          name === 'revenue' ? 'Faturamento' : 'Atendimentos',
                        ]}
                      />
                      <Bar isAnimationActive={false} dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição por status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(appointments.data?.byStatus ?? []).map((row) => {
                  const total = appointments.data?.total || 1;
                  const config = APPOINTMENT_STATUS[row.status as AppointmentStatus];
                  return (
                    <div key={row.status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{config?.label ?? row.status}</span>
                        <span className="text-muted-foreground">
                          {row.count} · {percent((row.count / total) * 100, 0)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${config?.dot ?? 'bg-primary'}`}
                          style={{ width: `${(row.count / total) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Serviços mais realizados</CardTitle>
            </CardHeader>
            {services.data?.top.length ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Serviço</TH>
                    <TH>Quantidade</TH>
                    <TH>Faturamento</TH>
                  </TR>
                </THead>
                <TBody>
                  {services.data.top.map((service) => (
                    <TR key={service.serviceId}>
                      <TD className="text-sm font-medium">{service.name}</TD>
                      <TD className="text-sm">{service.count}</TD>
                      <TD className="text-sm">{currency(service.revenue)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <CardContent>
                <EmptyState icon={BarChart3} title="Sem dados no período" />
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="equipe">
          <Card>
            <CardHeader>
              <CardTitle>Desempenho por profissional</CardTitle>
            </CardHeader>
            {professionals.data?.length ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Profissional</TH>
                    <TH>Atendimentos</TH>
                    <TH>Finalizados</TH>
                    <TH>Cancelados</TH>
                    <TH>Faturamento</TH>
                    <TH>Comissões</TH>
                  </TR>
                </THead>
                <TBody>
                  {professionals.data.map((row) => (
                    <TR key={row.professionalId}>
                      <TD>
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                          {row.name}
                        </span>
                      </TD>
                      <TD className="text-sm">{row.appointments}</TD>
                      <TD className="text-sm">{row.completed}</TD>
                      <TD className="text-sm">{row.canceled}</TD>
                      <TD className="text-sm font-medium">{currency(row.revenue)}</TD>
                      <TD className="text-sm">{currency(row.commissions)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <CardContent>
                <EmptyState icon={Users} title="Sem dados no período" />
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          {customers.data ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Novos clientes" value={customers.data.newCustomers} />
              <StatCard label="Clientes ativos" value={customers.data.activeCustomers} tone="info" />
              <StatCard label="Recorrentes" value={customers.data.returningCustomers} tone="success" />
              <StatCard label="Taxa de retorno" value={percent(customers.data.retentionRate)} />
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Clientes que mais gastaram</CardTitle>
            </CardHeader>
            {customers.data?.top.length ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Cliente</TH>
                    <TH>Visitas</TH>
                    <TH>Total gasto</TH>
                  </TR>
                </THead>
                <TBody>
                  {customers.data.top.map((row) => (
                    <TR key={row.customerId}>
                      <TD className="text-sm font-medium">{row.name}</TD>
                      <TD className="text-sm">{row.visits}</TD>
                      <TD className="text-sm font-medium">{currency(row.total)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <CardContent>
                <EmptyState icon={Users} title="Sem dados no período" />
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="financeiro">
          <Card>
            <CardHeader>
              <CardTitle>Evolução dos últimos 12 meses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolution.data ?? []} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={70}
                      tick={{ fontSize: 11 }}
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
                        name === 'income' ? 'Receita' : name === 'expense' ? 'Despesa' : 'Lucro',
                      ]}
                    />
                    <Line isAnimationActive={false} type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} dot={false} />
                    <Line isAnimationActive={false} type="monotone" dataKey="expense" stroke="#F43F5E" strokeWidth={2} dot={false} />
                    <Line isAnimationActive={false}
                      type="monotone"
                      dataKey="profit"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

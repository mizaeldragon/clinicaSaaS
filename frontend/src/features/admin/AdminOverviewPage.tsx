import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2, CircleDollarSign, Rocket, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatCard, TBody, TD, TH, THead, TR, Table } from '@/components/ui/data';
import { PageLoader } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';
import { CompanyStatusBadge } from '@/components/StatusBadge';
import { useAdminMetrics } from '@/api/queries';
import { compactCurrency, currency, shortDate } from '@/lib/format';

export function AdminOverviewPage() {
  const { data, isLoading } = useAdminMetrics();

  if (isLoading) return <PageLoader label="Carregando métricas da plataforma..." />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Visão geral da plataforma"
        description="Métricas globais do SaaS: empresas, assinaturas e receita recorrente"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Empresas"
          value={data.companies.total}
          hint={`${data.companies.active} ativas · ${data.companies.trialing} em teste`}
          icon={Building2}
        />
        <StatCard
          label="MRR"
          value={currency(data.mrr)}
          hint={`ARR: ${currency(data.arr)}`}
          icon={CircleDollarSign}
          tone="success"
        />
        <StatCard
          label="Assinaturas ativas"
          value={data.subscriptions.active}
          hint={`${data.subscriptions.pastDue} inadimplente(s)`}
          icon={TrendingUp}
          tone="info"
        />
        <StatCard
          label="Empresas bloqueadas"
          value={data.companies.suspended}
          hint={`${data.companies.canceled} canceladas`}
          icon={Rocket}
          tone={data.companies.suspended > 0 ? 'danger' : 'default'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Empresas por plano</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.planDistribution} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
                  <ReTooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                      fontSize: 12,
                    }}
                  />
                  <Bar isAnimationActive={false} dataKey="companies" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receita por plano</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.planDistribution.map((plan: { planId: string; name: string; price: number; companies: number; active: number }) => (
              <div
                key={plan.planId}
                className="flex items-center justify-between rounded-lg border border-border/70 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.companies} empresa(s) · {plan.active} ativa(s)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{compactCurrency(plan.price * plan.active)}</p>
                  <p className="text-xs text-muted-foreground">{currency(plan.price)}/empresa</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Empresas recentes</CardTitle>
          <Link to="/admin/empresas" className="text-sm font-medium text-primary hover:underline">
            Ver todas →
          </Link>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Empresa</TH>
              <TH>Plano</TH>
              <TH>Usuários</TH>
              <TH>Criada em</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {data.recentCompanies.map((company: {
              id: string;
              name: string;
              slug: string;
              status: string;
              createdAt: string;
              subscription?: { plan: { name: string } } | null;
              _count: { users: number };
            }) => (
              <TR key={company.id}>
                <TD>
                  <p className="text-sm font-medium">{company.name}</p>
                  <p className="text-xs text-muted-foreground">{company.slug}</p>
                </TD>
                <TD>
                  <Badge variant="secondary">{company.subscription?.plan.name ?? '—'}</Badge>
                </TD>
                <TD className="text-sm">{company._count.users}</TD>
                <TD className="text-sm text-muted-foreground">{shortDate(company.createdAt)}</TD>
                <TD>
                  <CompanyStatusBadge status={company.status} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

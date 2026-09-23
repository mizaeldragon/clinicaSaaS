import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Mail,
  Phone,
  Receipt,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/data';
import { EmptyState, PageLoader } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger, UserAvatar } from '@/components/ui/primitives';
import { AppointmentStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { useCustomerProfile } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { currency, dateLabel, dateTimeLabel, fromNow, phoneMask, shortDate, timeLabel } from '@/lib/format';
import type { AppointmentStatus, PaymentStatus } from '@/types';

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading } = useCustomerProfile(id);
  const hasFinancial = useAuthStore((s) => s.hasModule('financial'));

  if (isLoading) return <PageLoader label="Carregando perfil do cliente..." />;
  if (!data) return null;

  const { customer, metrics, appointments, transactions, timeline } = data;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/app/clientes">
          <ArrowLeft />
          Voltar para clientes
        </Link>
      </Button>

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar name={customer.name} className="size-16 text-lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {customer.phone ? (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {phoneMask(customer.phone)}
                </span>
              ) : null}
              {customer.email ? (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {customer.email}
                </span>
              ) : null}
              {customer.birthDate ? (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" />
                  {shortDate(customer.birthDate)}
                </span>
              ) : null}
            </div>
            {customer.notes ? (
              <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">{customer.notes}</p>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total gasto" value={currency(metrics.totalSpent)} icon={Wallet} tone="success" />
        <StatCard label="Atendimentos" value={metrics.totalAppointments} icon={CalendarDays} />
        <StatCard
          label="Último atendimento"
          value={metrics.lastVisit ? shortDate(metrics.lastVisit) : '—'}
          hint={metrics.lastVisit ? fromNow(metrics.lastVisit) : 'Sem histórico'}
          icon={CalendarClock}
          tone="info"
        />
        <StatCard
          label="Próximo agendamento"
          /*
            Data e hora inteiras, quebrando de linha só se não couberem.

            O StatCard corta o valor numa linha, e "24/09/2026 às 09:00" não
            cabe no cartão: sobrava "às 09..." — justamente a hora, a metade
            que diz quando a cliente chega. O bloco interno volta a permitir
            quebra, e "às 09:00" fica sempre junto na mesma linha.
          */
          value={
            metrics.upcomingAppointment ? (
              <span className="block whitespace-normal leading-tight">
                {shortDate(metrics.upcomingAppointment.startsAt)}{' '}
                <span className="whitespace-nowrap">
                  às {timeLabel(metrics.upcomingAppointment.startsAt)}
                </span>
              </span>
            ) : (
              '—'
            )
          }
          hint={
            metrics.upcomingAppointment
              ? metrics.upcomingAppointment.services.map((s) => s.name).join(', ')
              : 'Nada agendado'
          }
          icon={CalendarClock}
          tone="warning"
        />
      </div>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="appointments">Atendimentos</TabsTrigger>
          {hasFinancial ? <TabsTrigger value="financial">Financeiro</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de atendimentos</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Sem histórico ainda"
                  description="Os atendimentos realizados aparecerão aqui em ordem cronológica."
                />
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-6">
                  {timeline.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span className="absolute -left-[27px] top-1.5 flex size-3 items-center justify-center rounded-full border-2 border-background bg-primary" />
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 p-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            📅 {dateLabel(entry.date)}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {entry.title}
                            {entry.professional ? ` · ${entry.professional}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <AppointmentStatusBadge status={entry.status as AppointmentStatus} />
                          <span className="font-semibold">{currency(entry.amount)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardContent className="space-y-2 pt-5">
              {appointments.length === 0 ? (
                <EmptyState icon={CalendarDays} title="Nenhum agendamento" />
              ) : (
                appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{dateTimeLabel(appointment.startsAt)}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {appointment.services.map((s) => s.name).join(', ')}
                        {appointment.professional ? ` · ${appointment.professional.name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <AppointmentStatusBadge status={appointment.status} />
                      <span className="font-semibold">{currency(appointment.totalPrice)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {hasFinancial ? (
          <TabsContent value="financial">
            <Card>
              <CardContent className="space-y-2 pt-5">
                {transactions.length === 0 ? (
                  <EmptyState icon={Receipt} title="Nenhum lançamento financeiro" />
                ) : (
                  transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {shortDate(transaction.competenceDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <PaymentStatusBadge status={transaction.paymentStatus as PaymentStatus} />
                        <span className="font-semibold">{currency(transaction.amount)}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

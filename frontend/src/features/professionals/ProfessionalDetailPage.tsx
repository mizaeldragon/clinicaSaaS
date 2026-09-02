import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CalendarOff, Percent, Save, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/ui/data';
import { EmptyState, PageLoader } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';
import {
  Label,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  UserAvatar,
} from '@/components/ui/primitives';
import { AppointmentStatusBadge } from '@/components/StatusBadge';
import {
  useProfessional,
  useProfessionalDashboard,
  useProfessionalMutations,
} from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { currency, dateTimeLabel, weekdayName } from '@/lib/format';
import type { WorkingHour } from '@/types';

const DEFAULT_HOURS: WorkingHour[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  startsAt: '09:00',
  endsAt: '18:00',
  breakStart: '12:00',
  breakEnd: '13:00',
  isOff: weekday === 0,
}));

export function ProfessionalDetailPage() {
  const { id = '' } = useParams();
  const canManage = useAuthStore((s) => s.can('professionals:manage'));
  const hasCommissions = useAuthStore((s) => s.hasModule('commissions'));

  const { data: professional, isLoading } = useProfessional(id);
  const { data: dashboard } = useProfessionalDashboard(id);
  const { setWorkingHours, addTimeOff } = useProfessionalMutations();

  const [hours, setHours] = useState<WorkingHour[]>(DEFAULT_HOURS);
  const [timeOff, setTimeOff] = useState({ startsAt: '', endsAt: '', reason: '' });

  useEffect(() => {
    if (!professional?.workingHours) return;
    const map = new Map(professional.workingHours.map((h) => [h.weekday, h]));
    setHours(
      DEFAULT_HOURS.map((base) => {
        const found = map.get(base.weekday);
        return found ? { ...base, ...found } : { ...base, isOff: true };
      }),
    );
  }, [professional]);

  if (isLoading) return <PageLoader />;
  if (!professional) return null;

  function updateHour(weekday: number, patch: Partial<WorkingHour>) {
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)));
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/app/profissionais">
          <ArrowLeft />
          Voltar
        </Link>
      </Button>

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar
            name={professional.name}
            src={professional.avatarUrl}
            color={professional.color}
            className="size-16 text-lg"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{professional.name}</h1>
            <div className="flex flex-wrap gap-1.5">
              {professional.specialties.map((specialty) => (
                <Badge key={specialty} variant="secondary">
                  {specialty}
                </Badge>
              ))}
            </div>
            {professional.commissionType ? (
              <p className="text-sm text-muted-foreground">
                Comissão padrão:{' '}
                {professional.commissionType === 'PERCENTAGE'
                  ? `${professional.commissionValue}%`
                  : currency(professional.commissionValue)}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Atendimentos hoje"
          value={dashboard?.appointmentsToday ?? 0}
          icon={CalendarDays}
        />
        <StatCard
          label="Finalizados no mês"
          value={dashboard?.completedMonth ?? 0}
          icon={CalendarDays}
          tone="info"
        />
        <StatCard
          label="Faturamento do mês"
          value={currency(dashboard?.revenueMonth ?? 0)}
          icon={Wallet}
          tone="success"
        />
        {hasCommissions ? (
          <StatCard
            label="Comissões do mês"
            value={currency(dashboard?.commissionsMonth ?? 0)}
            icon={Percent}
            tone="warning"
          />
        ) : null}
      </div>

      <Tabs defaultValue="agenda">
        <TabsList>
          <TabsTrigger value="agenda">Próximos atendimentos</TabsTrigger>
          <TabsTrigger value="hours">Jornada de trabalho</TabsTrigger>
          <TabsTrigger value="timeoff">Ausências</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda">
          <Card>
            <CardContent className="space-y-2 pt-5">
              {dashboard?.upcoming.length ? (
                dashboard.upcoming.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{appointment.customer.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {dateTimeLabel(appointment.startsAt)} ·{' '}
                        {appointment.services.map((s) => s.name).join(', ')}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={appointment.status} />
                  </div>
                ))
              ) : (
                <EmptyState icon={CalendarDays} title="Nenhum atendimento agendado" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Jornada semanal</CardTitle>
              {canManage ? (
                <Button
                  size="sm"
                  loading={setWorkingHours.isPending}
                  onClick={() =>
                    setWorkingHours.mutate({
                      id,
                      workingHours: hours.map((h) => ({
                        weekday: h.weekday,
                        startsAt: h.startsAt,
                        endsAt: h.endsAt,
                        breakStart: h.breakStart || null,
                        breakEnd: h.breakEnd || null,
                        isOff: h.isOff,
                      })),
                    })
                  }
                >
                  <Save />
                  Salvar jornada
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-2">
              {hours.map((hour) => (
                <div
                  key={hour.weekday}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 p-3"
                >
                  <div className="flex w-32 items-center gap-2">
                    <Switch
                      checked={!hour.isOff}
                      disabled={!canManage}
                      onCheckedChange={(checked) => updateHour(hour.weekday, { isOff: !checked })}
                    />
                    <span className="text-sm font-medium">{weekdayName(hour.weekday)}</span>
                  </div>

                  {hour.isOff ? (
                    <span className="text-sm text-muted-foreground">Folga</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Input
                        type="time"
                        className="h-9 w-28"
                        disabled={!canManage}
                        value={hour.startsAt}
                        onChange={(e) => updateHour(hour.weekday, { startsAt: e.target.value })}
                      />
                      <span className="text-muted-foreground">até</span>
                      <Input
                        type="time"
                        className="h-9 w-28"
                        disabled={!canManage}
                        value={hour.endsAt}
                        onChange={(e) => updateHour(hour.weekday, { endsAt: e.target.value })}
                      />
                      <span className="ml-2 text-xs text-muted-foreground">intervalo</span>
                      <Input
                        type="time"
                        className="h-9 w-28"
                        disabled={!canManage}
                        value={hour.breakStart ?? ''}
                        onChange={(e) => updateHour(hour.weekday, { breakStart: e.target.value })}
                      />
                      <Input
                        type="time"
                        className="h-9 w-28"
                        disabled={!canManage}
                        value={hour.breakEnd ?? ''}
                        onChange={(e) => updateHour(hour.weekday, { breakEnd: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeoff">
          <Card>
            <CardHeader>
              <CardTitle>Registrar ausência</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canManage ? (
                <form
                  className="grid gap-3 sm:grid-cols-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await addTimeOff
                      .mutateAsync({
                        id,
                        startsAt: new Date(timeOff.startsAt).toISOString(),
                        endsAt: new Date(timeOff.endsAt).toISOString(),
                        reason: timeOff.reason || undefined,
                      })
                      .then(() => setTimeOff({ startsAt: '', endsAt: '', reason: '' }))
                      .catch(() => undefined);
                  }}
                >
                  <div className="space-y-1.5">
                    <Label>Início</Label>
                    <Input
                      type="datetime-local"
                      required
                      value={timeOff.startsAt}
                      onChange={(e) => setTimeOff((t) => ({ ...t, startsAt: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fim</Label>
                    <Input
                      type="datetime-local"
                      required
                      value={timeOff.endsAt}
                      onChange={(e) => setTimeOff((t) => ({ ...t, endsAt: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Motivo</Label>
                    <Input
                      placeholder="Férias, consulta..."
                      value={timeOff.reason}
                      onChange={(e) => setTimeOff((t) => ({ ...t, reason: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full" loading={addTimeOff.isPending}>
                      Registrar
                    </Button>
                  </div>
                </form>
              ) : null}

              <div className="space-y-2">
                {professional.timeOffs?.length ? (
                  professional.timeOffs.map((entry: { id: string; startsAt: string; endsAt: string; reason: string | null }) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border border-border/70 p-3 text-sm"
                    >
                      <span>
                        {dateTimeLabel(entry.startsAt)} → {dateTimeLabel(entry.endsAt)}
                      </span>
                      <span className="text-muted-foreground">{entry.reason ?? '—'}</span>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={CalendarOff}
                    title="Nenhuma ausência registrada"
                    description="Ausências bloqueiam automaticamente novos agendamentos no período."
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

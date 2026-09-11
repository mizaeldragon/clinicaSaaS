import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';
import { CalendarPlus, ChevronLeft, ChevronRight, Filter, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/primitives';
import { SearchSelect } from '@/components/ui/search-select';
import { useCalendar, useProfessionals, useResources, useServices } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { CalendarGrid } from './CalendarGrid';
import { MonthGrid } from './MonthGrid';
import { MobileAgenda } from './MobileAgenda';
import { AppointmentDialog } from './AppointmentDialog';
import { AppointmentDetail } from './AppointmentDetail';
import { RentedShiftsBand } from './RentedShiftsBand';
import { StatusLegend } from './StatusLegend';
import type { Appointment } from '@/types';

type View = 'day' | 'week' | 'month';

export function AgendaPage() {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const hasModule = useAuthStore((s) => s.hasModule);
  const can = useAuthStore((s) => s.can);

  const [view, setView] = useState<View>('week');
  const [reference, setReference] = useState(new Date());
  const [professionalId, setProfessionalId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [slotDate, setSlotDate] = useState<Date | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);

  const range = useMemo(() => {
    if (view === 'day') return { from: startOfDay(reference), to: endOfDay(reference) };
    if (view === 'week') {
      return {
        from: startOfWeek(reference, { weekStartsOn: 0 }),
        to: endOfWeek(reference, { weekStartsOn: 0 }),
      };
    }
    return {
      from: startOfWeek(startOfMonth(reference), { weekStartsOn: 0 }),
      to: endOfWeek(endOfMonth(reference), { weekStartsOn: 0 }),
    };
  }, [view, reference]);

  const days = useMemo(
    () => eachDayOfInterval({ start: range.from, end: range.to }),
    [range],
  );

  const { data: appointments, isLoading } = useCalendar({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    professionalId: professionalId || undefined,
    serviceId: serviceId || undefined,
    roomId: roomId || undefined,
  });

  const { data: professionals } = useProfessionals({ isActive: 'true' });
  const { data: services } = useServices({ isActive: 'true' });
  const { data: resources } = useResources({ onlyRooms: 'true' });

  function navigate(direction: -1 | 1) {
    if (view === 'day') setReference((d) => addDays(d, direction));
    else if (view === 'week') setReference((d) => addDays(d, direction * 7));
    else setReference((d) => addMonths(d, direction));
  }

  const periodLabel = useMemo(() => {
    if (view === 'day') return format(reference, "EEEE, dd 'de' MMMM", { locale: ptBR });
    if (view === 'week') {
      return `${format(range.from, 'dd MMM', { locale: ptBR })} – ${format(range.to, 'dd MMM yyyy', { locale: ptBR })}`;
    }
    return format(reference, "MMMM 'de' yyyy", { locale: ptBR });
  }, [view, reference, range]);

  const canManage = can('appointments:manage');
  const hasActiveFilters = Boolean(professionalId || serviceId || roomId);

  function openCreate(date?: Date) {
    setEditing(null);
    setSlotDate(date ?? null);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="text-sm capitalize text-muted-foreground">{periodLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={hasActiveFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter />
            Filtros
            {hasActiveFilters ? (
              <span className="ml-0.5 rounded-full bg-white/25 px-1.5 text-[10px]">
                {[professionalId, serviceId, roomId].filter(Boolean).length}
              </span>
            ) : null}
          </Button>

          {canManage ? (
            <Button size="sm" onClick={() => openCreate()}>
              <CalendarPlus />
              Novo agendamento
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => navigate(-1)} aria-label="Anterior">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setReference(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => navigate(1)} aria-label="Próximo">
            <ChevronRight />
          </Button>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="day">Dia</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="month">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {showFilters ? (
        <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {hasModule('professionals') ? (
            <SearchSelect
              allowClear
              options={(professionals?.data ?? []).map((p) => ({
                value: p.id,
                label: p.name,
                color: p.color,
              }))}
              value={professionalId}
              onChange={setProfessionalId}
              placeholder="Todos os profissionais"
            />
          ) : null}

          <SearchSelect
            allowClear
            options={(services?.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            value={serviceId}
            onChange={setServiceId}
            placeholder="Todos os serviços"
          />

          {hasModule('resources') ? (
            <SearchSelect
              allowClear
              options={(resources?.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
              value={roomId}
              onChange={setRoomId}
              placeholder="Todas as salas"
            />
          ) : null}

          <Button
            variant="ghost"
            onClick={() => {
              setProfessionalId('');
              setServiceId('');
              setRoomId('');
            }}
            disabled={!hasActiveFilters}
          >
            <RotateCcw />
            Limpar filtros
          </Button>
        </Card>
      ) : null}

      <RentedShiftsBand days={days} from={range.from} to={range.to} />

      {isLoading ? (
        <Skeleton className="h-[560px] rounded-xl" />
      ) : isMobile ? (
        <MobileAgenda
          days={days}
          appointments={appointments ?? []}
          onSelectAppointment={setSelected}
          onCreate={() => openCreate()}
        />
      ) : (
        <Card className="overflow-hidden">
          {/* O que cada cor significa, e quantos de cada no período aberto. */}
          <div className="border-b px-4 py-2.5">
            <StatusLegend statuses={(appointments ?? []).map((item) => item.status)} />
          </div>

          {view === 'month' ? (
            <MonthGrid
              reference={reference}
              appointments={appointments ?? []}
              onSelectDay={(day) => {
                setReference(day);
                setView('day');
              }}
              onSelectAppointment={setSelected}
            />
          ) : (
            <CalendarGrid
              days={days}
              appointments={appointments ?? []}
              onSelectAppointment={setSelected}
              onSelectSlot={(date) => (canManage ? openCreate(date) : undefined)}
            />
          )}
        </Card>
      )}

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        appointment={editing}
        initialDate={slotDate}
      />

      <AppointmentDetail
        appointment={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        onEdit={() => {
          setEditing(selected);
          setSelected(null);
          setSlotDate(null);
          setDialogOpen(true);
        }}
      />
    </div>
  );
}

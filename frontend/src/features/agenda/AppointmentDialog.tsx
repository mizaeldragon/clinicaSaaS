import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { SearchSelect } from '@/components/ui/search-select';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/feedback';
import {
  useAppointmentMutations,
  useAvailability,
  useCustomers,
  useProfessionals,
  useResources,
  useServices,
} from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/types';

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: Appointment | null;
  initialDate?: Date | null;
}

function toDateInput(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function toTimeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  initialDate,
}: AppointmentDialogProps) {
  const hasModule = useAuthStore((s) => s.hasModule);
  const { create, update } = useAppointmentMutations();

  const { data: customers } = useCustomers({ perPage: 100, isActive: 'true' });
  const { data: services } = useServices({ isActive: 'true' });
  const { data: professionals } = useProfessionals({ isActive: 'true' });
  const { data: resources } = useResources({});

  const [customerId, setCustomerId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState(toDateInput(new Date()));
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');

  const isEditing = Boolean(appointment);

  useEffect(() => {
    if (!open) return;

    if (appointment) {
      const start = new Date(appointment.startsAt);
      setCustomerId(appointment.customerId);
      setProfessionalId(appointment.professionalId ?? '');
      setRoomId(appointment.roomId ?? '');
      setResourceId(appointment.resourceId ?? '');
      setServiceIds(appointment.services.map((s) => s.serviceId));
      setDate(toDateInput(start));
      setTime(toTimeInput(start));
      setNotes(appointment.notes ?? '');
    } else {
      const start = initialDate ?? new Date();
      setCustomerId('');
      setProfessionalId('');
      setRoomId('');
      setResourceId('');
      setServiceIds([]);
      setDate(toDateInput(start));
      setTime(initialDate ? toTimeInput(start) : '09:00');
      setNotes('');
    }
  }, [open, appointment, initialDate]);

  const selectedServices = useMemo(
    () => (services?.data ?? []).filter((service) => serviceIds.includes(service.id)),
    [services, serviceIds],
  );

  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);

  const { data: slots, isFetching: loadingSlots } = useAvailability({
    professionalId: professionalId || undefined,
    date: date ? new Date(`${date}T12:00:00`).toISOString() : undefined,
    durationMinutes: totalDuration || 60,
  });

  const rooms = (resources?.data ?? []).filter((r) => r.category?.isRoom);
  const otherResources = (resources?.data ?? []).filter((r) => !r.category?.isRoom);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const startsAt = new Date(`${date}T${time}:00`);
    const payload = {
      customerId,
      professionalId: professionalId || null,
      roomId: roomId || null,
      resourceId: resourceId || null,
      startsAt: startsAt.toISOString(),
      services: serviceIds.map((serviceId) => ({ serviceId, quantity: 1 })),
      notes: notes || undefined,
    };

    if (isEditing && appointment) {
      await update.mutateAsync({ id: appointment.id, ...payload }).then(() => onOpenChange(false)).catch(() => undefined);
    } else {
      await create.mutateAsync(payload).then(() => onOpenChange(false)).catch(() => undefined);
    }
  }

  const submitting = create.isPending || update.isPending;
  const canSubmit = customerId && serviceIds.length > 0 && date && time;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar agendamento' : 'Novo agendamento'}</DialogTitle>
          <DialogDescription>
            O sistema valida automaticamente conflitos de profissional, sala e recurso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <SearchSelect
              options={(customers?.data ?? []).map((customer) => ({
                value: customer.id,
                label: customer.name,
                description: customer.phone ?? undefined,
              }))}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Selecione o cliente"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Serviços *</Label>
            <div className="flex flex-wrap gap-1.5 rounded-lg border p-2">
              {selectedServices.length === 0 ? (
                <span className="px-1 py-1 text-sm text-muted-foreground">
                  Nenhum serviço selecionado
                </span>
              ) : (
                selectedServices.map((service) => (
                  <Badge key={service.id} variant="secondary" className="gap-1 py-1">
                    {service.name}
                    <button
                      type="button"
                      onClick={() => setServiceIds((ids) => ids.filter((id) => id !== service.id))}
                      aria-label={`Remover ${service.name}`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <SearchSelect
              options={(services?.data ?? [])
                .filter((service) => !serviceIds.includes(service.id))
                .map((service) => ({
                  value: service.id,
                  label: service.name,
                  description: `${currency(service.price)} · ${service.durationMinutes} min`,
                  color: service.category?.color,
                }))}
              value=""
              onChange={(value) => value && setServiceIds((ids) => [...ids, value])}
              placeholder="Adicionar serviço"
            />
          </div>

          {hasModule('professionals') ? (
            <div className="space-y-1.5">
              <Label>Profissional</Label>
              <SearchSelect
                allowClear
                options={(professionals?.data ?? []).map((professional) => ({
                  value: professional.id,
                  label: professional.name,
                  description: professional.specialties.join(', '),
                  color: professional.color,
                }))}
                value={professionalId}
                onChange={setProfessionalId}
                placeholder="Sem profissional definido"
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="date">Data *</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">Horário *</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>

          {professionalId && slots?.length ? (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Horários disponíveis
                </p>
                {loadingSlots ? <Spinner className="size-4" /> : null}
              </div>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setTime(slot.time)}
                    title={slot.reason}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs transition-all',
                      slot.time === time && 'border-primary bg-primary text-primary-foreground',
                      !slot.available && 'cursor-not-allowed border-dashed opacity-40 line-through',
                      slot.available && slot.time !== time && 'hover:border-primary hover:bg-primary/10',
                    )}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {hasModule('resources') ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Sala</Label>
                <SearchSelect
                  allowClear
                  options={rooms.map((room) => ({ value: room.id, label: room.name }))}
                  value={roomId}
                  onChange={setRoomId}
                  placeholder="Sem sala"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Recurso</Label>
                <SearchSelect
                  allowClear
                  options={otherResources.map((resource) => ({
                    value: resource.id,
                    label: resource.name,
                    description: resource.category?.name,
                  }))}
                  value={resourceId}
                  onChange={setResourceId}
                  placeholder="Sem recurso"
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Preferências do cliente, detalhes do atendimento..."
            />
          </div>

          {selectedServices.length > 0 ? (
            <div className="flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {totalDuration} min · {selectedServices.length} serviço(s)
              </span>
              <span className="text-base font-semibold">{currency(totalPrice)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
              <AlertTriangle className="size-4" />
              Selecione ao menos um serviço para calcular duração e valor.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting} disabled={!canSubmit}>
              <Plus />
              {isEditing ? 'Salvar alterações' : 'Criar agendamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

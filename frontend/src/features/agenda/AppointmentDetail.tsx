import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  CheckCircle2,
  Clock3,
  DoorOpen,
  ExternalLink,
  Pencil,
  PlayCircle,
  Trash2,
  UserX,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label, Separator } from '@/components/ui/primitives';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AppointmentStatusBadge } from '@/components/StatusBadge';
import { useAppointmentMutations } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { PAYMENT_METHOD } from '@/config/labels';
import { currency, dateTimeLabel, phoneMask, timeLabel } from '@/lib/format';
import type { Appointment, AppointmentStatus, PaymentMethod } from '@/types';

const NEXT_ACTIONS: Record<
  AppointmentStatus,
  { status: AppointmentStatus; label: string; icon: typeof CheckCircle2; variant?: 'default' | 'outline' | 'destructive' | 'success' }[]
> = {
  SCHEDULED: [
    { status: 'CONFIRMED', label: 'Confirmar', icon: CheckCircle2, variant: 'default' },
    { status: 'IN_PROGRESS', label: 'Iniciar', icon: PlayCircle, variant: 'outline' },
    { status: 'NO_SHOW', label: 'Não compareceu', icon: UserX, variant: 'outline' },
    { status: 'CANCELED', label: 'Cancelar', icon: Ban, variant: 'destructive' },
  ],
  CONFIRMED: [
    { status: 'IN_PROGRESS', label: 'Iniciar atendimento', icon: PlayCircle, variant: 'default' },
    { status: 'NO_SHOW', label: 'Não compareceu', icon: UserX, variant: 'outline' },
    { status: 'CANCELED', label: 'Cancelar', icon: Ban, variant: 'destructive' },
  ],
  IN_PROGRESS: [
    { status: 'COMPLETED', label: 'Finalizar', icon: CheckCircle2, variant: 'success' },
    { status: 'CANCELED', label: 'Cancelar', icon: Ban, variant: 'destructive' },
  ],
  COMPLETED: [],
  CANCELED: [{ status: 'SCHEDULED', label: 'Reabrir', icon: Clock3, variant: 'outline' }],
  NO_SHOW: [{ status: 'SCHEDULED', label: 'Reabrir', icon: Clock3, variant: 'outline' }],
};

export function AppointmentDetail({
  appointment,
  open,
  onOpenChange,
  onEdit,
}: {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  const { updateStatus, remove } = useAppointmentMutations();
  const hasFinancial = useAuthStore((s) => s.hasModule('financial'));

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [completing, setCompleting] = useState(false);

  if (!appointment) return null;

  const actions = NEXT_ACTIONS[appointment.status];

  async function apply(status: AppointmentStatus) {
    if (!appointment) return;

    if (status === 'COMPLETED' && hasFinancial && !completing) {
      setCompleting(true);
      return;
    }

    await updateStatus
      .mutateAsync({
        id: appointment.id,
        status,
        ...(status === 'COMPLETED' && hasFinancial
          ? { payment: { method: paymentMethod, paid: true } }
          : {}),
      })
      .then(() => {
        setCompleting(false);
        onOpenChange(false);
      })
      .catch(() => undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div>
              <DialogTitle>{appointment.customer.name}</DialogTitle>
              <DialogDescription>{dateTimeLabel(appointment.startsAt)}</DialogDescription>
            </div>
            <AppointmentStatusBadge status={appointment.status} />
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Horário" value={`${timeLabel(appointment.startsAt)} – ${timeLabel(appointment.endsAt)}`} />
            <Info label="Duração" value={`${appointment.durationMinutes} min`} />
            <Info label="Profissional" value={appointment.professional?.name ?? 'Não definido'} />
            <Info label="Telefone" value={phoneMask(appointment.customer.phone)} />
            {appointment.room ? (
              <Info label="Sala" value={appointment.room.name} icon={DoorOpen} />
            ) : null}
            {appointment.resource ? <Info label="Recurso" value={appointment.resource.name} /> : null}
          </div>

          <div className="rounded-lg border">
            <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Serviços
            </div>
            <ul className="divide-y">
              {appointment.services.map((service) => (
                <li key={service.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>
                    {service.name}
                    {service.quantity > 1 ? ` ×${service.quantity}` : ''}
                  </span>
                  <span className="font-medium">{currency(service.price * service.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t bg-muted/40 px-3 py-2 text-sm font-semibold">
              <span>Total</span>
              <span>{currency(appointment.totalPrice)}</span>
            </div>
          </div>

          {appointment.notes ? (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Observações
              </p>
              {appointment.notes}
            </div>
          ) : null}

          {completing ? (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <Label>Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
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
              <p className="text-xs text-muted-foreground">
                A receita de {currency(appointment.totalPrice)} será lançada no financeiro e a comissão
                do profissional calculada automaticamente.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="success"
                  className="flex-1"
                  loading={updateStatus.isPending}
                  onClick={() => apply('COMPLETED')}
                >
                  Confirmar finalização
                </Button>
                <Button variant="ghost" onClick={() => setCompleting(false)}>
                  Voltar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action.status}
                  size="sm"
                  variant={action.variant ?? 'outline'}
                  loading={updateStatus.isPending}
                  onClick={() => apply(action.status)}
                >
                  <action.icon />
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/app/clientes/${appointment.customerId}`}>
                <ExternalLink />
                Ver cliente
              </Link>
            </Button>

            <div className="flex gap-2">
              {appointment.status !== 'COMPLETED' ? (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Pencil />
                  Editar
                </Button>
              ) : null}
              {appointment.status !== 'COMPLETED' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  loading={remove.isPending}
                  onClick={async () => {
                    await remove.mutateAsync(appointment.id).catch(() => undefined);
                    onOpenChange(false);
                  }}
                >
                  <Trash2 />
                  Excluir
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof DoorOpen;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="flex items-center gap-1.5 font-medium">
        {Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}
        {value}
      </p>
    </div>
  );
}

import { useState } from 'react';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, Trash2, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Label, UserAvatar } from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  useBookingMutations,
  useDayMap,
  useShifts,
  type RentalBooking,
} from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { BookingDialog, type BookingTarget } from './BookingDialog';
import { PAYMENT_METHOD } from '@/config/labels';
import { currency } from '@/lib/format';
import type { PaymentMethod } from '@/types';

export function ShiftBoard() {
  const canManage = useAuthStore((s) => s.can('rentals:manage'));

  const [date, setDate] = useState(() => new Date());
  const [target, setTarget] = useState<BookingTarget | null>(null);
  const [detail, setDetail] = useState<RentalBooking | null>(null);

  const dayKey = date.toISOString();
  const { data, isLoading } = useDayMap(dayKey);
  const { data: shifts } = useShifts();

  const hasShifts = (shifts?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => setDate((d) => addDays(d, -1))}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setDate((d) => addDays(d, 1))}>
            <ChevronRight />
          </Button>
          <span className="ml-2 text-sm font-medium capitalize">
            {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </span>
        </div>

        {canManage && hasShifts ? (
          <Button
            size="sm"
            onClick={() =>
              setTarget({
                resourceId: '',
                resourceName: '',
                shiftId: shifts?.[0]?.id ?? null,
                shiftName: shifts?.[0]?.name ?? '',
              })
            }
          >
            <CalendarPlus />
            Reservar turno
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !hasShifts ? (
        <EmptyState
          icon={CalendarPlus}
          title="Configure os turnos primeiro"
          description="Crie os turnos (manhã, tarde, noite) e os preços por espaço na aba Configuração."
        />
      ) : data?.resources.length ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b">
                <th className="w-56 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Espaço
                </th>
                {data.shifts.map((shift) => (
                  <th
                    key={shift.id}
                    className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {shift.name}
                    <span className="ml-1 font-normal normal-case">
                      {shift.startsAt}–{shift.endsAt}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.resources.map((resource) => (
                <tr key={resource.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium">{resource.name}</p>
                    <p className="text-xs text-muted-foreground">{resource.category?.name}</p>
                    {resource.daily ? (
                      <Badge variant="info" className="mt-1">
                        Diária — {resource.daily.professional.name}
                      </Badge>
                    ) : null}
                  </td>

                  {resource.shifts.map((cell) => (
                    <td key={cell.shiftId} className="px-3 py-2 align-top">
                      {cell.booking ? (
                        <button
                          type="button"
                          onClick={() => setDetail(cell.booking!)}
                          className="w-full rounded-lg border border-border/70 p-2 text-left transition-colors hover:bg-muted/60"
                          style={{
                            borderLeftWidth: 3,
                            borderLeftColor: cell.booking.professional.color,
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <UserAvatar
                              name={cell.booking.professional.name}
                              color={cell.booking.professional.color}
                              className="size-6"
                            />
                            <span className="min-w-0 flex-1 truncate text-xs font-medium">
                              {cell.booking.professional.name}
                            </span>
                          </span>
                          <span className="mt-1 flex items-center justify-between gap-1">
                            <span className="text-xs text-muted-foreground">
                              {currency(cell.booking.price)}
                            </span>
                            <PaymentStatusBadge status={cell.booking.paymentStatus} />
                          </span>
                        </button>
                      ) : canManage && !resource.daily ? (
                        <button
                          type="button"
                          onClick={() =>
                            setTarget({
                              resourceId: resource.id,
                              resourceName: resource.name,
                              shiftId: cell.shiftId,
                              shiftName:
                                data.shifts.find((s) => s.id === cell.shiftId)?.name ?? '',
                            })
                          }
                          className="flex h-[62px] w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                        >
                          <Plus className="mr-1 size-3.5" />
                          Livre
                        </button>
                      ) : (
                        <div className="flex h-[62px] items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
                          {resource.daily ? 'Diária' : 'Livre'}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState
          icon={CalendarPlus}
          title="Nenhum espaço locável"
          description="Marque um recurso como locável em Recursos para começar a alugar turnos."
        />
      )}

      <BookingDialog
        target={target}
        date={date}
        onClose={() => setTarget(null)}
      />

      <BookingDetail booking={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/* -------------------------------------------------- Detalhe da reserva */
function BookingDetail({ booking, onClose }: { booking: RentalBooking | null; onClose: () => void }) {
  const canManage = useAuthStore((s) => s.can('rentals:manage'));
  const { pay, update, remove } = useBookingMutations();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('PIX');
  const [paying, setPaying] = useState(false);

  if (!booking) return null;

  const open = Boolean(booking);
  const due = Number(booking.price) - Number(booking.paidAmount);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          onClose();
          setPaying(false);
        }
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{booking.resource.name}</DialogTitle>
          <DialogDescription>
            {booking.shift ? `${booking.shift.name} · ${booking.shift.startsAt}–${booking.shift.endsAt}` : 'Diária'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <UserAvatar
              name={booking.professional.name}
              color={booking.professional.color}
              className="size-10"
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{booking.professional.name}</p>
              <p className="text-xs text-muted-foreground">{booking.professional.phone ?? '—'}</p>
            </div>
            <PaymentStatusBadge status={booking.paymentStatus} />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Valor do turno</span>
            <span className="font-semibold">{currency(booking.price)}</span>
          </div>

          {canManage && due > 0.001 && booking.status !== 'CANCELED' ? (
            paying ? (
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="space-y-1.5">
                  <Label>Valor recebido</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount || due.toFixed(2)}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Forma de pagamento</Label>
                  <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
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
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    loading={pay.isPending}
                    onClick={async () => {
                      await pay
                        .mutateAsync({
                          id: booking.id,
                          amount: Number(amount || due),
                          paymentMethod: method,
                        })
                        .then(() => {
                          setPaying(false);
                          onClose();
                        })
                        .catch(() => undefined);
                    }}
                  >
                    Confirmar
                  </Button>
                  <Button variant="ghost" onClick={() => setPaying(false)}>
                    Voltar
                  </Button>
                </div>
              </div>
            ) : (
              <Button className="w-full" onClick={() => setPaying(true)}>
                <Wallet />
                Registrar pagamento ({currency(due)})
              </Button>
            )
          ) : null}

          {canManage && booking.status !== 'CANCELED' ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                loading={update.isPending}
                onClick={async () => {
                  await update
                    .mutateAsync({ id: booking.id, status: 'CANCELED' })
                    .then(onClose)
                    .catch(() => undefined);
                }}
              >
                Cancelar reserva
              </Button>
              {Number(booking.paidAmount) === 0 ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  loading={remove.isPending}
                  onClick={async () => {
                    await remove.mutateAsync(booking.id).then(onClose).catch(() => undefined);
                  }}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

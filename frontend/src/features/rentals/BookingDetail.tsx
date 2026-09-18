import { useState } from 'react';
import { Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useBookingMutations, type RentalBooking } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { PAYMENT_METHOD } from '@/config/labels';
import { currency, shortDate } from '@/lib/format';
import type { PaymentMethod } from '@/types';

/**
 * O turno alugado, por dentro: quem está nele, quanto custa, o que falta
 * receber e como encerrar.
 *
 * Mora em arquivo próprio porque as três visões de ocupação — dia, semana e
 * mês — abrem exatamente este mesmo cartão. Enquanto ele vivia dentro do quadro
 * do dia, semana e mês só poderiam mostrar o turno, nunca resolvê-lo.
 */
export function BookingDetail({
  booking,
  onClose,
}: {
  booking: RentalBooking | null;
  onClose: () => void;
}) {
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
            {/* A data entra aqui porque na semana e no mês o cartão abre longe
                da célula clicada — sem ela, não dá para saber de que dia é. */}
            {shortDate(booking.date)}
            {' · '}
            {booking.shift
              ? `${booking.shift.name} · ${booking.shift.startsAt}–${booking.shift.endsAt}`
              : 'Diária'}
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

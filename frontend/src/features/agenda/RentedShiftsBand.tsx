import { useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { KeyRound } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useBookings, type RentalBooking } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { currency } from '@/lib/format';

interface RentedShiftsBandProps {
  days: Date[];
  from: Date;
  to: Date;
}

/**
 * Quem aluga o espaço toca o próprio negócio: os atendimentos dela não
 * aparecem nesta agenda. O que a dona precisa enxergar é a **ocupação** — qual
 * espaço está alugado, para quem, em que turno e se já foi pago.
 */
export function RentedShiftsBand({ days, from, to }: RentedShiftsBandProps) {
  const hasModule = useAuthStore((s) => s.hasModule);
  const can = useAuthStore((s) => s.can);

  // Só faz sentido para quem aluga o espaço, não para quem o ocupa.
  const enabled = hasModule('rentals') && can('rentals:view');

  const { data } = useBookings(
    enabled ? { from: from.toISOString(), to: to.toISOString(), perPage: 200 } : {},
  );

  const byDay = useMemo(() => {
    const bookings = (data?.data ?? []).filter((booking) => booking.status !== 'CANCELED');
    return days.map((day) => ({
      day,
      bookings: bookings.filter((booking) => isSameDay(new Date(booking.date), day)),
    }));
  }, [data, days]);

  if (!enabled) return null;

  const total = byDay.reduce((sum, entry) => sum + entry.bookings.length, 0);
  if (total === 0) return null;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Espaços alugados no período</h2>
        <span className="text-xs text-muted-foreground">
          a agenda de quem aluga é dela — aqui fica a ocupação
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {byDay
          .filter((entry) => entry.bookings.length > 0)
          .map((entry) => (
            <div key={entry.day.toISOString()} className="space-y-1.5">
              <p className="text-xs font-medium capitalize text-muted-foreground">
                {format(entry.day, 'EEE, dd MMM', { locale: ptBR })}
              </p>
              {entry.bookings.map((booking) => (
                <BookingChip key={booking.id} booking={booking} />
              ))}
            </div>
          ))}
      </div>
    </Card>
  );
}

function BookingChip({ booking }: { booking: RentalBooking }) {
  const paid = booking.paymentStatus === 'PAID';

  return (
    <div
      className="rounded-md border border-l-4 bg-muted/40 px-2.5 py-1.5 text-xs"
      style={{ borderLeftColor: booking.professional.color }}
    >
      <p className="font-medium">{booking.professional.name}</p>
      <p className="text-muted-foreground">
        {booking.resource.name} · {booking.shift?.name ?? 'Diária'}
      </p>
      <p className={paid ? 'text-emerald-600' : 'text-amber-600'}>
        {currency(booking.price)} · {paid ? 'pago' : 'em aberto'}
      </p>
    </div>
  );
}

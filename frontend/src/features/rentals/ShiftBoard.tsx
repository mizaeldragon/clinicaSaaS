import { useState } from 'react';
import { CalendarPlus, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { UserAvatar } from '@/components/ui/primitives';
import { PaymentStatusBadge } from '@/components/StatusBadge';
import { useDayMap, useShifts, type RentalBooking } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { BookingDialog, type BookingTarget } from './BookingDialog';
import { BookingDetail } from './BookingDetail';
import { currency } from '@/lib/format';

/**
 * A ocupação de um dia: espaço por turno, com quem está em cada célula.
 *
 * A data vem de fora. Quem escolhe o dia é o seletor de período, que também
 * comanda a semana e o mês — três telas com uma barra de navegação só.
 */
export function ShiftBoard({ date }: { date: Date }) {
  const canManage = useAuthStore((s) => s.can('rentals:manage'));

  const [target, setTarget] = useState<BookingTarget | null>(null);
  const [detail, setDetail] = useState<RentalBooking | null>(null);

  const dayKey = date.toISOString();
  const { data, isLoading } = useDayMap(dayKey);
  const { data: shifts } = useShifts();

  const hasShifts = (shifts?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
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

import { useEffect, useState } from 'react';
import { Clock, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Label } from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useShiftMutations, useShiftPrices, useShifts } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { currency } from '@/lib/format';

export function ShiftSettings() {
  const canManage = useAuthStore((s) => s.can('rentals:manage'));
  const { data: shifts, isLoading } = useShifts();
  const { data: table } = useShiftPrices();
  const mutations = useShiftMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', startsAt: '08:00', endsAt: '12:00' });

  // Rascunho da tabela de preços: { resourceId: { shiftId: valor } }
  const [prices, setPrices] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    if (!table) return;
    const draft: Record<string, Record<string, string>> = {};
    for (const resource of table.resources) {
      draft[resource.id] = {};
      for (const entry of resource.shiftPrices) {
        draft[resource.id][entry.shiftId] = entry.price !== null ? String(entry.price) : '';
      }
    }
    setPrices(draft);
  }, [table]);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Turnos</CardTitle>
            <CardDescription>
              As faixas de horário que você vende — a profissional aluga o espaço por turno ou diária
            </CardDescription>
          </div>
          {canManage ? (
            <div className="flex gap-2">
              {(shifts?.length ?? 0) === 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  loading={mutations.seedDefaults.isPending}
                  onClick={() => mutations.seedDefaults.mutate()}
                >
                  <Sparkles />
                  Criar Manhã/Tarde/Noite
                </Button>
              ) : null}
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus />
                Novo turno
              </Button>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-2">
          {shifts?.length ? (
            shifts.map((shift) => (
              <div
                key={shift.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 p-3"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{shift.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {shift.startsAt} às {shift.endsAt}
                  </p>
                </div>
                <Badge variant="muted">{shift._count?.bookings ?? 0} reservas</Badge>
                {!shift.isActive ? <Badge variant="warning">Inativo</Badge> : null}
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() => mutations.remove.mutate(shift.id)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState
              icon={Clock}
              title="Nenhum turno configurado"
              description="Crie os turnos para começar a alugar o espaço por período."
            />
          )}
        </CardContent>
      </Card>

      {table && table.resources.length > 0 && table.shifts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Preço por espaço e turno</CardTitle>
            <CardDescription>
              Cada espaço pode ter um valor diferente em cada turno. Vazio usa a diária do recurso.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Espaço
                    </th>
                    {table.shifts.map((shift) => (
                      <th
                        key={shift.id}
                        className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {shift.name}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Diária
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {table.resources.map((resource) => (
                    <tr key={resource.id} className="border-b border-border/70 last:border-0">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{resource.name}</p>
                        <p className="text-xs text-muted-foreground">{resource.category?.name}</p>
                      </td>
                      {table.shifts.map((shift) => (
                        <td key={shift.id} className="px-2 py-2">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            className="h-9 w-24"
                            disabled={!canManage}
                            placeholder="—"
                            value={prices[resource.id]?.[shift.id] ?? ''}
                            onChange={(e) =>
                              setPrices((prev) => ({
                                ...prev,
                                [resource.id]: {
                                  ...(prev[resource.id] ?? {}),
                                  [shift.id]: e.target.value,
                                },
                              }))
                            }
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {resource.dailyRate ? currency(resource.dailyRate) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canManage ? (
              <Button
                loading={mutations.setPrices.isPending}
                onClick={async () => {
                  for (const [resourceId, byShift] of Object.entries(prices)) {
                    const entries = Object.entries(byShift)
                      .filter(([, value]) => value !== '')
                      .map(([shiftId, value]) => ({ shiftId, price: Number(value) }));

                    if (entries.length === 0) continue;
                    await mutations.setPrices
                      .mutateAsync({ resourceId, prices: entries })
                      .catch(() => undefined);
                  }
                }}
              >
                <Save />
                Salvar preços
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Novo turno</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await mutations.create
                .mutateAsync(form)
                .then(() => {
                  setDialogOpen(false);
                  setForm({ name: '', startsAt: '08:00', endsAt: '12:00' });
                })
                .catch(() => undefined);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="shiftName">Nome</Label>
              <Input
                id="shiftName"
                required
                placeholder="Manhã, Tarde, Noite..."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startsAt">Início</Label>
                <Input
                  id="startsAt"
                  type="time"
                  required
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endsAt">Fim</Label>
                <Input
                  id="endsAt"
                  type="time"
                  required
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={mutations.create.isPending}>
                Criar turno
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

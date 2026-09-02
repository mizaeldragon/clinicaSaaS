import { useEffect, useState } from 'react';
import { DoorOpen, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { PageHeader, StatCard } from '@/components/ui/data';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Checkbox, Label, Switch } from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResourceStatusBadge } from '@/components/StatusBadge';
import {
  useResourceCategories,
  useResourceMutations,
  useResourceStats,
  useResources,
} from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { RESOURCE_STATUS } from '@/config/labels';
import { currency } from '@/lib/format';
import type { Resource, ResourceStatus } from '@/types';

const EMPTY = {
  name: '',
  categoryId: '',
  description: '',
  status: 'AVAILABLE' as ResourceStatus,
  isRentable: false,
  hourlyRate: '',
  dailyRate: '',
  weeklyRate: '',
  monthlyRate: '',
};

export function ResourcesPage() {
  const canManage = useAuthStore((s) => s.can('resources:manage'));
  const hasRentals = useAuthStore((s) => s.hasModule('rentals'));

  const { data: resources, isLoading } = useResources({});
  const { data: categories } = useResourceCategories();
  const { data: stats } = useResourceStats();
  const mutations = useResourceMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState(EMPTY);

  const [categoryDialog, setCategoryDialog] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', isRoom: false });

  useEffect(() => {
    if (!dialogOpen) return;
    if (editing) {
      setForm({
        name: editing.name,
        categoryId: editing.categoryId ?? '',
        description: editing.description ?? '',
        status: editing.status,
        isRentable: editing.isRentable,
        hourlyRate: editing.hourlyRate ? String(editing.hourlyRate) : '',
        dailyRate: editing.dailyRate ? String(editing.dailyRate) : '',
        weeklyRate: editing.weeklyRate ? String(editing.weeklyRate) : '',
        monthlyRate: editing.monthlyRate ? String(editing.monthlyRate) : '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [dialogOpen, editing]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      name: form.name,
      categoryId: form.categoryId || null,
      description: form.description || null,
      status: form.status,
      isRentable: form.isRentable,
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
      dailyRate: form.dailyRate ? Number(form.dailyRate) : null,
      weeklyRate: form.weeklyRate ? Number(form.weeklyRate) : null,
      monthlyRate: form.monthlyRate ? Number(form.monthlyRate) : null,
    };

    const action = editing
      ? mutations.update.mutateAsync({ id: editing.id, ...payload })
      : mutations.create.mutateAsync(payload);

    await action.then(() => setDialogOpen(false)).catch(() => undefined);
  }

  const grouped = new Map<string, Resource[]>();
  for (const resource of resources?.data ?? []) {
    const key = resource.category?.name ?? 'Sem categoria';
    grouped.set(key, [...(grouped.get(key) ?? []), resource]);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Salas e Recursos"
        description="Mesas, cadeiras, salas, macas e equipamentos — genérico para qualquer estrutura"
        actions={
          canManage ? (
            <>
              <Button variant="outline" onClick={() => setCategoryDialog(true)}>
                <FolderPlus />
                Nova categoria
              </Button>
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus />
                Novo recurso
              </Button>
            </>
          ) : null
        }
      />

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total" value={stats.total} icon={DoorOpen} />
          <StatCard label="Disponíveis" value={stats.available} tone="success" />
          <StatCard label="Em uso" value={stats.inUse} tone="info" />
          <StatCard label="Em manutenção" value={stats.maintenance} icon={Wrench} tone="warning" />
        </div>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : grouped.size === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title="Nenhum recurso cadastrado"
          description="Cadastre salas, mesas ou equipamentos para controlar ocupação e evitar conflitos na agenda."
          action={
            canManage
              ? {
                  label: 'Cadastrar recurso',
                  onClick: () => {
                    setEditing(null);
                    setDialogOpen(true);
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {[...grouped.entries()].map(([category, items]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-base">{category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((resource) => (
                  <div
                    key={resource.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{resource.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {resource.isRentable
                          ? `Locável · ${resource.monthlyRate ? `${currency(resource.monthlyRate)}/mês` : 'valor a definir'}`
                          : 'Uso interno'}
                        {resource.rentals?.length ? ` · Alugado para ${resource.rentals[0].renterName}` : ''}
                      </p>
                    </div>

                    <ResourceStatusBadge status={resource.status} />

                    {canManage ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditing(resource);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil />
                            Editar
                          </DropdownMenuItem>
                          {(Object.keys(RESOURCE_STATUS) as ResourceStatus[])
                            .filter((status) => status !== resource.status)
                            .map((status) => (
                              <DropdownMenuItem
                                key={status}
                                onSelect={() =>
                                  mutations.changeStatus.mutate({ id: resource.id, status })
                                }
                              >
                                Marcar como {RESOURCE_STATUS[status].label.toLowerCase()}
                              </DropdownMenuItem>
                            ))}
                          <DropdownMenuItem
                            destructive
                            onSelect={() => mutations.remove.mutate(resource.id)}
                          >
                            <Trash2 />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ------------------------------------------------- Dialog recurso */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar recurso' : 'Novo recurso'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                required
                placeholder="Sala 01, Mesa 02, Maca 1..."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={form.categoryId || 'none'}
                  onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as ResourceStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESOURCE_STATUS).map(([value, entry]) => (
                      <SelectItem key={value} value={value}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {hasRentals ? (
              <>
                <label className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Disponível para aluguel</p>
                    <p className="text-xs text-muted-foreground">
                      Permite criar contratos de locação para este recurso.
                    </p>
                  </div>
                  <Switch
                    checked={form.isRentable}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, isRentable: checked }))}
                  />
                </label>

                {form.isRentable ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Valor por hora</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.hourlyRate}
                        onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor por dia</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.dailyRate}
                        onChange={(e) => setForm((f) => ({ ...f, dailyRate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor por semana</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.weeklyRate}
                        onChange={(e) => setForm((f) => ({ ...f, weeklyRate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor por mês</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.monthlyRate}
                        onChange={(e) => setForm((f) => ({ ...f, monthlyRate: e.target.value }))}
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={mutations.create.isPending || mutations.update.isPending}>
                {editing ? 'Salvar' : 'Criar recurso'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------ Dialog categoria */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Nova categoria de recurso</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await mutations.createCategory
                .mutateAsync(categoryForm)
                .then(() => {
                  setCategoryDialog(false);
                  setCategoryForm({ name: '', isRoom: false });
                })
                .catch(() => undefined);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="categoryName">Nome</Label>
              <Input
                id="categoryName"
                required
                placeholder="Salas, Mesas, Cadeiras, Macas..."
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={categoryForm.isRoom}
                onCheckedChange={(checked) =>
                  setCategoryForm((f) => ({ ...f, isRoom: Boolean(checked) }))
                }
              />
              Tratar como sala na agenda
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCategoryDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={mutations.createCategory.isPending}>
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

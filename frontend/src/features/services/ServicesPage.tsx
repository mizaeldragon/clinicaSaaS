import { useMemo, useState } from 'react';
import { Clock, FolderPlus, MoreHorizontal, Pencil, Plus, Scissors, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/data';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Label } from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useServiceCategories, useServiceMutations, useServices } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { currency } from '@/lib/format';
import { ServiceDialog } from './ServiceDialog';
import type { Service } from '@/types';

export function ServicesPage() {
  const canManage = useAuthStore((s) => s.can('services:manage'));
  const { data: services, isLoading } = useServices({});
  const { data: categories } = useServiceCategories();
  const { removeCategory, createCategory, remove } = useServiceMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('#7C3AED');

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; color: string; id: string | null; items: Service[] }>();

    for (const service of services?.data ?? []) {
      const key = service.categoryId ?? 'none';
      const entry = map.get(key) ?? {
        id: service.categoryId,
        name: service.category?.name ?? 'Sem categoria',
        color: service.category?.color ?? '#94A3B8',
        items: [],
      };
      entry.items.push(service);
      map.set(key, entry);
    }

    // Categorias vazias também aparecem, para o usuário conseguir preenchê-las.
    for (const category of categories ?? []) {
      if (!map.has(category.id)) {
        map.set(category.id, { id: category.id, name: category.name, color: category.color, items: [] });
      }
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [services, categories]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Serviços"
        description="Catálogo com categorias, preços, durações e comissões"
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
                Novo serviço
              </Button>
            </>
          ) : null
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="Nenhum serviço cadastrado"
          description="Crie categorias e serviços para montar sua agenda e calcular valores automaticamente."
          action={
            canManage
              ? {
                  label: 'Criar primeiro serviço',
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
          {grouped.map((group) => (
            <Card key={group.id ?? 'none'}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ backgroundColor: group.color }} />
                  <CardTitle className="text-base">{group.name}</CardTitle>
                  <Badge variant="muted">{group.items.length}</Badge>
                </div>
                {canManage && group.id ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem destructive onSelect={() => removeCategory.mutate(group.id!)}>
                        <Trash2 />
                        Remover categoria
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-1.5">
                {group.items.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum serviço nesta categoria
                  </p>
                ) : (
                  group.items.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center gap-3 rounded-lg border border-border/70 p-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{service.name}</p>
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {service.durationMinutes} min
                          {service.professionals?.length
                            ? ` · ${service.professionals.length} profissional(is)`
                            : ''}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold">{currency(service.price)}</span>
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
                                setEditing(service);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem destructive onSelect={() => remove.mutate(service.id)}>
                              <Trash2 />
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ServiceDialog open={dialogOpen} onOpenChange={setDialogOpen} service={editing} />

      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await createCategory
                .mutateAsync({ name: categoryName, color: categoryColor })
                .then(() => {
                  setCategoryDialog(false);
                  setCategoryName('');
                })
                .catch(() => undefined);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="categoryName">Nome</Label>
              <Input
                id="categoryName"
                required
                placeholder="Unhas, Cabelo, Estética..."
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="categoryColor">Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  id="categoryColor"
                  type="color"
                  className="h-10 w-16 cursor-pointer rounded-lg border"
                  value={categoryColor}
                  onChange={(e) => setCategoryColor(e.target.value)}
                />
                <Input value={categoryColor} onChange={(e) => setCategoryColor(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCategoryDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={createCategory.isPending}>
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

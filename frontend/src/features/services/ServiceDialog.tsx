import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Checkbox, Label } from '@/components/ui/primitives';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfessionals, useServiceCategories, useServiceMutations } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import type { Service } from '@/types';

const EMPTY = {
  name: '',
  description: '',
  categoryId: '',
  price: '',
  durationMinutes: '60',
  commissionType: 'NONE',
  commissionValue: '',
};

export function ServiceDialog({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null;
}) {
  const { create, update } = useServiceMutations();
  const { data: categories } = useServiceCategories();
  const { data: professionals } = useProfessionals({ isActive: 'true' });
  const hasProfessionals = useAuthStore((s) => s.hasModule('professionals'));
  const hasCommissions = useAuthStore((s) => s.hasModule('commissions'));

  const [form, setForm] = useState(EMPTY);
  const [professionalIds, setProfessionalIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (service) {
      setForm({
        name: service.name,
        description: service.description ?? '',
        categoryId: service.categoryId ?? '',
        price: String(service.price),
        durationMinutes: String(service.durationMinutes),
        commissionType: service.commissionType ?? 'NONE',
        commissionValue: service.commissionValue ? String(service.commissionValue) : '',
      });
      setProfessionalIds(service.professionals?.map((p) => p.professionalId) ?? []);
    } else {
      setForm(EMPTY);
      setProfessionalIds([]);
    }
  }, [open, service]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload = {
      name: form.name,
      description: form.description || undefined,
      categoryId: form.categoryId || null,
      price: Number(form.price),
      durationMinutes: Number(form.durationMinutes),
      commissionType: form.commissionType === 'NONE' ? null : form.commissionType,
      commissionValue:
        form.commissionType === 'NONE' || !form.commissionValue ? null : Number(form.commissionValue),
      ...(hasProfessionals ? { professionalIds } : {}),
    };

    const action = service
      ? update.mutateAsync({ id: service.id, ...payload })
      : create.mutateAsync(payload);

    await action.then(() => onOpenChange(false)).catch(() => undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{service ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoryId || 'none'} onValueChange={(v) => set('categoryId', v === 'none' ? '' : v)}>
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
              <Label htmlFor="price">Valor (R$) *</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                required
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="duration">Duração (min) *</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                step={5}
                required
                value={form.durationMinutes}
                onChange={(e) => set('durationMinutes', e.target.value)}
              />
            </div>
          </div>

          {hasCommissions ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de comissão</Label>
                <Select value={form.commissionType} onValueChange={(v) => set('commissionType', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Usar padrão do profissional</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentual (%)</SelectItem>
                    <SelectItem value="FIXED">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="commissionValue">
                  {form.commissionType === 'FIXED' ? 'Valor (R$)' : 'Percentual (%)'}
                </Label>
                <Input
                  id="commissionValue"
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={form.commissionType === 'NONE'}
                  value={form.commissionValue}
                  onChange={(e) => set('commissionValue', e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {hasProfessionals && professionals?.data.length ? (
            <div className="space-y-2">
              <Label>Profissionais habilitados</Label>
              <div className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
                {professionals.data.map((professional) => (
                  <label
                    key={professional.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={professionalIds.includes(professional.id)}
                      onCheckedChange={(checked) =>
                        setProfessionalIds((ids) =>
                          checked ? [...ids, professional.id] : ids.filter((id) => id !== professional.id),
                        )
                      }
                    />
                    {professional.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {service ? 'Salvar' : 'Criar serviço'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

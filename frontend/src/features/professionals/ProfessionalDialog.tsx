import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox, Label } from '@/components/ui/primitives';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfessionalMutations, useServices } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import type { Professional } from '@/types';

const COLORS = ['#7C3AED', '#EC4899', '#0EA5E9', '#14B8A6', '#F59E0B', '#EF4444', '#8B5CF6', '#22C55E'];

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  bio: '',
  color: COLORS[0],
  commissionType: 'NONE',
  commissionValue: '',
};

export function ProfessionalDialog({
  open,
  onOpenChange,
  professional,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional?: Professional | null;
}) {
  const { create, update } = useProfessionalMutations();
  const { data: services } = useServices({ isActive: 'true' });
  const hasCommissions = useAuthStore((s) => s.hasModule('commissions'));

  const [form, setForm] = useState(EMPTY);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (professional) {
      setForm({
        name: professional.name,
        email: professional.email ?? '',
        phone: professional.phone ?? '',
        bio: professional.bio ?? '',
        color: professional.color,
        commissionType: professional.commissionType ?? 'NONE',
        commissionValue: professional.commissionValue ? String(professional.commissionValue) : '',
      });
      setSpecialties(professional.specialties ?? []);
      setServiceIds(professional.services?.map((s) => s.serviceId) ?? []);
    } else {
      setForm(EMPTY);
      setSpecialties([]);
      setServiceIds([]);
    }
    setSpecialtyInput('');
  }, [open, professional]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload = {
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      bio: form.bio || undefined,
      color: form.color,
      specialties,
      serviceIds,
      commissionType: form.commissionType === 'NONE' ? null : form.commissionType,
      commissionValue:
        form.commissionType === 'NONE' || !form.commissionValue ? null : Number(form.commissionValue),
    };

    const action = professional
      ? update.mutateAsync({ id: professional.id, ...payload })
      : create.mutateAsync(payload);

    await action.then(() => onOpenChange(false)).catch(() => undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{professional ? 'Editar profissional' : 'Novo profissional'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor na agenda</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => set('color', color)}
                  className="size-8 rounded-full ring-offset-2 transition-all"
                  style={{
                    backgroundColor: color,
                    boxShadow: form.color === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined,
                  }}
                  aria-label={`Cor ${color}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Especialidades</Label>
            <div className="flex flex-wrap gap-1.5">
              {specialties.map((specialty) => (
                <Badge key={specialty} variant="secondary" className="gap-1 py-1">
                  {specialty}
                  <button
                    type="button"
                    onClick={() => setSpecialties((list) => list.filter((s) => s !== specialty))}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Ex.: Manicure, Estética facial"
                value={specialtyInput}
                onChange={(e) => setSpecialtyInput(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (specialtyInput.trim()) {
                      setSpecialties((list) => [...new Set([...list, specialtyInput.trim()])]);
                      setSpecialtyInput('');
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (specialtyInput.trim()) {
                    setSpecialties((list) => [...new Set([...list, specialtyInput.trim()])]);
                    setSpecialtyInput('');
                  }
                }}
              >
                Adicionar
              </Button>
            </div>
          </div>

          {hasCommissions ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Comissão padrão</Label>
                <Select value={form.commissionType} onValueChange={(v) => set('commissionType', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sem comissão</SelectItem>
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

          {services?.data.length ? (
            <div className="space-y-2">
              <Label>Serviços que realiza</Label>
              <div className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
                {services.data.map((service) => (
                  <label
                    key={service.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={serviceIds.includes(service.id)}
                      onCheckedChange={(checked) =>
                        setServiceIds((ids) =>
                          checked ? [...ids, service.id] : ids.filter((id) => id !== service.id),
                        )
                      }
                    />
                    <span className="truncate">{service.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="bio">Descrição</Label>
            <Textarea id="bio" rows={2} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {professional ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

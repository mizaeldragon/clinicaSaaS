import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/field';
import { Label } from '@/components/ui/primitives';
import { useCustomerMutations } from '@/api/queries';
import type { Customer } from '@/types';

const EMPTY = {
  name: '',
  phone: '',
  whatsapp: '',
  email: '',
  birthDate: '',
  document: '',
  notes: '',
};

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
}) {
  const { create, update } = useCustomerMutations();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (customer) {
      setForm({
        name: customer.name,
        phone: customer.phone ?? '',
        whatsapp: customer.whatsapp ?? '',
        email: customer.email ?? '',
        birthDate: customer.birthDate ? customer.birthDate.slice(0, 10) : '',
        document: customer.document ?? '',
        notes: customer.notes ?? '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, customer]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload = {
      name: form.name,
      phone: form.phone || undefined,
      whatsapp: form.whatsapp || undefined,
      email: form.email || undefined,
      birthDate: form.birthDate ? new Date(`${form.birthDate}T12:00:00`).toISOString() : undefined,
      document: form.document || undefined,
      notes: form.notes || undefined,
    };

    const action = customer
      ? update.mutateAsync({ id: customer.id, ...payload } as never)
      : create.mutateAsync(payload as never);

    await action.then(() => onOpenChange(false)).catch(() => undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
          <DialogDescription>
            Os dados alimentam a timeline de atendimentos e o histórico financeiro.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <PhoneInput id="phone" value={form.phone} onChange={(v) => set('phone', v)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <PhoneInput id="whatsapp" value={form.whatsapp} onChange={(v) => set('whatsapp', v)} />
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="birthDate">Data de nascimento</Label>
              <Input
                id="birthDate"
                type="date"
                value={form.birthDate}
                onChange={(e) => set('birthDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="document">CPF (opcional)</Label>
              <Input
                id="document"
                value={form.document}
                onChange={(e) => set('document', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Alergias, preferências, histórico relevante..."
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {customer ? 'Salvar alterações' : 'Cadastrar cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from 'react';
import { Banknote, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/data';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Checkbox, Label, Switch } from '@/components/ui/primitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAdminMutations, useAdminPlans } from '@/api/queries';
import { currency } from '@/lib/format';
import { slugifyLocal } from './slugify';
import { ALL_MODULES, MODULE_HINTS, MODULE_LABELS, moduleLabel } from '@/lib/modules';
import type { ModuleKey } from '@/types';

const EMPTY = {
  name: '',
  slug: '',
  description: '',
  price: '',
  trialDays: '14',
  maxUsers: '',
  maxProfessionals: '',
  maxAppointmentsMonth: '',
  isActive: true,
  isPublic: true,
  sortOrder: '0',
};

export function AdminPlansPage() {
  const { data: plans, isLoading } = useAdminPlans();
  const mutations = useAdminMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [modules, setModules] = useState<ModuleKey[]>(['appointments', 'customers', 'services']);

  useEffect(() => {
    if (dialogOpen || !editingId) return;
    setEditingId(null);
  }, [dialogOpen, editingId]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setModules(['appointments', 'customers', 'services']);
    setDialogOpen(true);
  }

  function openEdit(plan: Record<string, unknown>) {
    setEditingId(plan.id as string);
    setForm({
      name: plan.name as string,
      slug: plan.slug as string,
      description: (plan.description as string) ?? '',
      price: String(plan.price),
      trialDays: String(plan.trialDays),
      maxUsers: plan.maxUsers ? String(plan.maxUsers) : '',
      maxProfessionals: plan.maxProfessionals ? String(plan.maxProfessionals) : '',
      maxAppointmentsMonth: plan.maxAppointmentsMonth ? String(plan.maxAppointmentsMonth) : '',
      isActive: plan.isActive as boolean,
      isPublic: plan.isPublic as boolean,
      sortOrder: String(plan.sortOrder),
    });
    setModules(plan.modules as ModuleKey[]);
    setDialogOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      name: form.name,
      slug: form.slug || slugifyLocal(form.name),
      description: form.description || null,
      price: Number(form.price),
      trialDays: Number(form.trialDays),
      maxUsers: form.maxUsers ? Number(form.maxUsers) : null,
      maxProfessionals: form.maxProfessionals ? Number(form.maxProfessionals) : null,
      maxAppointmentsMonth: form.maxAppointmentsMonth ? Number(form.maxAppointmentsMonth) : null,
      modules,
      isActive: form.isActive,
      isPublic: form.isPublic,
      sortOrder: Number(form.sortOrder),
    };

    const action = editingId
      ? mutations.updatePlan.mutateAsync({ id: editingId, ...payload })
      : mutations.createPlan.mutateAsync(payload);

    await action.then(() => setDialogOpen(false)).catch(() => undefined);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Planos"
        description="Preços, limites e módulos disponíveis em cada plano do SaaS"
        actions={
          <Button onClick={openCreate}>
            <Plus />
            Novo plano
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : plans?.length ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.isActive ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{plan.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{plan.slug}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(plan)}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      onClick={() => mutations.removePlan.mutate(plan.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-semibold">
                  {currency(plan.price)}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {plan.isActive ? <Badge variant="success">Ativo</Badge> : <Badge variant="muted">Inativo</Badge>}
                  {plan.isPublic ? <Badge variant="info">Público</Badge> : <Badge variant="muted">Privado</Badge>}
                  <Badge variant="secondary">{plan._count?.subscriptions ?? 0} empresa(s)</Badge>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Usuários: {plan.maxUsers ?? 'ilimitado'}</p>
                  <p>Profissionais: {plan.maxProfessionals ?? 'ilimitado'}</p>
                  <p>Agendamentos/mês: {plan.maxAppointmentsMonth ?? 'ilimitado'}</p>
                  <p>Teste: {plan.trialDays} dias</p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {(plan.modules as ModuleKey[]).map((module) => (
                    <span
                      key={module}
                      className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {moduleLabel(module)}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Banknote}
          title="Nenhum plano cadastrado"
          action={{ label: 'Criar plano', onClick: openCreate }}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar plano' : 'Novo plano'}</DialogTitle>
            <DialogDescription>
              Os módulos marcados definem o que as empresas desse plano podem ativar.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      name: e.target.value,
                      slug: editingId ? f.slug : slugifyLocal(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Identificador (slug) *</Label>
                <Input
                  required
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Preço (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Dias de teste</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.trialDays}
                  onChange={(e) => setForm((f) => ({ ...f, trialDays: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Limite de usuários</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Ilimitado"
                  value={form.maxUsers}
                  onChange={(e) => setForm((f) => ({ ...f, maxUsers: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Limite de profissionais</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Ilimitado"
                  value={form.maxProfessionals}
                  onChange={(e) => setForm((f) => ({ ...f, maxProfessionals: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Agendamentos/mês</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Ilimitado"
                  value={form.maxAppointmentsMonth}
                  onChange={(e) => setForm((f) => ({ ...f, maxAppointmentsMonth: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Módulos incluídos *</Label>
              <div className="grid gap-1 rounded-lg border p-2 sm:grid-cols-2">
                {ALL_MODULES.map((module) => (
                  <label
                    key={module}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={modules.includes(module)}
                      onCheckedChange={(checked) =>
                        setModules((prev) =>
                          checked ? [...prev, module] : prev.filter((m) => m !== module),
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{MODULE_LABELS[module]}</span>
                      <span className="block text-xs text-muted-foreground">
                        {MODULE_HINTS[module]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                />
                Plano ativo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.isPublic}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isPublic: checked }))}
                />
                Visível no cadastro público
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={mutations.createPlan.isPending || mutations.updatePlan.isPending}
                disabled={modules.length === 0}
              >
                <Check />
                {editingId ? 'Salvar plano' : 'Criar plano'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

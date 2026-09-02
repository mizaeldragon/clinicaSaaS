import { useState } from 'react';
import { Ban, Building2, CalendarPlus, CheckCircle2, MoreHorizontal, Plus, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader, Pagination, TBody, TD, TH, THead, TR, Table } from '@/components/ui/data';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CompanyStatusBadge } from '@/components/StatusBadge';
import { useAdminCompanies, useAdminMutations, useAdminPlans } from '@/api/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { shortDate } from '@/lib/format';

export function AdminCompaniesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    planSlug: 'pro',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    trialDays: '14',
  });

  const debounced = useDebouncedValue(search, 350);
  const { data, isLoading } = useAdminCompanies({
    page,
    perPage: 20,
    search: debounced,
    ...(status !== 'all' ? { status } : {}),
  });
  const { data: plans } = useAdminPlans();
  const mutations = useAdminMutations();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Empresas"
        description="Todas as empresas da plataforma"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus />
            Nova empresa
          </Button>
        }
      />

      <Card className="flex flex-wrap gap-3 p-4">
        <Input
          icon={<Search />}
          placeholder="Buscar empresa..."
          className="max-w-xs"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="max-w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ACTIVE">Ativas</SelectItem>
            <SelectItem value="TRIALING">Em teste</SelectItem>
            <SelectItem value="SUSPENDED">Bloqueadas</SelectItem>
            <SelectItem value="CANCELED">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64" />
          </div>
        ) : data?.data.length ? (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Empresa</TH>
                  <TH>Plano</TH>
                  <TH>Uso</TH>
                  <TH>Criada</TH>
                  <TH>Status</TH>
                  <TH className="w-12" />
                </TR>
              </THead>
              <TBody>
                {data.data.map((company) => (
                  <TR key={company.id}>
                    <TD>
                      <p className="text-sm font-medium">{company.name}</p>
                      <p className="text-xs text-muted-foreground">{company.slug}</p>
                    </TD>
                    <TD>
                      <Badge variant="secondary">{company.subscription?.plan?.name ?? '—'}</Badge>
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {company._count.users} usuários · {company._count.customers} clientes ·{' '}
                      {company._count.appointments} agend.
                    </TD>
                    <TD className="text-sm text-muted-foreground">{shortDate(company.createdAt)}</TD>
                    <TD>
                      <CompanyStatusBadge status={company.status} />
                    </TD>
                    <TD>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Assinatura</DropdownMenuLabel>
                          {plans?.map((plan) => (
                            <DropdownMenuItem
                              key={plan.id}
                              onSelect={() =>
                                mutations.setPlan.mutate({ id: company.id, planSlug: plan.slug })
                              }
                            >
                              Mudar para {plan.name}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => mutations.extendTrial.mutate({ id: company.id, days: 14 })}
                          >
                            <CalendarPlus />
                            Estender teste (14 dias)
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {company.status !== 'SUSPENDED' ? (
                            <DropdownMenuItem
                              destructive
                              onSelect={() =>
                                mutations.setStatus.mutate({ id: company.id, status: 'SUSPENDED' })
                              }
                            >
                              <Ban />
                              Bloquear empresa
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() =>
                                mutations.setStatus.mutate({ id: company.id, status: 'ACTIVE' })
                              }
                            >
                              <CheckCircle2 />
                              Reativar empresa
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="px-4">
              <Pagination
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                total={data.meta.total}
                onChange={setPage}
              />
            </div>
          </>
        ) : (
          <EmptyState icon={Building2} title="Nenhuma empresa encontrada" />
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova empresa</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await mutations.createCompany
                .mutateAsync({ ...form, trialDays: Number(form.trialDays) })
                .then(() => {
                  setDialogOpen(false);
                  setForm({
                    name: '',
                    planSlug: 'pro',
                    adminName: '',
                    adminEmail: '',
                    adminPassword: '',
                    trialDays: '14',
                  });
                })
                .catch(() => undefined);
            }}
          >
            <div className="space-y-1.5">
              <Label>Nome da empresa</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Plano</Label>
                <Select value={form.planSlug} onValueChange={(v) => setForm((f) => ({ ...f, planSlug: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plans?.map((plan) => (
                      <SelectItem key={plan.id} value={plan.slug}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Dias de teste</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={form.trialDays}
                  onChange={(e) => setForm((f) => ({ ...f, trialDays: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nome do administrador</Label>
              <Input
                required
                value={form.adminName}
                onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  required
                  value={form.adminEmail}
                  onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={form.adminPassword}
                  onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={mutations.createCompany.isPending}>
                Criar empresa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

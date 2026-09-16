import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Copy, ExternalLink, Plus, Save, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { PageHeader, TBody, TD, TH, THead, TR, Table } from '@/components/ui/data';
import { EmptyState, PageLoader } from '@/components/ui/feedback';
import {
  Label,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives';
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
import { MODULE_ICONS } from '@/config/navigation';
import { COMPANY_TYPE, USER_ROLE } from '@/config/labels';
import {
  useAuditLogs,
  useCompany,
  useCompanyModules,
  useCompanyMutations,
  usePlans,
  useSubscription,
  useUserMutations,
  useProfessionals,
  useUsers,
} from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';
import { applyBrandColor } from '@/lib/utils';
import { ImageUpload } from '@/components/ImageUpload';
import { moduleLabel } from '@/lib/modules';
import { HolidaysCard } from './HolidaysCard';
import { BillingCard } from './BillingCard';
import { ChangePasswordCard, SessionsCard } from './ChangePasswordCard';
import { TwoFactorCard } from './TwoFactorCard';
import { currency, dateTimeLabel, weekdayName } from '@/lib/format';
import type { UserRole } from '@/types';

const DEFAULT_HOURS = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  opensAt: '09:00',
  closesAt: '19:00',
  isClosed: weekday === 0,
}));

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'empresa';

  const { user, refreshContext, logoutAll } = useAuthStore();
  const isAdmin = user?.role === 'COMPANY_ADMIN';

  const { data: company, isLoading } = useCompany();
  const { data: modules } = useCompanyModules();
  const { data: users } = useUsers({ perPage: 50 });
  const { data: professionals } = useProfessionals({ isActive: 'true' });
  const { data: subscription } = useSubscription();
  const { data: plans } = usePlans();
  const { data: auditLogs } = useAuditLogs({ perPage: 30 });

  const companyMutations = useCompanyMutations();
  const userMutations = useUserMutations();

  const [form, setForm] = useState({
    name: '',
    type: 'OTHER',
    document: '',
    email: '',
    phone: '',
    whatsapp: '',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    primaryColor: '#7C3AED',
    logoUrl: null as string | null,
  });
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [publicSettings, setPublicSettings] = useState({
    publicBookingEnabled: false,
    publicRequiresApproval: false,
    publicDescription: '',
  });

  const [userDialog, setUserDialog] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'RECEPTIONIST' as UserRole,
    professionalId: '',
  });

  // Profissionais que ainda não têm login. Sem esse vínculo o acesso não sabe
  // de quem é a agenda — e uma locatária cairia na carteira da casa.
  const linkable = (professionals?.data ?? []).filter(
    (professional) => !professional.user,
  );

  useEffect(() => {
    if (!company) return;
    setForm({
      name: company.name ?? '',
      type: company.type ?? 'OTHER',
      document: company.document ?? '',
      email: company.email ?? '',
      phone: company.phone ?? '',
      whatsapp: company.whatsapp ?? '',
      addressStreet: company.addressStreet ?? '',
      addressCity: company.addressCity ?? '',
      addressState: company.addressState ?? '',
      primaryColor: company.primaryColor ?? '#7C3AED',
      logoUrl: company.logoUrl ?? null,
    });

    setPublicSettings({
      publicBookingEnabled: Boolean(company.publicBookingEnabled),
      publicRequiresApproval: Boolean(company.publicRequiresApproval),
      publicDescription: company.publicDescription ?? '',
    });

    if (company.businessHours?.length) {
      const map = new Map(
        (company.businessHours as { weekday: number; opensAt: string; closesAt: string; isClosed: boolean }[]).map(
          (h) => [h.weekday, h],
        ),
      );
      setHours(DEFAULT_HOURS.map((base) => ({ ...base, ...(map.get(base.weekday) ?? {}) })));
    }
  }, [company]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configurações"
        description="Dados da empresa, módulos, equipe e assinatura"
      />

      <Tabs value={tab} onValueChange={(value) => setSearchParams({ tab: value })}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="modulos">Módulos</TabsTrigger>
          {isAdmin ? <TabsTrigger value="usuarios">Usuários</TabsTrigger> : null}
          <TabsTrigger value="plano">Plano e cobrança</TabsTrigger>
          <TabsTrigger value="conta">Minha conta</TabsTrigger>
          {isAdmin ? <TabsTrigger value="auditoria">Auditoria</TabsTrigger> : null}
        </TabsList>

        {/* ------------------------------------------------------- Empresa */}
        <TabsContent value="conta" className="space-y-4">
          {/* Primeiro o segundo fator: é o que mais muda o risco da conta. */}
          <TwoFactorCard />
          <ChangePasswordCard />
          <SessionsCard onLogoutAll={logoutAll} />
        </TabsContent>

        <TabsContent value="empresa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados da empresa</CardTitle>
              <CardDescription>Identidade visual e informações de contato</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de negócio</Label>
                  <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(COMPANY_TYPE).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>CPF / CNPJ</Label>
                  <Input
                    value={form.document}
                    placeholder="Só números"
                    onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usado para emitir a cobrança da mensalidade
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <PhoneInput
                    value={form.phone}
                    onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp</Label>
                  <PhoneInput
                    value={form.whatsapp}
                    onChange={(v) => setForm((f) => ({ ...f, whatsapp: v }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input
                    value={form.addressStreet}
                    onChange={(e) => setForm((f) => ({ ...f, addressStreet: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cidade / UF</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.addressCity}
                      onChange={(e) => setForm((f) => ({ ...f, addressCity: e.target.value }))}
                    />
                    <Input
                      className="w-16"
                      maxLength={2}
                      value={form.addressState}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, addressState: e.target.value.toUpperCase() }))
                      }
                    />
                  </div>
                </div>
              </div>

              <ImageUpload
                label="Logo"
                value={form.logoUrl}
                onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
                hint="Aparece no painel e na página pública de agendamento. JPG, PNG ou WEBP, até 4 MB."
              />

              <div className="space-y-1.5">
                <Label>Cor principal</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="h-10 w-16 cursor-pointer rounded-lg border"
                    value={form.primaryColor}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, primaryColor: e.target.value }));
                      applyBrandColor(e.target.value);
                    }}
                  />
                  <Input
                    className="max-w-[140px]"
                    value={form.primaryColor}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, primaryColor: e.target.value }));
                      // Quem digita o código da cor vê o mesmo que quem usa o
                      // seletor. Hexadecimal pela metade é ignorado lá dentro.
                      applyBrandColor(e.target.value);
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    A cor é aplicada em todo o painel (base para white-label).
                  </span>
                </div>
              </div>

              <Button
                loading={companyMutations.update.isPending}
                onClick={async () => {
                  await companyMutations.update.mutateAsync(form).catch(() => undefined);
                  await refreshContext().catch(() => undefined);
                }}
              >
                <Save />
                Salvar alterações
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Link público de agendamento</CardTitle>
              <CardDescription>
                Uma página para suas clientes marcarem horário sozinhas — com você e com as
                profissionais que alugam o espaço
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Ativar página pública</p>
                  <p className="text-xs text-muted-foreground">
                    Enquanto estiver desligado, o link responde como indisponível.
                  </p>
                </div>
                <Switch
                  checked={publicSettings.publicBookingEnabled}
                  disabled={!isAdmin}
                  onCheckedChange={(checked) =>
                    setPublicSettings((p) => ({ ...p, publicBookingEnabled: checked }))
                  }
                />
              </label>

              <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Exigir sua confirmação</p>
                  <p className="text-xs text-muted-foreground">
                    O agendamento entra como pendente até você confirmar.
                  </p>
                </div>
                <Switch
                  checked={publicSettings.publicRequiresApproval}
                  disabled={!isAdmin}
                  onCheckedChange={(checked) =>
                    setPublicSettings((p) => ({ ...p, publicRequiresApproval: checked }))
                  }
                />
              </label>

              <div className="space-y-1.5">
                <Label>Apresentação do espaço</Label>
                <Textarea
                  rows={3}
                  maxLength={600}
                  placeholder="Um espaço planejado para profissionais da beleza..."
                  value={publicSettings.publicDescription}
                  onChange={(e) =>
                    setPublicSettings((p) => ({ ...p, publicDescription: e.target.value }))
                  }
                />
              </div>

              {company?.slug ? (
                <div className="space-y-1.5">
                  <Label>Endereço do link</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={`${window.location.origin}/e/${company.slug}`} />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(`${window.location.origin}/e/${company.slug}`)
                          .then(() => toast.success('Link copiado'))
                          .catch(() => toast.error('Não foi possível copiar'));
                      }}
                    >
                      <Copy />
                      Copiar
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <a href={`/e/${company.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink />
                        Abrir
                      </a>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Compartilhe na bio do Instagram ou no WhatsApp.
                  </p>
                </div>
              ) : null}

              {isAdmin ? (
                <Button
                  loading={companyMutations.update.isPending}
                  onClick={async () => {
                    await companyMutations.update
                      .mutateAsync({
                        ...publicSettings,
                        publicDescription: publicSettings.publicDescription || null,
                      })
                      .catch(() => undefined);
                    await refreshContext().catch(() => undefined);
                  }}
                >
                  <Save />
                  Salvar página pública
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Horário de funcionamento</CardTitle>
              <CardDescription>
                Agendamentos fora deste horário são bloqueados automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {hours.map((hour) => (
                <div
                  key={hour.weekday}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 p-3"
                >
                  <div className="flex w-32 items-center gap-2">
                    <Switch
                      checked={!hour.isClosed}
                      onCheckedChange={(checked) =>
                        setHours((prev) =>
                          prev.map((h) =>
                            h.weekday === hour.weekday ? { ...h, isClosed: !checked } : h,
                          ),
                        )
                      }
                    />
                    <span className="text-sm font-medium">{weekdayName(hour.weekday)}</span>
                  </div>
                  {hour.isClosed ? (
                    <span className="text-sm text-muted-foreground">Fechado</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        className="h-9 w-28"
                        value={hour.opensAt}
                        onChange={(e) =>
                          setHours((prev) =>
                            prev.map((h) =>
                              h.weekday === hour.weekday ? { ...h, opensAt: e.target.value } : h,
                            ),
                          )
                        }
                      />
                      <span className="text-muted-foreground">até</span>
                      <Input
                        type="time"
                        className="h-9 w-28"
                        value={hour.closesAt}
                        onChange={(e) =>
                          setHours((prev) =>
                            prev.map((h) =>
                              h.weekday === hour.weekday ? { ...h, closesAt: e.target.value } : h,
                            ),
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
              <Button
                loading={companyMutations.setBusinessHours.isPending}
                onClick={() => companyMutations.setBusinessHours.mutate(hours)}
              >
                <Save />
                Salvar horários
              </Button>
            </CardContent>
          </Card>

          <HolidaysCard canManage={isAdmin} />
        </TabsContent>

        {/* -------------------------------------------------------- Módulos */}
        <TabsContent value="modulos">
          <Card>
            <CardHeader>
              <CardTitle>Módulos do sistema</CardTitle>
              <CardDescription>
                Ative apenas o que sua empresa usa — o menu e as telas se adaptam automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {modules?.map((module) => {
                const Icon = MODULE_ICONS[module.module];
                return (
                  <div
                    key={module.module}
                    className={`flex items-start gap-3 rounded-xl border p-4 transition-all ${
                      module.enabled ? 'border-primary/40 bg-primary/5' : 'border-border'
                    } ${!module.availableInPlan ? 'opacity-60' : ''}`}
                  >
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                        module.enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{module.label}</p>
                        {module.required ? <Badge variant="muted">Essencial</Badge> : null}
                        {!module.availableInPlan ? <Badge variant="warning">Upgrade</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{module.description}</p>
                    </div>
                    <Switch
                      checked={module.enabled}
                      disabled={module.required || !module.availableInPlan || !isAdmin}
                      onCheckedChange={async (checked) => {
                        await companyMutations.toggleModule
                          .mutateAsync({ module: module.module, enabled: checked })
                          .catch(() => undefined);
                        await refreshContext().catch(() => undefined);
                      }}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------- Usuários */}
        {isAdmin ? (
          <TabsContent value="usuarios">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Usuários e permissões</CardTitle>
                  <CardDescription>Controle quem acessa cada parte do sistema</CardDescription>
                </div>
                <Button size="sm" onClick={() => setUserDialog(true)}>
                  <UserPlus />
                  Novo usuário
                </Button>
              </CardHeader>

              {users?.data.length ? (
                <Table>
                  <THead>
                    <TR>
                      <TH>Nome</TH>
                      <TH>E-mail</TH>
                      <TH>Perfil</TH>
                      <TH>Status</TH>
                      <TH className="w-12" />
                    </TR>
                  </THead>
                  <TBody>
                    {users.data.map((row) => (
                      <TR key={row.id}>
                        <TD className="text-sm font-medium">{row.name}</TD>
                        <TD className="text-sm text-muted-foreground">{row.email}</TD>
                        <TD>
                          <Badge variant="secondary">{USER_ROLE[row.role as UserRole]}</Badge>
                        </TD>
                        <TD>
                          {row.isActive ? (
                            <Badge variant="success">Ativo</Badge>
                          ) : (
                            <Badge variant="muted">Inativo</Badge>
                          )}
                        </TD>
                        <TD>
                          {row.id !== user?.id && row.isActive ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive"
                              onClick={() => userMutations.remove.mutate(row.id)}
                            >
                              <Trash2 />
                            </Button>
                          ) : null}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <CardContent>
                  <EmptyState icon={ShieldCheck} title="Nenhum usuário adicional" />
                </CardContent>
              )}
            </Card>
          </TabsContent>
        ) : null}

        {/* ---------------------------------------------------------- Plano */}
        <TabsContent value="plano" className="space-y-4">
          {/* A cobrança vem primeiro: é a única parte com prazo. */}
          <BillingCard />

          {subscription ? (
            <Card>
              <CardHeader>
                <CardTitle>Plano atual: {subscription.subscription.plan.name}</CardTitle>
                <CardDescription>
                  Status: {subscription.subscription.status}
                  {subscription.subscription.trialEndsAt
                    ? ` · Teste até ${new Date(subscription.subscription.trialEndsAt).toLocaleDateString('pt-BR')}`
                    : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {Object.entries(subscription.usage).map(([key, usage]) => (
                  <div key={key} className="rounded-lg border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {key === 'users' ? 'Usuários' : key === 'professionals' ? 'Profissionais' : 'Agendamentos/mês'}
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {usage.current}
                      <span className="text-sm font-normal text-muted-foreground">
                        {' '}
                        / {usage.limit ?? '∞'}
                      </span>
                    </p>
                    {usage.limit ? (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(100, (usage.current / usage.limit) * 100)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            {plans?.map((plan) => {
              const current = subscription?.subscription.plan.slug === plan.slug;
              return (
                <Card key={plan.id} className={current ? 'border-primary ring-1 ring-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{plan.name}</CardTitle>
                      {current ? <Badge>Plano atual</Badge> : null}
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-3xl font-semibold">
                      {currency(plan.price)}
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </p>

                    <ul className="space-y-1.5 text-sm">
                      {plan.modules.map((module) => (
                        <li key={module} className="flex items-center gap-2">
                          <Check className="size-4 text-primary" />
                          {moduleLabel(module)}
                        </li>
                      ))}
                    </ul>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>Usuários: {plan.limits.users ?? 'ilimitado'}</p>
                      <p>Profissionais: {plan.limits.professionals ?? 'ilimitado'}</p>
                      <p>Agendamentos/mês: {plan.limits.appointmentsMonth ?? 'ilimitado'}</p>
                    </div>

                    {!current && isAdmin ? (
                      <p className="rounded-lg border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                        Para mudar para o {plan.name}, escolha o plano em{' '}
                        <strong>Assinar</strong>, acima — a troca emite a cobrança junto.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ------------------------------------------------------ Auditoria */}
        {isAdmin ? (
          <TabsContent value="auditoria">
            <Card>
              <CardHeader>
                <CardTitle>Trilha de auditoria</CardTitle>
                <CardDescription>Registro das ações importantes realizadas no sistema</CardDescription>
              </CardHeader>
              {auditLogs?.data.length ? (
                <Table>
                  <THead>
                    <TR>
                      <TH>Data</TH>
                      <TH>Usuário</TH>
                      <TH>Ação</TH>
                      <TH>Entidade</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {auditLogs.data.map((log) => (
                      <TR key={log.id}>
                        <TD className="text-sm text-muted-foreground">{dateTimeLabel(log.createdAt)}</TD>
                        <TD className="text-sm">{log.user?.name ?? log.userName ?? 'Sistema'}</TD>
                        <TD className="text-sm font-medium">{log.action}</TD>
                        <TD className="text-sm text-muted-foreground">{log.entity}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <CardContent>
                  <EmptyState icon={ShieldCheck} title="Nenhum registro ainda" />
                </CardContent>
              )}
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      <Dialog open={userDialog} onOpenChange={setUserDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await userMutations.create
                .mutateAsync({
                  ...userForm,
                  professionalId: userForm.professionalId || undefined,
                })
                .then(() => {
                  setUserDialog(false);
                  setUserForm({
                    name: '',
                    email: '',
                    password: '',
                    role: 'RECEPTIONIST',
                    professionalId: '',
                  });
                })
                .catch(() => undefined);
            }}
          >
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                required
                value={userForm.name}
                onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                required
                value={userForm.email}
                onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Senha provisória</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={userForm.password}
                onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <Select
                value={userForm.role}
                onValueChange={(v) => setUserForm((f) => ({ ...f, role: v as UserRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY_ADMIN">Administrador</SelectItem>
                  <SelectItem value="MANAGER">Gerente</SelectItem>
                  <SelectItem value="RECEPTIONIST">Recepcionista</SelectItem>
                  <SelectItem value="PROFESSIONAL">Profissional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {userForm.role === 'PROFESSIONAL' ? (
              <div className="space-y-1.5">
                <Label>Vincular à profissional</Label>
                <Select
                  value={userForm.professionalId}
                  onValueChange={(v) => setUserForm((f) => ({ ...f, professionalId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione quem vai usar este acesso" />
                  </SelectTrigger>
                  <SelectContent>
                    {linkable.map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>
                        {professional.name}
                        {professional.revenueOwner === 'PROFESSIONAL' ? ' — locatária' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  É esse vínculo que faz o acesso abrir a agenda certa. Sem ele, quem
                  entrar não enxerga a própria agenda nem o próprio link de agendamento.
                </p>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUserDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={userMutations.create.isPending}>
                <Plus />
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

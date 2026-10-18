import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { Skeleton } from '@/components/ui/feedback';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useAdminCompany, useAdminMutations, useAdminPlans } from '@/api/queries';
import { shortDate } from '@/lib/format';

export type CompanyAction = 'plan' | 'status' | 'dueDate' | 'password' | 'delete';

interface Props {
  /** A última ação escolhida — continua aqui depois de fechar. */
  action: CompanyAction | null;
  company: any | null;
  open: boolean;
  onClose: () => void;
}

/**
 * As janelas do menu de cada empresa no painel do SaaS. Uma aberta por vez.
 *
 * Fechar não apaga a ação nem a empresa: o conteúdo precisa continuar na tela
 * durante a animação de saída. Tirado no mesmo instante, a janela encolhia
 * para uma caixa vazia antes de sumir.
 */
export function CompanyActionDialogs({ action, company, open, onClose }: Props) {
  const onOpenChange = (value: boolean) => {
    if (!value) onClose();
  };
  const dialog = (kind: CompanyAction, form: (company: any) => React.ReactNode) => (
    <Dialog open={open && action === kind} onOpenChange={onOpenChange}>
      <DialogContent>{company && action === kind ? form(company) : null}</DialogContent>
    </Dialog>
  );

  return (
    <>
      {dialog('plan', (c) => <PlanForm company={c} onDone={onClose} />)}
      {dialog('status', (c) => <StatusForm company={c} onDone={onClose} />)}
      {dialog('dueDate', (c) => <DueDateForm company={c} onDone={onClose} />)}
      {dialog('password', (c) => <PasswordForm company={c} onDone={onClose} />)}
      {dialog('delete', (c) => <DeleteForm company={c} onDone={onClose} />)}
    </>
  );
}

// ---------------------------------------------------------------- mudar plano

function PlanForm({ company, onDone }: { company: any; onDone: () => void }) {
  const { data: plans } = useAdminPlans();
  const mutations = useAdminMutations();
  const current = company.subscription?.plan?.slug ?? '';
  const [planSlug, setPlanSlug] = useState(current);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await mutations.setPlan
          .mutateAsync({ id: company.id, planSlug })
          .then(onDone)
          .catch(() => undefined);
      }}
    >
      <DialogHeader>
        <DialogTitle>Mudar plano</DialogTitle>
        <DialogDescription>
          {company.name} está no plano <b>{company.subscription?.plan?.name ?? '—'}</b>. Os módulos
          e o valor cobrado no Asaas acompanham a troca.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label>Novo plano</Label>
        <Select value={planSlug} onValueChange={setPlanSlug}>
          <SelectTrigger>
            <SelectValue placeholder="Escolha o plano" />
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

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={mutations.setPlan.isPending}
          disabled={!planSlug || planSlug === current}
        >
          Salvar plano
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------- desativar / reativar

function StatusForm({ company, onDone }: { company: any; onDone: () => void }) {
  const mutations = useAdminMutations();
  const desativada = company.status === 'SUSPENDED';

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{desativada ? 'Reativar empresa' : 'Desativar empresa'}</DialogTitle>
        <DialogDescription>
          {desativada
            ? `${company.name} volta a entrar no sistema. Os dados estão todos lá, como ficaram.`
            : `Ninguém de ${company.name} consegue entrar enquanto ela estiver desativada, e quem está logado sai agora. Nada é apagado — dá para reativar depois.`}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          variant={desativada ? 'default' : 'destructive'}
          loading={mutations.setStatus.isPending}
          onClick={async () => {
            await mutations.setStatus
              .mutateAsync({ id: company.id, status: desativada ? 'ACTIVE' : 'SUSPENDED' })
              .then(onDone)
              .catch(() => undefined);
          }}
        >
          {desativada ? 'Reativar' : 'Desativar'}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ------------------------------------------------------------ editar vencimento

/** `2026-11-30` no fuso de Brasília — o dia que a dona vê no calendário. */
function diaEmBrasilia(value: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

function DueDateForm({ company, onDone }: { company: any; onDone: () => void }) {
  const mutations = useAdminMutations();
  const subscription = company.subscription;
  const emTeste = subscription?.status === 'TRIALING';
  const atual = emTeste ? subscription?.trialEndsAt : subscription?.currentPeriodEnd;
  const [dueDate, setDueDate] = useState(atual ? diaEmBrasilia(atual) : '');

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await mutations.setDueDate
          .mutateAsync({ id: company.id, dueDate })
          .then(onDone)
          .catch(() => undefined);
      }}
    >
      <DialogHeader>
        <DialogTitle>Editar vencimento</DialogTitle>
        <DialogDescription>
          {emTeste ? 'Último dia do teste' : 'Último dia do período pago'} de {company.name}:{' '}
          <b>{atual ? shortDate(atual) : 'sem data'}</b>. Depois dele, o sistema bloqueia até o
          pagamento.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label>Vence em</Label>
        <Input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <p className="text-xs text-muted-foreground">
          Vale até o fim do dia. A data da próxima cobrança no Asaas não muda.
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={mutations.setDueDate.isPending} disabled={!dueDate}>
          Salvar vencimento
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------- resetar senha

const ROLE_LABEL: Record<string, string> = {
  COMPANY_ADMIN: 'Administrador',
  RECEPTIONIST: 'Recepção',
  PROFESSIONAL: 'Profissional',
};

function PasswordForm({ company, onDone }: { company: any; onDone: () => void }) {
  const { data: detail, isLoading } = useAdminCompany(company.id);
  const mutations = useAdminMutations();
  const users: any[] = detail?.users ?? [];
  const [userId, setUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Já abre no administrador: é quase sempre a dona que esqueceu a senha.
  useEffect(() => {
    const lista: any[] = detail?.users ?? [];
    if (userId || !lista.length) return;
    const admin = lista.find((u) => u.role === 'COMPANY_ADMIN') ?? lista[0];
    setUserId(admin.id);
  }, [detail, userId]);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await mutations.resetPassword
          .mutateAsync({ id: company.id, userId, newPassword })
          .then(onDone)
          .catch(() => undefined);
      }}
    >
      <DialogHeader>
        <DialogTitle>Resetar senha</DialogTitle>
        <DialogDescription>
          Defina uma senha nova e passe para a pessoa. Quem estiver logado com a senha antiga sai na
          hora.
        </DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <Skeleton className="h-10" />
      ) : (
        <div className="space-y-1.5">
          <Label>Usuário</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha o usuário" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name} · {user.email}
                  {ROLE_LABEL[user.role] ? ` (${ROLE_LABEL[user.role]})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Nova senha</Label>
        <Input
          type="text"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Mínimo de 8 caracteres. Senhas que já vazaram na internet são recusadas.
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={mutations.resetPassword.isPending}
          disabled={!userId || newPassword.length < 8}
        >
          Redefinir senha
        </Button>
      </DialogFooter>
    </form>
  );
}

// -------------------------------------------------------------- excluir empresa

function DeleteForm({ company, onDone }: { company: any; onDone: () => void }) {
  const mutations = useAdminMutations();
  const [confirmName, setConfirmName] = useState('');
  const confere = confirmName.trim() === String(company.name).trim();

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!confere) return;
        await mutations.removeCompany
          .mutateAsync({ id: company.id, confirmName })
          .then(onDone)
          .catch(() => undefined);
      }}
    >
      <DialogHeader>
        <DialogTitle>Excluir empresa</DialogTitle>
        <DialogDescription>
          Apaga <b>{company.name}</b> e tudo o que é dela: usuários, clientes, agenda, caixa e
          aluguéis. A assinatura no Asaas é cancelada. <b>Não tem como desfazer.</b>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label>
          Para confirmar, digite <b>{company.name}</b>
        </Label>
        <Input
          autoComplete="off"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="destructive"
          loading={mutations.removeCompany.isPending}
          disabled={!confere}
        >
          Excluir empresa
        </Button>
      </DialogFooter>
    </form>
  );
}

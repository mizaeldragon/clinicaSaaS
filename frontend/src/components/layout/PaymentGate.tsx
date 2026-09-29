import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreditCard, LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { goToInvoice, useBilling, useBillingMutations } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { currency } from '@/lib/format';
import { BLOCKING_ACCESS, type AccessState } from '@/types';

/**
 * O aviso que tranca o painel: primeiro pagamento pendente, teste encerrado,
 * mensalidade vencida além da tolerância ou assinatura cancelada.
 *
 * É um modal sobre o painel, não uma página no lugar dele: a pessoa vê que os
 * dados continuam lá — só não dá para usar até pagar. A API já recusava as
 * escritas; sem este aviso, cada clique virava um erro solto na tela.
 *
 * Consulta a cobrança a cada poucos segundos: quem pagou por PIX em outra aba
 * volta e encontra o painel liberado sozinho, sem procurar botão.
 */

const day = (value: string) => format(new Date(value), "dd 'de' MMMM", { locale: ptBR });

function titulo(access: AccessState): string {
  switch (access.kind) {
    case 'awaiting_payment':
      return 'Falta só o pagamento';
    case 'trial_expired':
      return 'Seu período de teste terminou';
    case 'past_due_blocked':
      return 'Mensalidade em aberto';
    case 'canceled':
      return 'Assinatura cancelada';
    default:
      return 'Acesso bloqueado';
  }
}

function motivo(access: AccessState): string {
  switch (access.kind) {
    case 'awaiting_payment':
      return 'O sistema é liberado assim que o primeiro pagamento for confirmado.';
    case 'trial_expired':
      return `O teste terminou em ${day(access.endsAt)}. Assine para continuar usando o sistema — seus dados estão guardados.`;
    case 'past_due_blocked':
      return `A mensalidade venceu em ${day(access.dueAt)} e o acesso foi bloqueado. Assim que o pagamento for confirmado, tudo volta a funcionar — seus dados estão guardados.`;
    case 'canceled':
      return 'Reative a assinatura para voltar a usar o sistema. Seus dados estão guardados.';
    default:
      return '';
  }
}

export function PaymentGate({ access }: { access: AccessState }) {
  const refreshContext = useAuthStore((s) => s.refreshContext);
  const logout = useAuthStore((s) => s.logout);
  const canManage = useAuthStore((s) => s.can('settings:manage'));
  const { data } = useBilling(canManage, 5_000);
  const { subscribe, sync } = useBillingMutations();

  const liberado = data ? !BLOCKING_ACCESS.has(data.access.kind) : false;
  useEffect(() => {
    if (liberado) refreshContext().catch(() => undefined);
  }, [liberado, refreshContext]);

  function pagar() {
    if (data && goToInvoice(data)) return;
    // Sem fatura em aberto: teste que acabou sem assinar, ou assinatura
    // cancelada. Assina o plano atual e segue para a fatura dele.
    subscribe.mutate(
      {},
      {
        onSuccess: (overview) => {
          if (!goToInvoice(overview)) toast.info('A cobrança está sendo gerada. Tente em instantes.');
        },
      },
    );
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="bloqueio-titulo"
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl bg-card p-6 text-center shadow-panel sm:p-8">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary-ink">
          <CreditCard className="size-6" />
        </span>
        <h2 id="bloqueio-titulo" className="mt-4 text-xl font-semibold">
          {titulo(access)}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{motivo(access)}</p>

        {canManage ? (
          <>
            {data ? (
              <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                Plano <strong>{data.plan.name}</strong> · {currency(data.plan.price)}/mês
                {data.openPayment ? (
                  <span className="block text-xs text-muted-foreground">
                    Cobrança de {currency(data.openPayment.value)} em aberto
                  </span>
                ) : null}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-2">
              <Button size="lg" onClick={pagar} loading={subscribe.isPending} disabled={!data}>
                <CreditCard />
                Ir para o pagamento
              </Button>
              {access.kind !== 'canceled' ? (
                <Button
                  size="lg"
                  variant="outline"
                  loading={sync.isPending}
                  onClick={() => sync.mutate()}
                >
                  <RefreshCw />
                  Já paguei
                </Button>
              ) : null}
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              Quer outro plano ou corrigir o CPF/CNPJ?{' '}
              <Link
                to="/app/configuracoes?tab=plano"
                className="font-semibold text-primary-ink hover:underline"
              >
                Abrir configurações
              </Link>
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Fale com quem administra a conta para regularizar o pagamento.
          </p>
        )}

        <button
          type="button"
          onClick={() => logout()}
          className="mx-auto mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-3.5" />
          Sair
        </button>
      </div>
    </div>
  );
}

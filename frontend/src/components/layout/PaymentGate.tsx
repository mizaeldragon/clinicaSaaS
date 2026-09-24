import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { goToInvoice, useBilling, useBillingMutations } from '@/api/queries';
import { useAuthStore } from '@/stores/auth.store';
import { currency } from '@/lib/format';

/**
 * O que ocupa o painel de quem assinou e ainda não pagou a primeira mensalidade.
 *
 * Quem clica em "Assinar" na landing não ganha teste: o sistema abre quando o
 * Asaas confirmar o pagamento. Até lá, em vez de um painel que recusa cada
 * clique, a tela diz o que falta e leva à fatura.
 *
 * Consulta a cobrança a cada poucos segundos: quem pagou por PIX em outra aba
 * volta e encontra o painel liberado sozinho, sem procurar botão.
 */
export function PaymentGate() {
  const refreshContext = useAuthStore((s) => s.refreshContext);
  const canManage = useAuthStore((s) => s.can('settings:manage'));
  const { data, isLoading } = useBilling(canManage, 5_000);
  const { subscribe, sync } = useBillingMutations();

  const paid = data && data.access.kind !== 'awaiting_payment';
  useEffect(() => {
    if (paid) refreshContext().catch(() => undefined);
  }, [paid, refreshContext]);

  if (!canManage) {
    return (
      <GateShell title="Aguardando o pagamento da assinatura">
        O sistema é liberado assim que a administração da conta concluir o pagamento.
      </GateShell>
    );
  }

  if (isLoading || !data) return <Skeleton className="mx-auto h-64 w-full max-w-lg rounded-2xl" />;

  function pagar() {
    if (data && goToInvoice(data)) return;
    // Ainda sem fatura: a assinatura não chegou a ser criada no cadastro.
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
    <GateShell title="Falta só o pagamento">
      O plano <strong className="text-foreground">{data.plan.name}</strong> (
      {currency(data.plan.price)}/mês) é liberado assim que o pagamento for confirmado. Por PIX ou
      cartão leva poucos minutos; boleto, até dois dias úteis.
      <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <Button size="lg" onClick={pagar} loading={subscribe.isPending}>
          <CreditCard />
          Ir para o pagamento
        </Button>
        <Button
          size="lg"
          variant="outline"
          loading={sync.isPending}
          onClick={() => sync.mutate()}
        >
          <RefreshCw />
          Já paguei
        </Button>
      </div>
      <p className="mt-5 text-xs">
        Cobrança recusada por causa do CPF/CNPJ?{' '}
        <Link to="/app/configuracoes?tab=empresa" className="font-semibold text-primary-ink hover:underline">
          Corrija os dados da empresa
        </Link>
      </p>
    </GateShell>
  );
}

function GateShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary-ink">
        <CreditCard className="size-6" />
      </span>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

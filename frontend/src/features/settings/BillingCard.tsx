import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  Barcode,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/primitives';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { useBilling, useBillingMutations, usePlans } from '@/api/queries';
import { currency } from '@/lib/format';
import type { AccessState, BillingType, SubscriptionPaymentStatus } from '@/types';

/**
 * Mensalidade do SaaS.
 *
 * Três coisas, nesta ordem: em que pé está a assinatura, como pagar a que está
 * em aberto, e o histórico. A cobrança em aberto vem primeiro porque é a única
 * com prazo — o resto é consulta.
 */

const BILLING_LABEL: Record<BillingType, string> = {
  PIX: 'PIX',
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão de crédito',
};

const BILLING_ICON: Record<BillingType, typeof QrCode> = {
  PIX: QrCode,
  BOLETO: Barcode,
  CREDIT_CARD: CreditCard,
};

const STATUS_LABEL: Record<SubscriptionPaymentStatus, string> = {
  PENDING: 'Aguardando',
  CONFIRMED: 'Pago',
  RECEIVED: 'Pago',
  OVERDUE: 'Vencido',
  REFUNDED: 'Estornado',
  CANCELED: 'Cancelado',
};

const STATUS_VARIANT: Record<SubscriptionPaymentStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  RECEIVED: 'success',
  OVERDUE: 'danger',
  REFUNDED: 'muted',
  CANCELED: 'muted',
};

const day = (value: string) => format(new Date(value), "dd 'de' MMM 'de' yyyy", { locale: ptBR });

/** A frase que a dona lê no topo — a mesma regra que a API usa para trancar. */
function accessLine(access: AccessState): { tone: 'ok' | 'warn' | 'bad'; text: string } {
  switch (access.kind) {
    case 'trial':
      return {
        tone: access.daysLeft <= 3 ? 'warn' : 'ok',
        text:
          access.daysLeft === 1
            ? 'Seu teste termina amanhã. Escolha uma forma de pagamento para não perder o acesso.'
            : `Teste grátis: faltam ${access.daysLeft} dias (até ${day(access.endsAt)}).`,
      };
    case 'trial_expired':
      return {
        tone: 'bad',
        text: `O teste terminou em ${day(access.endsAt)}. Assine para voltar a lançar agendamentos.`,
      };
    case 'past_due':
      return {
        tone: 'warn',
        text: `Mensalidade vencida em ${day(access.dueAt)}. O acesso é bloqueado em ${day(access.blocksAt)}.`,
      };
    case 'past_due_blocked':
      return {
        tone: 'bad',
        text: `O painel está bloqueado desde o vencimento em ${day(access.dueAt)}. Pague a cobrança para liberar.`,
      };
    case 'canceled':
      return { tone: 'bad', text: 'Assinatura cancelada. Escolha um plano para reativar.' };
    default:
      return { tone: 'ok', text: 'Assinatura em dia.' };
  }
}

export function BillingCard() {
  const { data, isLoading } = useBilling();
  const { data: plans } = usePlans();
  const { subscribe, sync, cancel } = useBillingMutations();

  const [planSlug, setPlanSlug] = useState<string | null>(null);
  const [billingType, setBillingType] = useState<BillingType>('PIX');

  if (isLoading) return <Skeleton className="h-64 rounded-lg" />;
  if (!data) return null;

  const chosenPlan = planSlug ?? data.plan.slug;
  const access = accessLine(data.access);

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ estado */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Plano {data.plan.name}</CardTitle>
              <CardDescription>
                {currency(data.plan.price)} por mês
                {data.subscription.currentPeriodEnd
                  ? ` · pago até ${day(data.subscription.currentPeriodEnd)}`
                  : ''}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={sync.isPending}
              onClick={() => sync.mutate()}
              disabled={!data.subscription.active}
            >
              <RefreshCw />
              Atualizar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <p
            className={
              access.tone === 'bad'
                ? 'flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'
                : access.tone === 'warn'
                  ? 'flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400'
                  : 'flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground'
            }
          >
            {access.tone === 'ok' ? (
              <Check className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            )}
            {access.text}
          </p>

          {!data.gateway.enabled ? (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              O pagamento ainda não foi configurado nesta instalação. Enquanto isso o sistema
              continua liberado — nenhuma conta é bloqueada sem haver como pagar.
            </p>
          ) : data.gateway.environment === 'sandbox' ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              Ambiente de teste do Asaas: as cobranças aqui não são reais.
            </p>
          ) : null}

          {!data.documentOnFile ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              Preencha o CPF ou CNPJ da empresa na aba <strong>Empresa</strong> antes de assinar —
              o pagamento é emitido no nome dele.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ------------------------------------------------ cobrança em aberto */}
      {data.openPayment ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Cobrança em aberto</CardTitle>
            <CardDescription>
              {currency(data.openPayment.value)} · vence em {day(data.openPayment.dueDate)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.openPayment.pixPayload ? (
              <div className="space-y-2">
                <Label>PIX copia e cola</Label>
                <div className="flex gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 text-xs">
                    {data.openPayment.pixPayload}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Copiar código PIX"
                    onClick={() => {
                      navigator.clipboard.writeText(data.openPayment!.pixPayload as string);
                      toast.success('Código PIX copiado');
                    }}
                  >
                    <Copy />
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {data.openPayment.invoiceUrl ? (
                <Button asChild>
                  <a href={data.openPayment.invoiceUrl} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Abrir fatura
                  </a>
                </Button>
              ) : null}
              {data.openPayment.bankSlipUrl ? (
                <Button variant="outline" asChild>
                  <a href={data.openPayment.bankSlipUrl} target="_blank" rel="noreferrer">
                    <Barcode />
                    Ver boleto
                  </a>
                </Button>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              Pagamentos por boleto levam até dois dias úteis para serem identificados. Por PIX, o
              acesso é liberado em minutos.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* --------------------------------------------------------- contratar */}
      {data.gateway.enabled ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {data.subscription.active ? 'Mudar plano ou forma de pagamento' : 'Assinar'}
            </CardTitle>
            <CardDescription>
              A cobrança é mensal e renova sozinha. Você pode cancelar quando quiser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Plano</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {plans?.map((plan) => {
                  const selected = chosenPlan === plan.slug;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setPlanSlug(plan.slug)}
                      className={`rounded-lg border p-3 text-left transition ${
                        selected ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        <span className="font-medium">{plan.name}</span>
                        {selected ? <Check className="size-4 text-primary" /> : null}
                      </span>
                      <span className="mt-1 block text-lg font-semibold">
                        {currency(plan.price)}
                        <span className="text-xs font-normal text-muted-foreground">/mês</span>
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {plan.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(BILLING_LABEL) as BillingType[]).map((type) => {
                  const Icon = BILLING_ICON[type];
                  const selected = billingType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBillingType(type)}
                      className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition ${
                        selected ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'
                      }`}
                    >
                      <Icon className="size-4" />
                      {BILLING_LABEL[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                loading={subscribe.isPending}
                disabled={!data.documentOnFile}
                onClick={() => subscribe.mutate({ planSlug: chosenPlan, billingType })}
              >
                {data.subscription.active ? 'Salvar alterações' : 'Assinar agora'}
              </Button>

              {data.subscription.active ? (
                <Button
                  type="button"
                  variant="ghost"
                  loading={cancel.isPending}
                  onClick={() => {
                    if (confirm('Cancelar a assinatura? O acesso vale até o fim do período pago.')) {
                      cancel.mutate();
                    }
                  }}
                >
                  Cancelar assinatura
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* --------------------------------------------------------- histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de cobranças</CardTitle>
        </CardHeader>
        <CardContent>
          {!data.payments.length ? (
            <EmptyState
              icon={CreditCard}
              title="Nenhuma cobrança ainda"
              description="As mensalidades aparecem aqui assim que a assinatura for criada."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {data.payments.map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <span className="w-32 shrink-0 text-sm tabular-nums text-muted-foreground">
                    {day(payment.dueDate)}
                  </span>
                  <span className="w-24 shrink-0 text-sm font-medium tabular-nums">
                    {currency(payment.value)}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {BILLING_LABEL[payment.billingType]}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[payment.status]}>
                      {STATUS_LABEL[payment.status]}
                    </Badge>
                    {payment.invoiceUrl ? (
                      <Button variant="ghost" size="icon-sm" aria-label="Abrir fatura" asChild>
                        <a href={payment.invoiceUrl} target="_blank" rel="noreferrer">
                          <ExternalLink />
                        </a>
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Barcode, Check, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/primitives';
import { Skeleton } from '@/components/ui/feedback';
import { goToInvoice, useBilling, useBillingMutations, usePlans } from '@/api/queries';
import { currency } from '@/lib/format';
import type { AccessState } from '@/types';

/**
 * Mensalidade do SaaS.
 *
 * A aba responde uma pergunta só: qual plano esta empresa assinou. O histórico
 * de cobranças e a tabela de uso saíram daqui — eram consulta, e enterravam a
 * única linha que a dona abre esta aba para ver. O que sobra só aparece quando
 * há algo a fazer: uma cobrança em aberto, ou a assinatura, quando o pagamento
 * está configurado nesta instalação.
 *
 * A forma de pagamento não é escolhida aqui. A fatura do Asaas já oferece PIX,
 * boleto e cartão, e perguntar antes era uma decisão a mais entre a pessoa e o
 * pagamento — além de amarrar a cobrança a um meio que ela talvez nem use.
 */

const day = (value: string) => format(new Date(value), "dd 'de' MMM 'de' yyyy", { locale: ptBR });

/** O selo ao lado do nome do plano. Em dia não vira selo — é o esperado. */
function accessBadge(access: AccessState): { variant: 'warning' | 'danger'; text: string } | null {
  switch (access.kind) {
    case 'awaiting_payment':
      return { variant: 'danger', text: 'Aguardando pagamento' };
    case 'trial':
      return {
        variant: 'warning',
        text: access.daysLeft === 1 ? 'Teste termina amanhã' : `Teste: ${access.daysLeft} dias`,
      };
    case 'trial_expired':
      return { variant: 'danger', text: 'Teste encerrado' };
    case 'past_due':
      return { variant: 'warning', text: `Vencida em ${day(access.dueAt)}` };
    case 'past_due_blocked':
      return { variant: 'danger', text: 'Bloqueada' };
    case 'canceled':
      return { variant: 'danger', text: 'Cancelada' };
    default:
      return null;
  }
}

export function BillingCard() {
  const { data, isLoading } = useBilling();
  const { data: plans } = usePlans();
  const { subscribe, cancel } = useBillingMutations();

  const [planSlug, setPlanSlug] = useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-20 w-72 max-w-full rounded-xl" />;
  if (!data) return null;

  const chosenPlan = planSlug ?? data.plan.slug;
  const badge = accessBadge(data.access);

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------ plano atual */}
      {/* Duas linhas de texto não pedem a largura da tela: o cartão fica do
          tamanho do que diz, encostado à esquerda. */}
      <Card className="w-fit max-w-full">
        <CardHeader className="p-4">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Plano {data.plan.name}
            {badge ? <Badge variant={badge.variant}>{badge.text}</Badge> : null}
          </CardTitle>
          <CardDescription className="text-xs">
            {currency(data.plan.price)} por mês
            {data.subscription.currentPeriodEnd
              ? ` · pago até ${day(data.subscription.currentPeriodEnd)}`
              : ''}
          </CardDescription>
        </CardHeader>
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
              {data.subscription.active ? 'Mudar de plano' : 'Assinar'}
            </CardTitle>
            <CardDescription>
              A cobrança é mensal e renova sozinha. PIX, boleto ou cartão: você escolhe na página
              de pagamento. Pode cancelar quando quiser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!data.documentOnFile ? (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                Preencha o CPF ou CNPJ da empresa na aba <strong>Empresa</strong> antes de assinar —
                o pagamento é emitido no nome dele.
              </p>
            ) : null}

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

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                loading={subscribe.isPending}
                disabled={!data.documentOnFile}
                onClick={() =>
                  subscribe.mutate(
                    { planSlug: chosenPlan },
                    {
                      // Quem acabou de assinar vai direto para a fatura. Quem só
                      // trocou de plano fica aqui: a próxima cobrança já sai com
                      // o valor novo, não há o que pagar agora.
                      onSuccess: (overview) => {
                        if (data.subscription.active) toast.success('Plano atualizado');
                        else if (!goToInvoice(overview)) {
                          toast.success('Assinatura criada. A cobrança aparece aqui em instantes.');
                        }
                      },
                    },
                  )
                }
              >
                {data.subscription.active ? 'Salvar alterações' : 'Assinar e pagar'}
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
    </div>
  );
}

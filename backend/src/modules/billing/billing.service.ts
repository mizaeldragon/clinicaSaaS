import {
  BillingType,
  Prisma,
  SubscriptionPaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { AppError, BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import { asaas, type AsaasPayment } from '../../shared/integrations/asaas';
import { evaluateAccess } from '../../shared/services/access.service';
import {
  getCompanyContext,
  invalidateCompanyContext,
} from '../../shared/services/companyContext.service';
import { mailer } from '../../shared/services/mailer.service';
import { logger } from '../../shared/utils/logger';
import { CORE_MODULES } from '../companies/company.constants';

/**
 * Mensalidade do SaaS, cobrada pelo Asaas.
 *
 * O desenho é de espelho, não de fonte: quem decide se uma cobrança foi paga é
 * o Asaas, e o webhook traz essa decisão para cá. Guardamos a cópia para que o
 * painel mostre histórico e segunda via sem depender da API deles a cada tela —
 * e para que uma queda do gateway não apague o que já sabíamos.
 */

/**
 * Os status do Asaas que interessam. `RECEIVED_IN_CASH` e `DUNNING_*` existem
 * para outros fluxos deles; o que não estiver aqui não muda nada do nosso lado.
 */
const PAYMENT_STATUS: Record<string, SubscriptionPaymentStatus> = {
  PENDING: SubscriptionPaymentStatus.PENDING,
  AWAITING_RISK_ANALYSIS: SubscriptionPaymentStatus.PENDING,
  CONFIRMED: SubscriptionPaymentStatus.CONFIRMED,
  RECEIVED: SubscriptionPaymentStatus.RECEIVED,
  RECEIVED_IN_CASH: SubscriptionPaymentStatus.RECEIVED,
  OVERDUE: SubscriptionPaymentStatus.OVERDUE,
  REFUNDED: SubscriptionPaymentStatus.REFUNDED,
  REFUND_REQUESTED: SubscriptionPaymentStatus.REFUNDED,
  CHARGEBACK_REQUESTED: SubscriptionPaymentStatus.REFUNDED,
  DELETED: SubscriptionPaymentStatus.CANCELED,
  CANCELED: SubscriptionPaymentStatus.CANCELED,
};

/** Pago, para efeito de liberar o painel. */
const SETTLED = new Set<SubscriptionPaymentStatus>([
  SubscriptionPaymentStatus.CONFIRMED,
  SubscriptionPaymentStatus.RECEIVED,
]);

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` na data local — o Asaas só aceita dia, sem hora nem fuso. */
function toAsaasDate(date: Date): string {
  const [iso] = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .split('T');
  return iso;
}

function parseAsaasDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function nextMonth(from: Date): Date {
  const next = new Date(from);
  next.setMonth(next.getMonth() + 1);
  return next;
}

async function loadSubscription(companyId: string) {
  const subscription = await tenantContext.runAsSystem(() =>
    prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true, company: true },
    }),
  );
  if (!subscription) throw new NotFoundError('Assinatura');
  return subscription;
}

type LoadedSubscription = Awaited<ReturnType<typeof loadSubscription>>;

/**
 * Garante o cliente correspondente no Asaas. O CPF/CNPJ é exigido por eles e é
 * o único dado que a empresa talvez ainda não tenha preenchido.
 */
async function ensureAsaasCustomer(subscription: LoadedSubscription): Promise<string> {
  if (subscription.asaasCustomerId) {
    const existing = await asaas.getCustomer(subscription.asaasCustomerId);
    if (existing) return subscription.asaasCustomerId;
    // O cadastro sumiu do lado deles (conta trocada, sandbox limpo). Recria.
    logger.warn(
      { companyId: subscription.companyId, asaasCustomerId: subscription.asaasCustomerId },
      'Cliente do Asaas não existe mais — recriando',
    );
  }

  const company = subscription.company;
  const document = company.document?.replace(/\D/g, '');
  if (!document) {
    throw new AppError(
      'Preencha o CPF ou CNPJ da empresa em Configurações antes de assinar.',
      400,
      'COMPANY_DOCUMENT_REQUIRED',
    );
  }
  if (document.length !== 11 && document.length !== 14) {
    throw new BadRequestError('O CPF/CNPJ da empresa está incompleto.');
  }

  const customer = await asaas.createCustomer({
    name: company.legalName || company.name,
    cpfCnpj: document,
    email: company.email,
    phone: company.whatsapp || company.phone,
    externalReference: company.id,
  });

  await tenantContext.runAsSystem(() =>
    prisma.subscription.update({
      where: { companyId: company.id },
      data: { asaasCustomerId: customer.id },
    }),
  );

  return customer.id;
}

/** Grava (ou atualiza) o espelho local de uma cobrança do Asaas. */
async function mirrorPayment(
  subscriptionId: string,
  companyId: string,
  payment: AsaasPayment,
): Promise<SubscriptionPaymentStatus> {
  const status = PAYMENT_STATUS[payment.status] ?? SubscriptionPaymentStatus.PENDING;
  const paidOn = payment.paymentDate ?? payment.clientPaymentDate ?? null;

  // O copia-e-cola do PIX só existe enquanto a cobrança está em aberto.
  let pixPayload: string | null = null;
  if (payment.billingType === 'PIX' && status === SubscriptionPaymentStatus.PENDING) {
    pixPayload = (await asaas.getPixQrCode(payment.id))?.payload ?? null;
  }

  const data = {
    subscriptionId,
    companyId,
    asaasPaymentId: payment.id,
    status,
    billingType:
      payment.billingType === 'UNDEFINED'
        ? BillingType.BOLETO
        : (payment.billingType as BillingType),
    value: new Prisma.Decimal(payment.value),
    dueDate: parseAsaasDate(payment.dueDate),
    paidAt: paidOn ? parseAsaasDate(paidOn) : null,
    invoiceUrl: payment.invoiceUrl ?? null,
    bankSlipUrl: payment.bankSlipUrl ?? null,
    pixPayload,
  };

  await tenantContext.runAsSystem(() =>
    prisma.subscriptionPayment.upsert({
      where: { asaasPaymentId: payment.id },
      create: data,
      update: data,
    }),
  );

  return status;
}

/**
 * Move a assinatura conforme a cobrança. Pagou: ativa e empurra o período para
 * um mês depois do vencimento — não de hoje, senão pagar adiantado encurtaria o
 * mês. Venceu: marca PAST_DUE, e é o período de tolerância que decide o bloqueio.
 */
async function applyPaymentToSubscription(
  companyId: string,
  status: SubscriptionPaymentStatus,
  dueDate: Date,
): Promise<void> {
  if (SETTLED.has(status)) {
    await tenantContext.runAsSystem(() =>
      prisma.$transaction([
        prisma.subscription.update({
          where: { companyId },
          data: {
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: dueDate,
            currentPeriodEnd: nextMonth(dueDate),
          },
        }),
        prisma.company.update({ where: { id: companyId }, data: { status: 'ACTIVE' } }),
      ]),
    );
  } else if (status === SubscriptionPaymentStatus.OVERDUE) {
    await tenantContext.runAsSystem(() =>
      prisma.subscription.update({
        where: { companyId },
        data: { status: SubscriptionStatus.PAST_DUE },
      }),
    );
  } else {
    return;
  }

  invalidateCompanyContext(companyId);
}

export const billingService = {
  /** Tudo que a tela de cobrança precisa, numa chamada. */
  async overview(companyId: string) {
    const subscription = await loadSubscription(companyId);
    const context = await getCompanyContext(companyId);
    const payments = await tenantContext.runAsSystem(() =>
      prisma.subscriptionPayment.findMany({
        where: { companyId },
        orderBy: { dueDate: 'desc' },
        take: 24,
      }),
    );

    const openPayment = payments.find(
      (p) =>
        p.status === SubscriptionPaymentStatus.PENDING ||
        p.status === SubscriptionPaymentStatus.OVERDUE,
    );

    return {
      gateway: {
        enabled: asaas.isEnabled(),
        environment: asaas.environment(),
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        billingType: subscription.billingType,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        canceledAt: subscription.canceledAt,
        active: Boolean(subscription.asaasSubscriptionId),
      },
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        slug: subscription.plan.slug,
        price: subscription.plan.price,
      },
      access: context ? evaluateAccess(context) : { kind: 'ok' as const },
      /** Preenchido = a empresa pode assinar; vazio = falta o CPF/CNPJ. */
      documentOnFile: Boolean(subscription.company.document),
      openPayment: openPayment ?? null,
      payments,
    };
  },

  /**
   * Contrata (ou recontrata) a mensalidade. Idempotente: se já existe
   * assinatura no Asaas, só ajusta a forma de pagamento e o valor do plano.
   */
  async subscribe(companyId: string, input: { planSlug?: string; billingType: BillingType }) {
    if (!asaas.isEnabled()) {
      throw new AppError(
        'Cobrança não configurada nesta instalação.',
        503,
        'BILLING_NOT_CONFIGURED',
      );
    }

    let subscription = await loadSubscription(companyId);

    // Trocar de plano junto com a contratação é o caminho normal de quem sai do
    // trial: escolhe Pro ou Premium na mesma tela em que escolhe o pagamento.
    if (input.planSlug && input.planSlug !== subscription.plan.slug) {
      await this.changePlanModules(companyId, input.planSlug);
      subscription = await loadSubscription(companyId);
    }

    const customerId = await ensureAsaasCustomer(subscription);
    const value = Number(subscription.plan.price);
    const description = `CliniStudio — plano ${subscription.plan.name}`;

    if (subscription.asaasSubscriptionId) {
      await asaas.updateSubscription(subscription.asaasSubscriptionId, {
        value,
        billingType: input.billingType,
        description,
      });
      await tenantContext.runAsSystem(() =>
        prisma.subscription.update({
          where: { companyId },
          data: { billingType: input.billingType },
        }),
      );
    } else {
      // Primeira cobrança amanhã, não hoje: boleto e PIX gerados para o mesmo
      // dia costumam vencer antes da pessoa conseguir pagar.
      const firstDue = new Date(Date.now() + DAY_MS);
      const created = await asaas.createSubscription({
        customer: customerId,
        value,
        nextDueDate: toAsaasDate(firstDue),
        billingType: input.billingType,
        description,
        externalReference: companyId,
      });

      await tenantContext.runAsSystem(() =>
        prisma.subscription.update({
          where: { companyId },
          data: { asaasSubscriptionId: created.id, billingType: input.billingType },
        }),
      );
    }

    invalidateCompanyContext(companyId);
    await this.syncPayments(companyId);
    return this.overview(companyId);
  },

  /**
   * Troca de plano sem mexer no gateway: recalcula os módulos. O que não existe
   * no plano novo é desligado, menos os módulos essenciais.
   */
  async changePlanModules(companyId: string, planSlug: string) {
    return tenantContext.runAsSystem(async () => {
      const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
      if (!plan || !plan.isActive) throw new NotFoundError('Plano');

      const current = await prisma.companyModule.findMany({ where: { companyId, enabled: true } });
      const toDisable = current
        .map((m) => m.module)
        .filter((m) => !plan.modules.includes(m) && !CORE_MODULES.includes(m));

      await prisma.$transaction([
        prisma.subscription.update({ where: { companyId }, data: { planId: plan.id } }),
        prisma.companyModule.updateMany({
          where: { companyId, module: { in: toDisable } },
          data: { enabled: false },
        }),
      ]);

      invalidateCompanyContext(companyId);
      return { plan, disabledModules: toDisable };
    });
  },

  /** Puxa as cobranças do Asaas — usado após assinar e pelo botão "atualizar". */
  async syncPayments(companyId: string) {
    const subscription = await loadSubscription(companyId);
    if (!subscription.asaasSubscriptionId) return { synced: 0 };

    const { data } = await asaas.listSubscriptionPayments(subscription.asaasSubscriptionId);

    for (const payment of data) {
      const status = await mirrorPayment(subscription.id, companyId, payment);
      await applyPaymentToSubscription(companyId, status, parseAsaasDate(payment.dueDate));
    }

    return { synced: data.length };
  },

  /** Cancela no Asaas e aqui. O acesso continua até o fim do período pago. */
  async cancel(companyId: string) {
    const subscription = await loadSubscription(companyId);

    if (subscription.asaasSubscriptionId) {
      await asaas.cancelSubscription(subscription.asaasSubscriptionId);
    }

    await tenantContext.runAsSystem(() =>
      prisma.subscription.update({
        where: { companyId },
        data: {
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
          asaasSubscriptionId: null,
        },
      }),
    );

    invalidateCompanyContext(companyId);
    return this.overview(companyId);
  },

  /**
   * Webhook do Asaas. Tudo que chega aqui é um evento de cobrança; o corpo traz
   * o pagamento inteiro, então não precisamos consultar de volta.
   *
   * Responder 200 mesmo para evento desconhecido é proposital: o Asaas
   * reenfileira o que falha, e uma empresa que não é nossa geraria repetição
   * infinita de 4xx.
   */
  async handleWebhook(event: { event?: string; payment?: AsaasPayment }) {
    const payment = event.payment;
    if (!payment) return { handled: false, reason: 'evento sem cobrança' };

    const subscriptionId = payment.subscription;
    if (!subscriptionId) return { handled: false, reason: 'cobrança avulsa' };

    const subscription = await tenantContext.runAsSystem(() =>
      prisma.subscription.findUnique({ where: { asaasSubscriptionId: subscriptionId } }),
    );
    if (!subscription) {
      logger.warn({ subscriptionId, event: event.event }, 'Webhook de assinatura desconhecida');
      return { handled: false, reason: 'assinatura desconhecida' };
    }

    const status = await mirrorPayment(subscription.id, subscription.companyId, payment);
    await applyPaymentToSubscription(
      subscription.companyId,
      status,
      parseAsaasDate(payment.dueDate),
    );
    await notifyCompany(subscription.companyId, status, payment);

    logger.info(
      { event: event.event, companyId: subscription.companyId, status },
      'Webhook do Asaas processado',
    );

    return { handled: true, status };
  },
};

/** Avisa a empresa por e-mail quando a cobrança muda de estado. */
async function notifyCompany(
  companyId: string,
  status: SubscriptionPaymentStatus,
  payment: AsaasPayment,
): Promise<void> {
  if (status !== SubscriptionPaymentStatus.OVERDUE && !SETTLED.has(status)) return;

  const company = await tenantContext.runAsSystem(() =>
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true, email: true } }),
  );
  if (!company?.email) return;

  const valor = Number(payment.value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  if (SETTLED.has(status)) {
    await mailer.send({
      to: company.email,
      subject: 'Pagamento confirmado — CliniStudio',
      text: `Recebemos o pagamento de ${valor}. Sua assinatura está em dia e o sistema segue liberado.\n\nObrigado!`,
      action: { label: 'Abrir o painel', url: `${env.APP_URL}/app` },
    });
    return;
  }

  await mailer.send({
    to: company.email,
    subject: 'Mensalidade em aberto — CliniStudio',
    text:
      `A mensalidade de ${valor} venceu e ainda não foi identificada.\n\n` +
      `Você tem ${env.BILLING_GRACE_DAYS} dias para regularizar antes que o acesso seja bloqueado. ` +
      `Se já pagou, pode ignorar este aviso — a confirmação do banco leva até dois dias úteis.`,
    action: { label: 'Ver a cobrança', url: `${env.APP_URL}/app/settings/billing` },
  });
}

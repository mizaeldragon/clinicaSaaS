import { env } from '../../config/env';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';

/**
 * Cliente do Asaas — o gateway que cobra a mensalidade do SaaS.
 *
 * Só o que este produto usa: um cliente por empresa, uma assinatura mensal e a
 * leitura das cobranças que ela gera. O resto do ciclo chega pelo webhook.
 *
 * Sem `ASAAS_API_KEY` nada aqui é chamado — `isEnabled()` responde `false` e o
 * serviço de cobrança devolve "pagamento não configurado" em vez de estourar.
 * É o que deixa o desenvolvimento e os testes rodarem sem conta no gateway.
 */

const BASE_URL = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
} as const;

export type AsaasBillingType = 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string | null;
  cpfCnpj?: string | null;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  status: string;
  billingType: AsaasBillingType;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  subscription?: string | null;
  value: number;
  netValue?: number | null;
  status: string;
  dueDate: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  billingType: AsaasBillingType;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  transactionReceiptUrl?: string | null;
}

interface AsaasErrorBody {
  errors?: Array<{ code?: string; description?: string }>;
}

/** 10s: o Asaas responde em menos de 1s; acima disso é problema de rede. */
const TIMEOUT_MS = 10_000;

async function call<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  if (!env.ASAAS_API_KEY) {
    throw new AppError(
      'Cobrança não configurada nesta instalação.',
      503,
      'BILLING_NOT_CONFIGURED',
    );
  }

  const url = `${BASE_URL[env.ASAAS_ENV]}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        access_token: env.ASAAS_API_KEY,
        'Content-Type': 'application/json',
        // O Asaas pede identificação da integração; ajuda o suporte deles.
        'User-Agent': 'CliniStudio/1.0',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    logger.error({ error, path }, 'Asaas fora do ar');
    throw new AppError(
      'Não consegui falar com o sistema de pagamento. Tente de novo em instantes.',
      502,
      'BILLING_UNAVAILABLE',
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : {};

  if (!response.ok) {
    const described = (payload as AsaasErrorBody).errors
      ?.map((e) => e.description)
      .filter(Boolean)
      .join('; ');
    logger.error({ status: response.status, path, payload }, 'Asaas recusou a chamada');
    throw new AppError(
      described || 'O sistema de pagamento recusou a operação.',
      // 4xx do gateway é erro nosso ou do cadastro; 5xx é deles.
      response.status >= 500 ? 502 : 400,
      'BILLING_REJECTED',
    );
  }

  return payload as T;
}

export const asaas = {
  isEnabled(): boolean {
    return env.billingEnabled;
  },

  /** O ambiente em uso — o painel avisa quando está em sandbox. */
  environment(): 'sandbox' | 'production' {
    return env.ASAAS_ENV;
  },

  async createCustomer(input: {
    name: string;
    cpfCnpj: string;
    email?: string | null;
    phone?: string | null;
    /** Nosso id, para reconciliar do lado deles. */
    externalReference: string;
  }): Promise<AsaasCustomer> {
    return call<AsaasCustomer>('POST', '/customers', {
      name: input.name,
      cpfCnpj: input.cpfCnpj,
      email: input.email ?? undefined,
      mobilePhone: input.phone ?? undefined,
      externalReference: input.externalReference,
      notificationDisabled: false,
    });
  },

  async updateCustomer(
    id: string,
    input: { name?: string; email?: string | null; phone?: string | null },
  ): Promise<AsaasCustomer> {
    return call<AsaasCustomer>('POST', `/customers/${id}`, {
      name: input.name,
      email: input.email ?? undefined,
      mobilePhone: input.phone ?? undefined,
    });
  },

  async getCustomer(id: string): Promise<AsaasCustomer | null> {
    try {
      return await call<AsaasCustomer>('GET', `/customers/${id}`);
    } catch {
      return null;
    }
  },

  async createSubscription(input: {
    customer: string;
    value: number;
    nextDueDate: string;
    billingType: Exclude<AsaasBillingType, 'UNDEFINED'>;
    description: string;
    externalReference: string;
  }): Promise<AsaasSubscription> {
    return call<AsaasSubscription>('POST', '/subscriptions', {
      customer: input.customer,
      billingType: input.billingType,
      value: input.value,
      nextDueDate: input.nextDueDate,
      cycle: 'MONTHLY',
      description: input.description,
      externalReference: input.externalReference,
    });
  },

  async updateSubscription(
    id: string,
    input: { value?: number; billingType?: Exclude<AsaasBillingType, 'UNDEFINED'>; description?: string },
  ): Promise<AsaasSubscription> {
    return call<AsaasSubscription>('POST', `/subscriptions/${id}`, {
      value: input.value,
      billingType: input.billingType,
      description: input.description,
      // Sem isto o Asaas só aplicaria o novo valor em cobranças futuras e
      // deixaria a que já está em aberto com o preço antigo.
      updatePendingPayments: true,
    });
  },

  async cancelSubscription(id: string): Promise<void> {
    await call('DELETE', `/subscriptions/${id}`);
  },

  async listSubscriptionPayments(subscriptionId: string): Promise<{ data: AsaasPayment[] }> {
    return call<{ data: AsaasPayment[] }>(
      'GET',
      `/subscriptions/${subscriptionId}/payments?limit=50`,
    );
  },

  async getPayment(id: string): Promise<AsaasPayment> {
    return call<AsaasPayment>('GET', `/payments/${id}`);
  },

  /** Copia-e-cola do PIX de uma cobrança. */
  async getPixQrCode(paymentId: string): Promise<{ payload: string } | null> {
    try {
      return await call<{ payload: string }>('GET', `/payments/${paymentId}/pixQrCode`);
    } catch {
      return null;
    }
  },
};

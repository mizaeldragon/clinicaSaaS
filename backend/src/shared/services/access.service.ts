import { env } from '../../config/env';
import type { CompanyContext } from './companyContext.service';

/**
 * Se a empresa ainda pode usar o painel, e por quê.
 *
 * A regra vive aqui, num lugar só, porque duas partes precisam dela e não podem
 * discordar: o middleware que tranca as rotas e a tela que avisa a dona antes
 * de trancar. Se a resposta fosse calculada em dois lugares, um dia o painel
 * diria "faltam 3 dias" numa conta que a API já está recusando.
 *
 * A avaliação é preguiçosa — acontece na requisição, lendo as datas que já
 * estão no contexto. Não depende de job, de Redis nem de relógio de cron:
 * numa instalação sem fila o trial vence do mesmo jeito.
 */

export type AccessState =
  | { kind: 'ok' }
  | { kind: 'trial'; endsAt: Date; daysLeft: number }
  | { kind: 'trial_expired'; endsAt: Date }
  | { kind: 'past_due'; dueAt: Date; blocksAt: Date; daysLeft: number }
  | { kind: 'past_due_blocked'; dueAt: Date }
  | { kind: 'canceled' };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dias inteiros de `from` até `to`, arredondando para cima. */
function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

function graceDeadline(due: Date): Date {
  return new Date(due.getTime() + env.BILLING_GRACE_DAYS * DAY_MS);
}

export function evaluateAccess(context: CompanyContext, now = new Date()): AccessState {
  // Instalação sem gateway configurado não tranca ninguém: não haveria como
  // pagar para destravar. É o caso do desenvolvimento e do self-hosted.
  if (!env.billingEnabled) return { kind: 'ok' };

  const status = context.subscriptionStatus;
  if (!status) return { kind: 'ok' };

  if (status === 'CANCELED') return { kind: 'canceled' };

  if (status === 'TRIALING') {
    const endsAt = context.trialEndsAt;
    if (!endsAt) return { kind: 'ok' };
    if (endsAt <= now) return { kind: 'trial_expired', endsAt };
    return { kind: 'trial', endsAt, daysLeft: daysBetween(now, endsAt) };
  }

  // ACTIVE e PAST_DUE passam pelo mesmo teste de vencimento. ACTIVE com período
  // vencido acontece quando o webhook do Asaas não chegou — a data manda mais
  // que o rótulo, senão uma entrega falha viraria mês grátis.
  const periodEnd = context.currentPeriodEnd;
  if (!periodEnd) return { kind: 'ok' };

  if (periodEnd > now) return { kind: 'ok' };

  const blocksAt = graceDeadline(periodEnd);
  if (blocksAt <= now) return { kind: 'past_due_blocked', dueAt: periodEnd };

  return { kind: 'past_due', dueAt: periodEnd, blocksAt, daysLeft: daysBetween(now, blocksAt) };
}

/** Os estados em que o painel fica somente-leitura (na prática, trancado). */
export function blocksAccess(state: AccessState): boolean {
  return (
    state.kind === 'trial_expired' ||
    state.kind === 'past_due_blocked' ||
    state.kind === 'canceled'
  );
}

/** O que a pessoa lê na tela quando bate na parede. */
export function accessMessage(state: AccessState): string {
  switch (state.kind) {
    case 'trial_expired':
      return 'Seu período de teste terminou. Escolha um plano para continuar usando o sistema.';
    case 'past_due_blocked':
      return 'A mensalidade está em aberto. Regularize o pagamento para liberar o acesso.';
    case 'canceled':
      return 'Esta assinatura foi cancelada. Reative um plano para voltar a usar o sistema.';
    default:
      return '';
  }
}

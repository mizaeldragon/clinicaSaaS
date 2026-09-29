import type { ModuleKey } from '@prisma/client';
import { prisma } from '../database/prisma';
import { tenantContext } from '../database/tenantContext';
import { evaluateAccess, type AccessState } from './access.service';

export interface CompanyContext {
  id: string;
  name: string;
  slug: string;
  status: string;
  type: string;
  logoUrl: string | null;
  primaryColor: string;
  onboardingCompleted: boolean;
  modules: ModuleKey[];
  plan: {
    id: string;
    name: string;
    slug: string;
    maxUsers: number | null;
    maxProfessionals: number | null;
    maxAppointmentsMonth: number | null;
    modules: ModuleKey[];
  } | null;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: CompanyContext; expiresAt: number }>();

export function invalidateCompanyContext(companyId: string): void {
  cache.delete(companyId);
}

/**
 * O contexto como o painel o recebe: com o estado de acesso já avaliado.
 *
 * Avaliado aqui, a cada chamada, e não guardado no cache: depende do relógio.
 * Um contexto cacheado às 23:59 diria "em teste" até meia-noite e meia.
 */
export async function getCompanyContextForClient(
  companyId: string,
): Promise<(CompanyContext & { access: AccessState }) | null> {
  const context = await getCompanyContext(companyId);
  return context ? { ...context, access: evaluateAccess(context) } : null;
}

export async function getCompanyContext(companyId: string): Promise<CompanyContext | null> {
  const cached = cache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const company = await tenantContext.runAsSystem(() =>
    prisma.company.findUnique({
      where: { id: companyId },
      include: {
        modules: { where: { enabled: true } },
        subscription: { include: { plan: true } },
      },
    }),
  );

  if (!company) return null;

  const value: CompanyContext = {
    id: company.id,
    name: company.name,
    slug: company.slug,
    status: company.status,
    type: company.type,
    logoUrl: company.logoUrl,
    primaryColor: company.primaryColor,
    onboardingCompleted: company.onboardingCompleted,
    modules: company.modules.map((m) => m.module),
    plan: company.subscription?.plan
      ? {
          id: company.subscription.plan.id,
          name: company.subscription.plan.name,
          slug: company.subscription.plan.slug,
          maxUsers: company.subscription.plan.maxUsers,
          maxProfessionals: company.subscription.plan.maxProfessionals,
          maxAppointmentsMonth: company.subscription.plan.maxAppointmentsMonth,
          modules: company.subscription.plan.modules,
        }
      : null,
    subscriptionStatus: company.subscription?.status ?? null,
    trialEndsAt: company.subscription?.trialEndsAt ?? null,
    currentPeriodEnd: company.subscription?.currentPeriodEnd ?? null,
  };

  cache.set(companyId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

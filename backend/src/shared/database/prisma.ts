import { PrismaClient } from '@prisma/client';
import { env } from '../../config/env';
import { tenantContext } from './tenantContext';
import { ForbiddenError } from '../errors/AppError';

/**
 * Modelos que pertencem a uma empresa (tenant). Toda operação sobre eles é
 * automaticamente filtrada/preenchida com o `companyId` do contexto atual.
 *
 * `Company` fica de fora porque o isolamento nela é feito pela própria PK,
 * e modelos globais do SaaS (Plan, RefreshToken, User global) também.
 */
const TENANT_MODELS = new Set<string>([
  'CompanyModule',
  'BusinessHour',
  'Customer',
  'Professional',
  'WorkingHour',
  'TimeOff',
  'ServiceCategory',
  'Service',
  'ProfessionalService',
  'Appointment',
  'AppointmentService',
  'ResourceCategory',
  'Resource',
  'Rental',
  'RentalPayment',
  'ExpenseCategory',
  'FinancialTransaction',
  'Commission',
  'Notification',
  'AuditLog',
]);

const WHERE_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
  'update',
  'delete',
]);

const CREATE_OPERATIONS = new Set(['create', 'createMany']);

/**
 * Modelos que, além da empresa, pertencem a uma *carteira*: ou são da casa
 * (`ownerProfessionalId = null`) ou de uma locatária. A locadora enxerga apenas
 * a carteira da casa; cada locatária, apenas a sua.
 */
const PORTFOLIO_MODELS = new Set<string>([
  'Customer',
  'Appointment',
  'FinancialTransaction',
  // O catálogo também: o preço que a locatária cobra é informação do negócio
  // dela. A casa e as outras locatárias não precisam ver — e, numa casa onde
  // todas disputam a mesma cliente, não deveriam.
  'Service',
]);

function mergeWhere(where: unknown, companyId: string): Record<string, unknown> {
  const current = (where ?? {}) as Record<string, unknown>;
  if (current.companyId !== undefined) return current;
  return { ...current, companyId };
}

/**
 * Recorte de carteira. Só entra em campos escalares, então continua válido em
 * `findUnique`/`update`/`delete` (extended where unique do Prisma).
 */
function mergeOwner(where: unknown, ownerProfessionalId: string | null): Record<string, unknown> {
  const current = (where ?? {}) as Record<string, unknown>;
  if (current.ownerProfessionalId !== undefined) return current;
  return { ...current, ownerProfessionalId };
}

function injectCompanyId<T>(data: T, companyId: string): T {
  if (Array.isArray(data)) {
    return data.map((item) => ({ companyId, ...item })) as unknown as T;
  }
  if (data && typeof data === 'object') {
    return { companyId, ...(data as Record<string, unknown>) } as unknown as T;
  }
  return data;
}

/**
 * O Postgres guarda o plano das prepared statements por conexão. Depois de uma
 * migração que muda o tipo do resultado, a primeira consulta numa conexão
 * antiga falha com 0A000 — o plano em cache é descartado nesse erro, então
 * repetir uma vez resolve. Sem isso, a primeira requisição depois de um deploy
 * com migração devolve 500 para quem estiver online.
 */
const STALE_PLAN_CODE = '0A000';

/**
 * Repete uma consulta bruta quando o plano em cache ficou velho.
 *
 * O cache é por conexão, e o pool tem várias — repetir na mesma chamada pode
 * cair numa conexão ainda obsoleta, e foi o que acontecia: a primeira tentativa
 * consertava uma conexão e a seguinte tropeçava na próxima. Em vez de tentar
 * uma por uma, derrubamos o pool inteiro na primeira falha: as conexões novas
 * nascem sem plano nenhum.
 *
 * Isto acontece uma vez depois de cada migração que muda tipos, e nunca mais.
 * Sem isso, a primeira requisição após um deploy com migração devolve 500 para
 * quem estiver online.
 *
 * Vale só para o `$queryRaw`: as operações de modelo não sofrem porque o Prisma
 * as remonta a cada chamada, e o extension não intercepta consultas brutas.
 */
const STALE_PLAN_ATTEMPTS = 6;

export async function withStalePlanRetry<T>(run: () => Promise<T>): Promise<T> {
  let last: unknown;

  for (let attempt = 0; attempt < STALE_PLAN_ATTEMPTS; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (!isStalePlan(error)) throw error;
      last = error;

      // Devolver as conexões não basta sozinho: esta consulta costuma ser uma
      // das várias de um `Promise.all`, e o disconnect não fecha o que as
      // irmãs ainda seguram. Por isso esperamos um pouco mais a cada rodada —
      // é o tempo de elas terminarem e o pool renascer limpo.
      await prisma.$disconnect().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }

  throw last;
}

function isStalePlan(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string };
  return (
    candidate?.code === STALE_PLAN_CODE ||
    (typeof candidate?.message === 'string' &&
      candidate.message.includes('cached plan must not change result type'))
  );
}

function buildClient() {
  const base = new PrismaClient({
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
  });

  return base.$extends({
    name: 'multi-tenant-isolation',
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          if (!model || !TENANT_MODELS.has(model)) return query(args);
          if (tenantContext.isBypassed) return query(args);

          const companyId = tenantContext.companyId;

          if (!companyId) {
            // Nenhum contexto de empresa: bloqueia por segurança em vez de vazar
            // dados entre tenants por esquecimento do desenvolvedor.
            throw new ForbiddenError(
              `Operação "${model}.${operation}" exige contexto de empresa.`,
            );
          }

          const nextArgs = { ...(args ?? {}) } as Record<string, unknown>;
          const scope = tenantContext.scope;
          const scoped = PORTFOLIO_MODELS.has(model) && scope.kind !== 'all';

          if (WHERE_OPERATIONS.has(operation)) {
            nextArgs.where = mergeWhere(nextArgs.where, companyId);
            if (scoped) {
              nextArgs.where = mergeOwner(
                nextArgs.where,
                scope.kind === 'professional' ? scope.professionalId : null,
              );
            }
          }

          if (CREATE_OPERATIONS.has(operation) && nextArgs.data) {
            nextArgs.data = injectCompanyId(nextArgs.data, companyId);
          }

          if (operation === 'upsert') {
            nextArgs.where = mergeWhere(nextArgs.where, companyId);
            if (scoped) {
              nextArgs.where = mergeOwner(
                nextArgs.where,
                scope.kind === 'professional' ? scope.professionalId : null,
              );
            }
            if (nextArgs.create) nextArgs.create = injectCompanyId(nextArgs.create, companyId);
          }

          return query(nextArgs);
        },
      },
    },
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: ReturnType<typeof buildClient> | undefined;
}

export const prisma = global.__prisma ?? buildClient();

if (!env.isProduction) {
  global.__prisma = prisma;
}

export type ExtendedPrismaClient = typeof prisma;

/** Cliente disponível dentro de `prisma.$transaction(async (tx) => ...)`. */
export type TxClient = Omit<
  ExtendedPrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

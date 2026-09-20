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
  /*
   * Os quatro abaixo estavam de fora, e o esquecimento vazava entre empresas:
   * `GET /shifts` de uma casa devolvia os turnos da outra, o feriado de uma
   * fechava a agenda pública da outra, e a grade de ocupação misturava reservas
   * de espaços que nem existem ali. Nenhum dos serviços filtrava na mão, porque
   * todos confiavam neste filtro.
   */
  'Holiday',
  'Shift',
  'ResourceShiftPrice',
  'RentalBooking',
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

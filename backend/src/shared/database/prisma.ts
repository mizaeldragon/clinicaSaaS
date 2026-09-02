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

function mergeWhere(where: unknown, companyId: string): Record<string, unknown> {
  const current = (where ?? {}) as Record<string, unknown>;
  if (current.companyId !== undefined) return current;
  return { ...current, companyId };
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

          if (WHERE_OPERATIONS.has(operation)) {
            nextArgs.where = mergeWhere(nextArgs.where, companyId);
          }

          if (CREATE_OPERATIONS.has(operation) && nextArgs.data) {
            nextArgs.data = injectCompanyId(nextArgs.data, companyId);
          }

          if (operation === 'upsert') {
            nextArgs.where = mergeWhere(nextArgs.where, companyId);
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

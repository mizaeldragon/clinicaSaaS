import { prisma } from '../database/prisma';
import { tenantContext } from '../database/tenantContext';
import { logger } from '../utils/logger';

export interface AuditInput {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  userId?: string | null;
  userName?: string | null;
  ip?: string | null;
  companyId?: string | null;
}

/**
 * Registra uma ação relevante na trilha de auditoria.
 * Nunca derruba a requisição principal: falhas são apenas logadas.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  const companyId = input.companyId ?? tenantContext.companyId;
  if (!companyId) return;

  try {
    await tenantContext.runAsSystem(() =>
      prisma.auditLog.create({
        data: {
          companyId,
          userId: input.userId ?? tenantContext.userId,
          userName: input.userName ?? null,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          before: (input.before ?? undefined) as never,
          after: (input.after ?? undefined) as never,
          ip: input.ip ?? null,
        },
      }),
    );
  } catch (error) {
    logger.warn({ error, input }, 'Falha ao registrar auditoria');
  }
}

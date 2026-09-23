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
  /*
   * Empresa E usuário lidos aqui fora, antes do `runAsSystem`.
   *
   * O `runAsSystem` abre um contexto novo com o usuário zerado, de propósito —
   * é o modo de sistema. O usuário era lido lá dentro e por isso saía sempre
   * vazio: a trilha inteira mostrava "Sistema", inclusive para o que alguém
   * logado tinha feito com as próprias mãos. A empresa sempre funcionou só
   * porque já era capturada aqui fora.
   */
  const companyId = input.companyId ?? tenantContext.companyId;
  const userId = input.userId ?? tenantContext.userId;
  if (!companyId) return;

  try {
    await tenantContext.runAsSystem(async () => {
      /*
       * O nome vai junto, como foto do momento.
       *
       * A ligação com o usuário some quando ele é excluído (`onDelete:
       * SetNull`), e aí a trilha perderia justamente o que ela existe para
       * guardar: quem fez. Com o nome gravado no registro, continua dizendo.
       */
      const userName =
        input.userName ??
        (userId
          ? ((await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))
              ?.name ?? null)
          : null);

      await prisma.auditLog.create({
        data: {
          companyId,
          userId,
          userName,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          before: (input.before ?? undefined) as never,
          after: (input.after ?? undefined) as never,
          ip: input.ip ?? null,
        },
      });
    });
  } catch (error) {
    logger.warn({ error, input }, 'Falha ao registrar auditoria');
  }
}

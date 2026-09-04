import { prisma, TxClient } from '../database/prisma';
import { tenantContext } from '../database/tenantContext';
import { ForbiddenError } from '../errors/AppError';
import { emitToCompany, emitToProfessional } from '../../websocket/io';

/**
 * Carteira: dentro de uma empresa, um registro é da casa (`null`) ou de uma
 * locatária. Quem aluga o espaço toca o próprio negócio ali dentro — clientes e
 * agenda são dela, e não aparecem para a locadora.
 */

/** Dono da carteira do usuário logado. `null` = casa. */
export function currentPortfolioOwner(): string | null {
  const scope = tenantContext.scope;
  return scope.kind === 'professional' ? scope.professionalId : null;
}

/**
 * A quem pertence o que essa profissional atende: a ela mesma, quando é
 * locatária, ou à casa, quando é da equipe.
 */
export async function ownerOfProfessional(
  professionalId: string | null | undefined,
  client: TxClient = prisma,
): Promise<string | null> {
  if (!professionalId) return null;

  const professional = await tenantContext.runUnscoped(() =>
    client.professional.findFirst({
      where: { id: professionalId },
      select: { id: true, revenueOwner: true },
    }),
  );

  return professional?.revenueOwner === 'PROFESSIONAL' ? professional.id : null;
}

/**
 * A parede também vale para escrita: a locadora não lança nada na agenda de
 * quem aluga, e uma locatária não lança nada na de outra. Sem recorte
 * (`all` — página pública, jobs, seed) a origem já define o dono.
 */
export function assertCanWriteToPortfolio(ownerProfessionalId: string | null): void {
  const scope = tenantContext.scope;
  if (scope.kind === 'all') return;

  const allowed = scope.kind === 'professional' ? scope.professionalId : null;
  if (ownerProfessionalId !== allowed) {
    throw new ForbiddenError(
      'Esta agenda pertence a outra profissional do espaço. Você não pode alterá-la.',
    );
  }
}

/**
 * Entrega o evento em tempo real só para quem enxerga aquela carteira: a
 * empresa inteira quando é da casa, apenas a locatária quando é dela.
 */
export function emitToPortfolio(
  companyId: string,
  ownerProfessionalId: string | null,
  event: string,
  payload: unknown,
): void {
  if (ownerProfessionalId) {
    emitToProfessional(ownerProfessionalId, event, payload);
    return;
  }
  emitToCompany(companyId, event, payload);
}

/** Usuário vinculado à locatária — destinatário das notificações da carteira dela. */
export async function userOfProfessional(
  professionalId: string | null,
  client: TxClient = prisma,
): Promise<string | null> {
  if (!professionalId) return null;

  const professional = await tenantContext.runUnscoped(() =>
    client.professional.findFirst({
      where: { id: professionalId },
      select: { userId: true },
    }),
  );

  return professional?.userId ?? null;
}

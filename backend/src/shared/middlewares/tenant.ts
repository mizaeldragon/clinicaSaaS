import { RequestHandler } from 'express';
import { AppError, ForbiddenError, UnauthorizedError } from '../errors/AppError';
import { PortfolioScope, SCOPE_ALL, tenantContext } from '../database/tenantContext';
import { getCompanyContext } from '../services/companyContext.service';
import { getUserContext } from '../services/userContext.service';
import { asyncHandler } from '../utils/http';

/**
 * Estabelece o contexto multi-tenant da requisição.
 *
 * Todo o restante da cadeia (controllers, services, Prisma) executa dentro de
 * um AsyncLocalStorage com a `companyId` — o Prisma extension usa esse valor
 * para filtrar automaticamente todas as consultas.
 */
/**
 * Qual carteira esta requisição enxerga.
 *
 * A locatária aluga o espaço e toca o próprio negócio ali dentro: as clientes e
 * a agenda são dela. A locadora — mesmo sendo dona do imóvel e admin da conta —
 * enxerga apenas a carteira da casa; do negócio de quem aluga ela vê a
 * ocupação e a cobrança do turno, não o atendimento.
 */
function resolveScope(user: Express.AuthenticatedUser): PortfolioScope {
  if (user.isRenter && user.professionalId) {
    return { kind: 'professional', professionalId: user.professionalId };
  }
  return { kind: 'house' };
}

export const tenantMiddleware: RequestHandler = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw new UnauthorizedError();

  // O token é de quando a pessoa entrou; a conta pode ter mudado desde então.
  // Conferir aqui é o que faz desativar e excluir valerem na hora, em vez de
  // só quando o token vencesse.
  const account = await getUserContext(req.user.id);

  if (!account || !account.isActive) {
    throw new UnauthorizedError('Esta conta não está mais ativa.');
  }

  // Empresa do token diferente da empresa da conta: token emitido antes de uma
  // mudança de vínculo. Não serve mais.
  if (account.companyId !== req.user.companyId) {
    throw new UnauthorizedError('Sessão desatualizada. Entre novamente.');
  }

  // Super admin do SaaS opera fora do escopo de uma empresa.
  if (req.user.role === 'SUPER_ADMIN' && !req.user.companyId) {
    tenantContext.run(
      { companyId: null, userId: req.user.id, bypassTenant: true, scope: SCOPE_ALL },
      () => next(),
    );
    return;
  }

  const companyId = req.user.companyId;
  if (!companyId) throw new ForbiddenError('Usuário sem empresa vinculada');

  const context = await getCompanyContext(companyId);

  // Códigos próprios permitem que o cliente encerre a sessão automaticamente.
  if (!context) {
    throw new AppError('Empresa não encontrada', 403, 'COMPANY_NOT_FOUND');
  }

  if (context.status === 'SUSPENDED' || context.status === 'CANCELED') {
    throw new AppError(
      'Esta empresa está bloqueada. Entre em contato com o suporte para regularizar a assinatura.',
      403,
      'COMPANY_BLOCKED',
    );
  }

  req.companyId = companyId;
  req.enabledModules = context.modules;

  tenantContext.run(
    { companyId, userId: req.user.id, bypassTenant: false, scope: resolveScope(req.user) },
    () => next(),
  );
});

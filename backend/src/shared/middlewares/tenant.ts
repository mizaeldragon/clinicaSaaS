import { RequestHandler } from 'express';
import { AppError, ForbiddenError, UnauthorizedError } from '../errors/AppError';
import { tenantContext } from '../database/tenantContext';
import { getCompanyContext } from '../services/companyContext.service';
import { asyncHandler } from '../utils/http';

/**
 * Estabelece o contexto multi-tenant da requisição.
 *
 * Todo o restante da cadeia (controllers, services, Prisma) executa dentro de
 * um AsyncLocalStorage com a `companyId` — o Prisma extension usa esse valor
 * para filtrar automaticamente todas as consultas.
 */
export const tenantMiddleware: RequestHandler = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw new UnauthorizedError();

  // Super admin do SaaS opera fora do escopo de uma empresa.
  if (req.user.role === 'SUPER_ADMIN' && !req.user.companyId) {
    tenantContext.run({ companyId: null, userId: req.user.id, bypassTenant: true }, () => next());
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

  tenantContext.run({ companyId, userId: req.user.id, bypassTenant: false }, () => next());
});

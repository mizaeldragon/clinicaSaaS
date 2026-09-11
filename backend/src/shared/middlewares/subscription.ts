import { RequestHandler } from 'express';
import { AppError } from '../errors/AppError';
import { getCompanyContext } from '../services/companyContext.service';
import { accessMessage, blocksAccess, evaluateAccess } from '../services/access.service';
import { asyncHandler } from '../utils/http';

/**
 * Tranca o painel quando o trial venceu ou a mensalidade está em aberto.
 *
 * Fica DEPOIS do tenant e é montado só sobre as rotas de operação. O que
 * continua aberto de propósito: autenticação, os dados da própria empresa,
 * notificações e — principalmente — a cobrança. Trancar a tela de pagar seria
 * pedir que a pessoa pague sem deixá-la chegar ao boleto.
 *
 * Leitura continua livre também: quem está devendo ainda consegue ver a agenda
 * do dia para não deixar cliente na porta; o que trava é escrever.
 */

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const requireActiveSubscription: RequestHandler = asyncHandler(async (req, _res, next) => {
  // O super admin do SaaS é quem resolve o problema — nunca pode ficar do lado
  // de fora por causa da assinatura de uma empresa.
  if (req.user?.role === 'SUPER_ADMIN') return next();

  const companyId = req.companyId;
  if (!companyId) return next();

  const context = await getCompanyContext(companyId);
  if (!context) return next();

  const state = evaluateAccess(context);
  if (!blocksAccess(state)) return next();

  if (READ_METHODS.has(req.method)) return next();

  throw new AppError(accessMessage(state), 402, 'SUBSCRIPTION_REQUIRED');
});

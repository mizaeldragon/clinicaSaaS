import { RequestHandler } from 'express';
import type { ModuleKey } from '@prisma/client';
import { ModuleDisabledError } from '../errors/AppError';

/**
 * Feature flag no servidor. O frontend esconde o menu, mas a decisão real de
 * acesso acontece aqui — nunca confiar apenas no cliente.
 */
export function requireModule(module: ModuleKey): RequestHandler {
  return (req, _res, next) => {
    if (req.user?.role === 'SUPER_ADMIN') return next();
    const modules = req.enabledModules ?? [];
    if (!modules.includes(module)) throw new ModuleDisabledError(module);
    next();
  };
}

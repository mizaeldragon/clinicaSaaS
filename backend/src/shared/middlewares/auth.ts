import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../errors/AppError';
import { verifyAccessToken } from '../utils/jwt';
import type { UserRole } from '@prisma/client';

/**
 * Autentica a requisição a partir do Bearer token.
 * A `companyId` vem SEMPRE do token — nunca do body, query ou header do cliente.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de acesso não informado');
  }

  const payload = verifyAccessToken(header.slice(7).trim());

  req.user = {
    id: payload.sub,
    companyId: payload.companyId,
    role: payload.role as UserRole,
    permissions: payload.permissions ?? [],
    professionalId: payload.professionalId ?? null,
  };

  next();
}

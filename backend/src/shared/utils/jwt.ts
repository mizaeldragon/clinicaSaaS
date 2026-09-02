import crypto from 'node:crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError } from '../errors/AppError';

export interface AccessTokenPayload {
  sub: string;
  companyId: string | null;
  role: string;
  permissions: string[];
  professionalId?: string | null;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
  } catch {
    throw new UnauthorizedError('Token inválido ou expirado');
  }
}

/** Refresh token opaco: valor aleatório enviado ao cliente, hash salvo no banco. */
export function generateRefreshToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashRefreshToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);
  return { token, tokenHash, expiresAt };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHmac('sha256', env.REFRESH_TOKEN_SECRET).update(token).digest('hex');
}

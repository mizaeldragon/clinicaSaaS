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
  /** Locatária: aluga um espaço da empresa e tem carteira própria. */
  isRenter?: boolean;
}

/**
 * O algoritmo é fixado na assinatura E na conferência.
 *
 * Sem fixar, quem recebe o token escolhe como verificá-lo a partir do cabeçalho
 * que o próprio token traz — é a família de ataques de confusão de algoritmo.
 * Emissor e público entram pela mesma razão: um token assinado com este segredo
 * para outro fim não vale como sessão aqui.
 */
const ALGORITHM = 'HS256' as const;
const ISSUER = 'belezza';
const AUDIENCE = 'belezza-app';

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    algorithm: ALGORITHM,
    issuer: ISSUER,
    audience: AUDIENCE,
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as AccessTokenPayload;
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

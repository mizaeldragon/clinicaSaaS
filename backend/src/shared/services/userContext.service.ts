import { prisma } from '../database/prisma';
import { tenantContext } from '../database/tenantContext';

/**
 * O estado atual da conta, conferido a cada requisição.
 *
 * O token de acesso é uma fotografia do momento do login: carrega papel,
 * permissões e empresa, e nada dentro dele muda quando a conta muda. Sem esta
 * conferência, desativar ou excluir alguém só surtia efeito quando o token
 * vencesse — até quinze minutos de acesso para quem acabou de ser desligado, e
 * é justamente nesse intervalo que a demissão costuma doer.
 *
 * O cache de 30 segundos é o que torna isso barato: uma leitura por conta a
 * cada meio minuto, em vez de uma por requisição. Quem revoga o acesso limpa a
 * entrada na hora (`invalidateUserContext`), então o corte é imediato — o
 * cache só encurta o caminho de quem está trabalhando normalmente.
 */

export interface UserContext {
  id: string;
  companyId: string | null;
  isActive: boolean;
  role: string;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: UserContext | null; expiresAt: number }>();

export function invalidateUserContext(userId: string): void {
  cache.delete(userId);
}

/** Esvazia o cache inteiro — usado quando uma empresa some de uma vez. */
export function invalidateAllUserContexts(): void {
  cache.clear();
}

export async function getUserContext(userId: string): Promise<UserContext | null> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const user = await tenantContext.runAsSystem(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, companyId: true, isActive: true, role: true },
    }),
  );

  // Conta apagada também é cacheada: sem isso, um token de usuário excluído
  // bateria no banco a cada requisição — o alvo fácil de quem quer derrubar.
  cache.set(userId, { value: user, expiresAt: Date.now() + CACHE_TTL_MS });
  return user;
}

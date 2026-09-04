import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Carteira visível na requisição.
 *
 * Dentro de uma mesma empresa convivem negócios diferentes: a casa (a dona, sua
 * equipe e suas clientes) e cada locatária que aluga um espaço. A locadora não
 * enxerga a carteira de quem aluga — ela fatura o aluguel, não o atendimento.
 *
 * - `all`         — sem recorte (jobs, seed, página pública, super admin e o
 *                   motor de conflitos, que precisa enxergar a agenda inteira).
 * - `house`       — apenas o que é da casa (`ownerProfessionalId = null`).
 * - `professional`— apenas a carteira daquela locatária.
 */
export type PortfolioScope =
  | { kind: 'all' }
  | { kind: 'house' }
  | { kind: 'professional'; professionalId: string };

export const SCOPE_ALL: PortfolioScope = { kind: 'all' };

export interface TenantStore {
  companyId: string | null;
  userId: string | null;
  /** Quando true, o Prisma extension não injeta o filtro de empresa (jobs/super admin). */
  bypassTenant: boolean;
  scope: PortfolioScope;
}

const storage = new AsyncLocalStorage<TenantStore>();

export const tenantContext = {
  /** Executa `fn` dentro de um contexto de tenant. */
  run<T>(store: Partial<TenantStore>, fn: () => T): T {
    return storage.run(
      { companyId: null, userId: null, bypassTenant: false, scope: SCOPE_ALL, ...store },
      fn,
    );
  },

  /** Executa `fn` ignorando o isolamento por empresa (uso interno: jobs, super admin). */
  runAsSystem<T>(fn: () => T): T {
    return storage.run(
      { companyId: null, userId: null, bypassTenant: true, scope: SCOPE_ALL },
      fn,
    );
  },

  /**
   * Executa `fn` mantendo a empresa, mas enxergando todas as carteiras.
   *
   * Usado pelo motor de agendamento: para impedir overbooking de uma sala é
   * preciso enxergar também os atendimentos das locatárias — o resultado nunca
   * é devolvido ao cliente, serve apenas para detectar o conflito.
   */
  runUnscoped<T>(fn: () => T): T {
    const current = storage.getStore();
    if (!current || current.scope.kind === 'all') return fn();
    return storage.run({ ...current, scope: SCOPE_ALL }, fn);
  },

  get(): TenantStore | undefined {
    return storage.getStore();
  },

  get companyId(): string | null {
    return storage.getStore()?.companyId ?? null;
  },

  get userId(): string | null {
    return storage.getStore()?.userId ?? null;
  },

  get isBypassed(): boolean {
    return storage.getStore()?.bypassTenant ?? false;
  },

  get scope(): PortfolioScope {
    return storage.getStore()?.scope ?? SCOPE_ALL;
  },
};

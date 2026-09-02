import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantStore {
  companyId: string | null;
  userId: string | null;
  /** Quando true, o Prisma extension não injeta o filtro de empresa (jobs/super admin). */
  bypassTenant: boolean;
}

const storage = new AsyncLocalStorage<TenantStore>();

export const tenantContext = {
  /** Executa `fn` dentro de um contexto de tenant. */
  run<T>(store: Partial<TenantStore>, fn: () => T): T {
    return storage.run(
      { companyId: null, userId: null, bypassTenant: false, ...store },
      fn,
    );
  },

  /** Executa `fn` ignorando o isolamento por empresa (uso interno: jobs, super admin). */
  runAsSystem<T>(fn: () => T): T {
    return storage.run({ companyId: null, userId: null, bypassTenant: true }, fn);
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
};

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, configureApi } from '@/lib/api';
import { applyBrandColor, resetBrandColor } from '@/lib/utils';
import type { AuthResponse, AuthUser, CompanyContext, ModuleKey } from '@/types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  company: CompanyContext | null;
  hydrated: boolean;

  /**
   * Devolve o desafio quando a conta tem segundo fator: a sessão só nasce
   * depois do código. Sem isso a tela não teria como saber que falta um passo.
   */
  login: (
    email: string,
    password: string,
    companySlug?: string,
  ) => Promise<{ twoFactorRequired: true; challengeToken: string } | null>;
  completeTwoFactor: (challengeToken: string, code: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshContext: () => Promise<void>;
  setSession: (data: AuthResponse) => void;
  hasModule: (module: ModuleKey) => boolean;
  can: (permission: string) => boolean;
}

export interface RegisterPayload {
  company: { name: string; type: string; phone?: string };
  admin: { name: string; email: string; password: string; phone?: string };
  planSlug?: string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      company: null,
      hydrated: false,

      setSession: (data) => {
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
          company: data.company,
        });
        applyBrandColor(data.company?.primaryColor);
      },

      login: async (email, password, companySlug) => {
        const data = await api.public.post<
          AuthResponse | { twoFactorRequired: true; challengeToken: string }
        >('/auth/login', { email, password, companySlug });

        if ('twoFactorRequired' in data) return data;

        get().setSession(data);
        return null;
      },

      completeTwoFactor: async (challengeToken, code) => {
        const data = await api.public.post<AuthResponse>('/auth/2fa/login', {
          challengeToken,
          code,
        });
        get().setSession(data);
      },

      register: async (payload) => {
        const data = await api.public.post<AuthResponse>('/auth/register', payload);
        get().setSession(data);
      },

      logout: async () => {
        const { refreshToken } = get();
        if (refreshToken) {
          await api.public.post('/auth/logout', { refreshToken }).catch(() => undefined);
        }
        set({ accessToken: null, refreshToken: null, user: null, company: null });
        resetBrandColor();
      },

      /**
       * Derruba as sessões de todos os aparelhos, inclusive este. O servidor
       * revoga os refresh tokens; aqui só resta limpar o estado local.
       */
      logoutAll: async () => {
        await api.post('/auth/logout-all', {}).catch(() => undefined);
        set({ accessToken: null, refreshToken: null, user: null, company: null });
        resetBrandColor();
      },

      refreshContext: async () => {
        const data = await api.get<{
          user: AuthUser;
          company: CompanyContext | null;
        }>('/auth/me');
        set({ user: data.user, company: data.company });
        applyBrandColor(data.company?.primaryColor);
      },

      hasModule: (module) => Boolean(get().company?.modules.includes(module)),

      can: (permission) => {
        const user = get().user;
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN') return true;
        return user.permissions.includes(permission);
      },
    }),
    {
      name: 'clinistudio.auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        company: state.company,
      }),
      onRehydrateStorage: () => (state) => {
        applyBrandColor(state?.company?.primaryColor);
        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);

// Liga o cliente HTTP ao store (refresh automático de token).
configureApi({
  getTokens: () => {
    const { accessToken, refreshToken } = useAuthStore.getState();
    return { accessToken, refreshToken };
  },
  setTokens: ({ accessToken, refreshToken }) => useAuthStore.setState({ accessToken, refreshToken }),
  onLogout: () => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null, company: null });
    resetBrandColor();
  },
});

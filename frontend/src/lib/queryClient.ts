import { QueryClient } from '@tanstack/react-query';

/**
 * O cache de dados do aplicativo, em módulo próprio.
 *
 * Mora fora do `main.tsx` porque o store de autenticação precisa alcançá-lo:
 * ao trocar de sessão, o cache da sessão anterior tem que morrer junto. Guardado
 * lá dentro, só componentes React chegariam nele.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

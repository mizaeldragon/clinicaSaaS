import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Plan } from '@/types';

/** Planos disponíveis para contratação — rota pública usada no cadastro. */
export function usePublicPlans() {
  return useQuery<Plan[]>({
    queryKey: ['public-plans'],
    queryFn: () => api.get<Plan[]>('/auth/plans'),
    staleTime: 5 * 60_000,
  });
}

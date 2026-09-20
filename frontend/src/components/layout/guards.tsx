import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { EmptyState } from '@/components/ui/feedback';
import type { ModuleKey } from '@/types';

export function ProtectedRoute() {
  const { accessToken, user } = useAuthStore();
  const location = useLocation();

  if (!accessToken || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Super admin do SaaS vai direto para o painel da plataforma.
  if (user.role === 'SUPER_ADMIN' && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin" replace />;
  }

  // O wizard deixou de ser obrigatório: o plano escolhido no cadastro já liga
  // os módulos que a empresa contratou, e não sobra o que perguntar antes de
  // deixar alguém entrar. Ele continua em /onboarding para quem quiser popular
  // catálogo e estrutura de uma vez.

  return <Outlet />;
}

/**
 * Bloqueia a rota por módulo (o que a empresa contratou) e por permissão (o que
 * esta pessoa alcança).
 *
 * Só o módulo não bastava: ele é da empresa inteira. Numa casa com aluguel,
 * todos os módulos estão ligados, então a locatária que digitasse
 * `/app/relatorios` na barra de endereços abria a página — o menu escondia, a
 * rota não. Ela via a tela montar e cada consulta voltar 403.
 */
export function ModuleRoute({ module, permission }: { module: ModuleKey; permission?: string }) {
  const hasModule = useAuthStore((state) => state.hasModule(module));
  const can = useAuthStore((state) => state.can);

  if (!hasModule) {
    return (
      <EmptyState
        icon={Lock}
        title="Módulo não habilitado"
        description="Este recurso não faz parte da configuração atual da sua empresa. Você pode ativá-lo em Configurações › Módulos, se o seu plano permitir."
      />
    );
  }

  if (permission && !can(permission)) {
    return (
      <EmptyState
        icon={Lock}
        title="Você não tem acesso a esta parte"
        description="Seu perfil não alcança esta tela. Se precisar dela, peça a quem administra a conta."
      />
    );
  }

  return <Outlet />;
}

export function SuperAdminRoute() {
  const role = useAuthStore((state) => state.user?.role);
  if (role !== 'SUPER_ADMIN') return <Navigate to="/app" replace />;
  return <Outlet />;
}

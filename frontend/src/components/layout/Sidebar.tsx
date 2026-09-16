import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { NAV_ITEMS, type NavItem } from '@/config/navigation';
import { isNavItemVisible } from '@/lib/nav';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand';

const GROUP_LABELS: Record<NavItem['group'], string> = {
  operação: 'Operação',
  gestão: 'Gestão',
  configuração: 'Configuração',
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Menu lateral dinâmico: cada item só é renderizado se o módulo estiver
 * habilitado para a empresa E o usuário tiver a permissão necessária.
 */
export function Sidebar({ open, onClose }: SidebarProps) {
  const company = useAuthStore((s) => s.company);
  const hasModule = useAuthStore((s) => s.hasModule);
  const can = useAuthStore((s) => s.can);
  const role = useAuthStore((s) => s.user?.role);

  const items = NAV_ITEMS.filter((item) => isNavItemVisible(item, { role, hasModule, can }));

  const groups = ['operação', 'gestão', 'configuração'] as const;

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Marca do produto. A identidade da empresa fica no topo, à direita. */}
        <div className="flex h-16 items-center gap-3 px-5">
          {/* Num contêiner flex, o flex-1 tem que ficar na caixa: aplicado na
              própria imagem ele esticaria o logotipo. */}
          <div className="min-w-0 flex-1">
            <BrandLogo className="h-7" />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-sidebar-muted hover:bg-foreground/[0.06] lg:hidden"
            onClick={onClose}
            aria-label="Fechar menu"
          >
            <X />
          </Button>
        </div>

        <nav className="no-scrollbar flex-1 space-y-6 overflow-y-auto px-3 pb-6 pt-2">
          {groups.map((group) => {
            const groupItems = items.filter((item) => item.group === group);
            if (groupItems.length === 0) return null;

            return (
              <div key={group} className="space-y-1">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                  {GROUP_LABELS[group]}
                </p>
                {groupItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/app'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-primary/10 text-primary-ink'
                          : 'text-sidebar-foreground/70 hover:bg-foreground/[0.04] hover:text-sidebar-foreground',
                      )
                    }
                  >
                    <item.icon className="size-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {company?.subscriptionStatus === 'TRIALING' && company.trialEndsAt ? (
          <div className="mx-3 mb-4 rounded-xl border border-sidebar-border bg-shell p-3">
            <p className="text-xs font-semibold text-sidebar-foreground">Período de teste</p>
            <p className="mt-0.5 text-[11px] text-sidebar-muted">
              Termina em {new Date(company.trialEndsAt).toLocaleDateString('pt-BR')}
            </p>
            <NavLink
              to="/app/configuracoes?tab=plano"
              className="mt-2 inline-flex text-[11px] font-semibold text-primary-ink hover:underline"
            >
              Ver planos →
            </NavLink>
          </div>
        ) : null}
      </aside>
    </>
  );
}

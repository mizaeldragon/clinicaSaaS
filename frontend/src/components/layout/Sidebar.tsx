import { NavLink } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { NAV_ITEMS, type NavItem } from '@/config/navigation';
import { isNavItemVisible } from '@/lib/nav';
import { Button } from '@/components/ui/button';

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
          <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-accent text-white shadow-lg">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Belezza</p>
            <p className="truncate text-[11px] text-sidebar-muted">Gestão de beleza</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-sidebar-muted hover:bg-white/10 hover:text-white lg:hidden"
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
                          ? 'bg-sidebar-accent text-white shadow-lg'
                          : 'text-sidebar-foreground/75 hover:bg-white/8 hover:text-white',
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
          <div className="mx-3 mb-4 rounded-xl border border-sidebar-border bg-white/5 p-3">
            <p className="text-xs font-medium text-white">Período de teste</p>
            <p className="mt-0.5 text-[11px] text-sidebar-muted">
              Termina em {new Date(company.trialEndsAt).toLocaleDateString('pt-BR')}
            </p>
            <NavLink
              to="/app/configuracoes?tab=plano"
              className="mt-2 inline-flex text-[11px] font-semibold text-sidebar-accent hover:underline"
              style={{ color: 'hsl(var(--sidebar-accent))' }}
            >
              Ver planos →
            </NavLink>
          </div>
        ) : null}
      </aside>
    </>
  );
}

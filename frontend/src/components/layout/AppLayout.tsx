import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useRealtime } from '@/hooks/useRealtime';
import { useAuthStore } from '@/stores/auth.store';
import { NAV_ITEMS } from '@/config/navigation';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const refreshContext = useAuthStore((s) => s.refreshContext);
  const hasModule = useAuthStore((s) => s.hasModule);
  const can = useAuthStore((s) => s.can);

  useRealtime();

  // Sincroniza módulos/permissões ao entrar no app.
  useEffect(() => {
    refreshContext().catch(() => undefined);
  }, [refreshContext]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Barra inferior no mobile com os 4 itens mais usados.
  const mobileItems = NAV_ITEMS.filter((item) => {
    if (item.module && !hasModule(item.module)) return false;
    if (item.permission && !can(item.permission)) return false;
    return true;
  }).slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="lg:pl-[270px]">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-border/70 bg-background/95 backdrop-blur-md lg:hidden">
        {mobileItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/app'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            <item.icon className="size-5" />
            <span className="truncate px-1">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

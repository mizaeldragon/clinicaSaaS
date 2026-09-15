import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { ADMIN_NAV } from '@/config/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { BrandMark, BrandMarkTile } from '@/components/brand';

export function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[250px] flex-col bg-slate-950 text-slate-200 lg:flex">
        <div className="flex h-16 items-center gap-3 px-5">
          <BrandMarkTile />
          <div>
            <p className="text-sm font-semibold text-white">CliniStudio SaaS</p>
            <p className="text-[11px] text-slate-400">Painel da plataforma</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 pt-2">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2 px-1 py-2">
            <UserAvatar name={user?.name} className="size-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="truncate text-[11px] text-slate-400">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-300 hover:bg-white/10 hover:text-white"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            <LogOut />
            Sair
          </Button>
        </div>
      </aside>

      <div className="lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <BrandMark className="size-6" />
            <span className="font-semibold">CliniStudio SaaS</span>
          </div>
          <nav className="flex gap-1 lg:hidden">
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-2.5 py-1.5 text-xs font-medium',
                    isActive ? 'bg-primary text-white' : 'text-muted-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden lg:block" />
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

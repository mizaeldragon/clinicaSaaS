import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useRealtime } from '@/hooks/useRealtime';
import { useAuthStore } from '@/stores/auth.store';
import { NAV_ITEMS } from '@/config/navigation';
import { isNavItemVisible } from '@/lib/nav';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const refreshContext = useAuthStore((s) => s.refreshContext);
  const hasModule = useAuthStore((s) => s.hasModule);
  const can = useAuthStore((s) => s.can);
  const role = useAuthStore((s) => s.user?.role);

  useRealtime();

  // Sincroniza módulos/permissões ao entrar no app.
  useEffect(() => {
    refreshContext().catch(() => undefined);
  }, [refreshContext]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  /*
   * Barra inferior com TUDO que a pessoa alcança — não só os cinco primeiros.
   *
   * Cortar em cinco escondia Financeiro, Comissões e Relatórios atrás do menu
   * lateral, que no celular é uma gaveta que ninguém abre. Como a lista varia
   * (o Premium tem Aluguéis, a locatária tem quase nada), a barra rola de lado
   * em vez de espremer todo mundo: cabem cinco por tela e o sexto aparece pela
   * metade na borda, que é o que convida a rolar.
   */
  const mobileItems = NAV_ITEMS.filter((item) =>
    isNavItemVisible(item, { role, hasModule, can }),
  );

  return (
    <div className="min-h-screen bg-shell">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="lg:pl-[270px]">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />

        {/*
          O conteúdo mora num cartão que flutua sobre o quadro.

          É ele que separa o miolo do menu e do cabeçalho agora — antes eram
          duas linhas de 1px. A folga em volta e a sombra fazem o mesmo
          trabalho sem cortar a tela em retângulos.

          Os cartões de dentro continuam visíveis porque têm borda própria; do
          contrário sumiriam, branco sobre branco.
        */}
        {/* O respiro em cima não é estética: sem ele o cartão encosta no
            cabeçalho e o canto arredondado não tem onde aparecer. */}
        <main className="px-3 pb-24 pt-2 lg:px-5 lg:pb-6 lg:pt-3">
          <div className="mx-auto w-full max-w-[1400px] rounded-2xl bg-card p-4 shadow-panel sm:p-6 lg:p-7">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="no-scrollbar safe-bottom fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto bg-card/95 shadow-[0_-1px_3px_rgb(16_24_40/0.06)] backdrop-blur-md lg:hidden">
        {mobileItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/app'}
            /* O item ativo se traz para a vista sozinho: quem abre Relatórios
               pelo menu lateral não deve encontrar a barra parada no começo,
               sem sinal de onde está. */
            ref={(node) => {
              if (node?.classList.contains('text-primary')) {
                node.scrollIntoView({ block: 'nearest', inline: 'center' });
              }
            }}
            className={({ isActive }) =>
              cn(
                // `w-[20%]` com `shrink-0`: cinco cabem na tela e o sexto
                // aparece pela metade, que é o que mostra haver mais.
                'flex w-[20%] shrink-0 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
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

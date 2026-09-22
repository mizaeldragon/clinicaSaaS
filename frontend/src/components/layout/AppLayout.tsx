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
   * Barra inferior com TUDO que a pessoa alcança, sem rolagem.
   *
   * Cortar em cinco escondia Financeiro, Comissões e Relatórios atrás do menu
   * lateral, que no celular é uma gaveta que ninguém abre. Tudo visível de uma
   * vez é o que faz a barra valer: o que precisa ser arrastado para aparecer
   * está tão escondido quanto estava.
   */
  const mobileItems = NAV_ITEMS.filter((item) =>
    isNavItemVisible(item, { role, hasModule, can }),
  );

  /*
   * O rótulo cabe? Então aparece.
   *
   * Dividindo 375px por nove itens sobram 41px — não cabe "Profissionais", e
   * texto cortado pela metade informa menos que ícone nenhum. Acima de cinco
   * itens a barra fica só com os ícones; até cinco, cada um tem 75px e o nome
   * cabe inteiro. Assim a locatária, que alcança três telas, continua lendo os
   * nomes, e o administrador do Premium, que alcança dez, vê todas elas.
   */
  const cabeRotulo = mobileItems.length <= 5;

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

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex bg-card/95 shadow-[0_-1px_3px_rgb(16_24_40/0.06)] backdrop-blur-md lg:hidden">
        {mobileItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/app'}
            // Sem rótulo na tela, o nome ainda precisa existir para quem usa
            // leitor de tela e para quem segura o dedo no ícone.
            title={item.label}
            aria-label={item.label}
            className={({ isActive }) =>
              cn(
                // `flex-1` com `min-w-0`: todos dividem a largura por igual e
                // nenhum empurra a barra para fora da tela.
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                // Sem rótulo sobra altura para o ícone respirar; com rótulo o
                // texto já ocupa a linha de baixo e o espaço vem dele.
                cabeRotulo ? 'py-2.5' : 'py-4',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            <item.icon className="size-6 shrink-0" />
            {cabeRotulo ? <span className="truncate px-1">{item.label}</span> : null}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

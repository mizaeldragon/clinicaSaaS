import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { PaymentGate } from './PaymentGate';
import { useRealtime } from '@/hooks/useRealtime';
import { useAuthStore } from '@/stores/auth.store';
import { BLOCKING_ACCESS } from '@/types';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const refreshContext = useAuthStore((s) => s.refreshContext);
  const access = useAuthStore((s) => s.company?.access);
  const shellRef = useRef<HTMLDivElement>(null);

  // Teste encerrado, mensalidade vencida ou primeiro pagamento pendente: o
  // painel fica atrás do aviso de pagamento. As configurações continuam
  // abertas — é lá que se troca de plano ou se corrige um CPF/CNPJ que o Asaas
  // recusou, e sem isso não haveria como gerar a fatura.
  const blocked =
    access &&
    BLOCKING_ACCESS.has(access.kind) &&
    !location.pathname.startsWith('/app/configuracoes')
      ? access
      : null;

  // `inert` tira o painel de trás do alcance do teclado e do leitor de tela;
  // o fundo escurecido sozinho só impede o clique. O React 18 não conhece o
  // atributo, então vai direto no elemento.
  useEffect(() => {
    shellRef.current?.toggleAttribute('inert', Boolean(blocked));
  }, [blocked]);

  useRealtime();

  // Sincroniza módulos/permissões ao entrar no app.
  useEffect(() => {
    refreshContext().catch(() => undefined);
  }, [refreshContext]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  /*
   * No celular a navegação é só a gaveta do hambúrguer.
   *
   * Houve uma barra fixa embaixo, e ela não coube: com nove telas, ou os
   * ícones ficavam sem nome, ou a barra precisava rolar — e o que precisa ser
   * arrastado para aparecer está tão escondido quanto na gaveta. A gaveta ao
   * menos mostra todos os itens com nome, agrupados.
   */
  return (
    <div className="min-h-screen bg-shell">
      {blocked ? <PaymentGate access={blocked} /> : null}

      <div ref={shellRef}>
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
          <main className="px-3 pb-6 pt-2 lg:px-5 lg:pt-3">
            <div className="mx-auto w-full max-w-[1400px] rounded-2xl bg-card p-4 shadow-panel sm:p-6 lg:p-7">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

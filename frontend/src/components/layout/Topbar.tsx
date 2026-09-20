import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Settings, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationMutations, useNotifications } from '@/api/queries';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger, UserAvatar } from '@/components/ui/primitives';
import { USER_ROLE } from '@/config/labels';
import { fromNow } from '@/lib/format';
import { avisoLigado, definirAviso, tocarAviso } from '@/lib/aviso-sonoro';
import { cn } from '@/lib/utils';

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const navigate = useNavigate();
  const { user, company, logout } = useAuthStore();
  const { data: notifications } = useNotifications({ perPage: 8 });
  const { markAsRead, markAllAsRead } = useNotificationMutations();

  const unread = notifications?.unread ?? 0;
  const [somLigado, setSomLigado] = useState(avisoLigado);
  // Controlado para poder fechar sozinho quando o clique leva para a agenda.
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);

  /**
   * O clique na notificação leva ao que ela avisa.
   *
   * Marcar como lida era tudo o que acontecia antes — e o aviso "Novo
   * agendamento, Ana Paula, 22/09 às 09:30" deixava a pessoa procurando esse
   * horário na agenda, às vezes em outro mês. Quando a notificação carrega o
   * atendimento, a agenda abre nele.
   */
  function abrirNotificacao(item: { id: string; data: Record<string, unknown> | null }) {
    markAsRead.mutate(item.id);

    const appointmentId = item.data?.appointmentId;
    if (typeof appointmentId !== 'string') return;

    setNotificacoesAbertas(false);
    navigate(`/app/agenda?atendimento=${appointmentId}`);
  }

  async function alternarSom() {
    const ligando = !somLigado;
    setSomLigado(ligando);
    definirAviso(ligando);

    // O clique que liga é o gesto que o navegador exige para liberar áudio.
    // Tocar agora confirma pelo ouvido que o aviso vai funcionar de verdade —
    // e denuncia na hora se o som do aparelho estiver mudo.
    if (ligando) {
      const tocou = await tocarAviso();
      if (!tocou) {
        toast('Não consegui tocar o som', {
          description: 'O navegador ou o som do aparelho está bloqueando o áudio.',
        });
      }
    }
  }

  return (
    // Sem linha embaixo e na cor do quadro, não do cartão: o que separa o
    // cabeçalho do conteúdo agora é o cartão flutuante, não um traço. Opaco de
    // propósito — o conteúdo desliza por baixo dele ao rolar.
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-shell px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label="Abrir menu">
        <Menu />
      </Button>

      <div className="min-w-0 flex-1" />

      <Button
        variant="ghost"
        size="icon"
        onClick={alternarSom}
        aria-pressed={somLigado}
        aria-label={somLigado ? 'Desligar aviso sonoro' : 'Ligar aviso sonoro'}
        title={
          somLigado
            ? 'Aviso sonoro ligado — toca quando chega agendamento'
            : 'Aviso sonoro desligado'
        }
      >
        {somLigado ? <Volume2 /> : <VolumeX className="text-muted-foreground" />}
      </Button>

      <Popover open={notificacoesAbertas} onOpenChange={setNotificacoesAbertas}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
            <Bell />
            {unread > 0 ? (
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[340px] p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Notificações</p>
            {unread > 0 ? (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => markAllAsRead.mutate()}
              >
                Marcar todas como lidas
              </button>
            ) : null}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {notifications?.data.length ? (
              notifications.data.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => abrirNotificacao(item)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                    !item.readAt && 'bg-primary/5',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {!item.readAt ? <span className="size-2 shrink-0 rounded-full bg-primary" /> : null}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                  <p className="text-[11px] text-muted-foreground/70">{fromNow(item.createdAt)}</p>
                </button>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação por aqui
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-secondary"
          >
            {/* Identidade da empresa: logo e nome que o cliente cadastrou. */}
            <UserAvatar name={company?.name} src={company?.logoUrl} className="size-8" />
            <div className="hidden text-left sm:block">
              <p className="max-w-[160px] truncate text-sm font-medium leading-tight">
                {company?.name}
              </p>
              <p className="text-[11px] leading-tight text-muted-foreground">
                {user ? USER_ROLE[user.role] : ''}
              </p>
            </div>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{user?.name}</span>
            <span className="text-xs font-normal">{user?.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/app/configuracoes')}>
            <Settings />
            Configurações
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onSelect={async () => {
              await logout();
              navigate('/login');
            }}
          >
            <LogOut />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

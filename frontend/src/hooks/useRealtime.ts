import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { avisoLigado, ouvirPrimeiroGesto, tocarAviso } from '@/lib/aviso-sonoro';

/** O que interessa do agendamento que chegou pelo socket. */
interface AgendamentoRecebido {
  source?: string;
  createdById?: string | null;
}

let socket: Socket | null = null;

/**
 * Onde o WebSocket se conecta.
 *
 * Em desenvolvimento o painel e a API saem da mesma origem, porque o Vite faz
 * proxy — daí `window.location.origin` bastar. Em produção eles moram em
 * domínios diferentes (o painel na Vercel, a API no Railway), e apontar para a
 * própria origem faria o socket bater na Vercel, que não tem WebSocket nenhum.
 *
 * Então a origem sai da mesma variável que já configura o REST: de
 * `https://api.exemplo.com.br/api/v1` fica `https://api.exemplo.com.br`.
 */
function socketOrigin(): string {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return window.location.origin;

  try {
    return new URL(apiUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

/**
 * Conecta ao WebSocket e mantém as telas sincronizadas em tempo real:
 * um agendamento criado na recepção aparece na agenda do profissional.
 */
export function useRealtime() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const meuId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  // Deixa o áudio pronto antes de precisar dele: o navegador só libera som
  // depois de um gesto, e o gesto quase sempre acontece muito antes do
  // primeiro agendamento chegar.
  useEffect(() => ouvirPrimeiroGesto(), []);

  useEffect(() => {
    if (!accessToken) return;

    socket = io(socketOrigin(), {
      auth: { token: accessToken },
      // Começa por polling e faz upgrade: evita falha quando há proxy no meio.
      transports: ['polling', 'websocket'],
    });

    const invalidateAgenda = () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    };

    socket.on('appointment.created', (agendamento: AgendamentoRecebido) => {
      invalidateAgenda();

      // Quem marcou não precisa ser avisado do que acabou de fazer — o aviso
      // existe para quem está de costas para a tela. Agendamento do site vem
      // sem autor, então sempre toca.
      const fuiEu = Boolean(agendamento?.createdById) && agendamento.createdById === meuId;
      if (!fuiEu && avisoLigado()) void tocarAviso();
    });
    socket.on('appointment.updated', invalidateAgenda);
    socket.on('appointment.deleted', invalidateAgenda);

    socket.on('resource.status.changed', () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['resource-stats'] });
    });

    socket.on('rental.payment.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      queryClient.invalidateQueries({ queryKey: ['rental-payments'] });
      queryClient.invalidateQueries({ queryKey: ['rental-stats'] });
    });

    socket.on('financial.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-dashboard'] });
    });

    socket.on('notification.created', (notification: { title: string; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast(notification.title, { description: notification.message });
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [accessToken, queryClient, meuId]);
}

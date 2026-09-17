import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Mantém a lista de horários viva enquanto a cliente decide.
 *
 * O intervalo entre abrir a página e tocar num horário é onde o agendamento
 * duplo nasce: duas pessoas olham a mesma lista, uma marca, e a outra continua
 * vendo um horário que já não existe. O servidor recusa a segunda — mas depois
 * de ela preencher nome e telefone, que é o pior momento possível para receber
 * um "escolha outro".
 *
 * Aqui a conexão entra **sem login**, porque quem está olhando não tem conta.
 * Ela pede para ouvir apenas a sala da empresa cujo link está aberto, e o
 * evento chega vazio: só diz "consulte de novo". Os horários continuam vindo
 * pela mesma rota pública de sempre, com as mesmas regras — nada de dado
 * sensível trafega pelo socket.
 */

function origemDoSocket(): string {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return window.location.origin;
  try {
    return new URL(apiUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export function useAgendaPublicaAoVivo(slug: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!slug) return;

    let socket: Socket | null = null;

    try {
      socket = io(origemDoSocket(), {
        auth: { publicSlug: slug },
        transports: ['polling', 'websocket'],
        // A página de agendamento costuma ficar aberta em rede de celular:
        // reconectar sozinha importa mais aqui que no painel.
        reconnectionDelayMax: 8000,
      });

      socket.on('public.agenda.changed', () => {
        queryClient.invalidateQueries({ queryKey: ['public-availability'] });
        queryClient.invalidateQueries({ queryKey: ['public-agenda'] });
      });
    } catch {
      // Sem tempo real a página continua funcionando: o servidor ainda recusa
      // horário ocupado, e a consulta se refaz ao voltar para a aba.
    }

    return () => {
      socket?.disconnect();
    };
  }, [slug, queryClient]);
}

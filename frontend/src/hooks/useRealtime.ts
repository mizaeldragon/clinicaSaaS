import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';

let socket: Socket | null = null;

/**
 * Conecta ao WebSocket e mantém as telas sincronizadas em tempo real:
 * um agendamento criado na recepção aparece na agenda do profissional.
 */
export function useRealtime() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) return;

    socket = io(window.location.origin, {
      auth: { token: accessToken },
      // Começa por polling e faz upgrade: evita falha quando há proxy no meio.
      transports: ['polling', 'websocket'],
    });

    const invalidateAgenda = () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    };

    socket.on('appointment.created', invalidateAgenda);
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
  }, [accessToken, queryClient]);
}

import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer, Socket } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from '../shared/utils/jwt';
import { logger } from '../shared/utils/logger';

let io: SocketServer | null = null;

export const SOCKET_EVENTS = {
  appointmentCreated: 'appointment.created',
  appointmentUpdated: 'appointment.updated',
  appointmentDeleted: 'appointment.deleted',
  resourceStatusChanged: 'resource.status.changed',
  notificationCreated: 'notification.created',
  rentalPaymentUpdated: 'rental.payment.updated',
  financialUpdated: 'financial.updated',
  /**
   * Avisa a página pública de agendamento que a agenda mudou.
   *
   * Vai sem carga nenhuma, de propósito: quem escuta e o navegador de uma
   * cliente sem login. O evento só diz "consulte de novo", e a consulta passa
   * pelas mesmas regras de sempre.
   */
  agendaPublicaMudou: 'public.agenda.changed',
} as const;

export function initSocket(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: { origin: env.corsOrigins, credentials: true },
    path: '/socket.io',
  });

  io.use((socket: Socket, next) => {
    try {
      /**
       * A página pública de agendamento entra sem token.
       *
       * Ela pede apenas para ouvir uma sala: a da empresa cujo link está
       * aberto. Não recebe nenhum dos eventos do painel, não entra em sala de
       * usuário nem de profissional, e o único evento daquela sala vai vazio.
       * O pior que alguém consegue, sabendo o slug, é descobrir *que* a agenda
       * mudou — e a lista de horários já é pública por natureza.
       */
      const slugPublico = socket.handshake.auth?.publicSlug as string | undefined;
      if (slugPublico) {
        socket.data.publicSlug = String(slugPublico).slice(0, 80);
        return next();
      }

      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.replace('Bearer ', '') as string | undefined);

      if (!token) return next(new Error('Token não informado'));

      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.companyId = payload.companyId;
      socket.data.professionalId = payload.professionalId ?? null;
      return next();
    } catch {
      return next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const slugPublico = socket.data.publicSlug as string | undefined;
    if (slugPublico) {
      socket.join(salaPublica(slugPublico));
      return;
    }

    const { companyId, professionalId, userId } = socket.data as {
      companyId: string | null;
      professionalId: string | null;
      userId: string;
    };

    if (companyId) socket.join(`company:${companyId}`);
    if (professionalId) socket.join(`professional:${professionalId}`);
    socket.join(`user:${userId}`);

    logger.debug({ userId, companyId }, 'Socket conectado');

    socket.on('disconnect', () => {
      logger.debug({ userId }, 'Socket desconectado');
    });
  });

  return io;
}

function salaPublica(slug: string): string {
  return `public:${slug}`;
}

/**
 * Avisa quem está com o link de agendamento aberto que a agenda mudou.
 *
 * Sem carga: o navegador da cliente refaz a consulta de disponibilidade, que é
 * onde as regras vivem. Mandar os horários pelo evento seria repetir a regra em
 * dois lugares e arriscar que divirjam.
 */
export function emitirParaPaginaPublica(slug: string): void {
  io?.to(salaPublica(slug)).emit(SOCKET_EVENTS.agendaPublicaMudou);
}

export function emitToCompany(companyId: string, event: string, payload: unknown): void {
  io?.to(`company:${companyId}`).emit(event, payload);
}

export function emitToProfessional(professionalId: string, event: string, payload: unknown): void {
  io?.to(`professional:${professionalId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function getIO(): SocketServer | null {
  return io;
}

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
} as const;

export function initSocket(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: { origin: env.corsOrigins, credentials: true },
    path: '/socket.io',
  });

  io.use((socket: Socket, next) => {
    try {
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

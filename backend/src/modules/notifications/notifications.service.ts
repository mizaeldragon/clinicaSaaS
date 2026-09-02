import { NotificationChannel, NotificationEvent, Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { NotFoundError } from '../../shared/errors/AppError';
import { getPagination, paginated } from '../../shared/utils/http';
import { SOCKET_EVENTS, emitToCompany, emitToUser } from '../../websocket/io';
import { JOB_NAMES, QUEUE_NAMES, enqueue } from '../../queues';
import { logger } from '../../shared/utils/logger';

interface NotifyInput {
  title: string;
  message: string;
  data?: Record<string, unknown>;
  userId?: string | null;
  channel?: NotificationChannel;
}

export const notificationsService = {
  async list(query: { page?: number; perPage?: number; unreadOnly?: boolean; userId?: string }) {
    const pagination = getPagination(query);
    const where: Prisma.NotificationWhereInput = {
      ...(query.unreadOnly ? { readAt: null } : {}),
      ...(query.userId ? { OR: [{ userId: query.userId }, { userId: null }] } : {}),
    };

    const [data, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);

    return { ...paginated(data, total, pagination), unread };
  },

  async markAsRead(id: string) {
    const notification = await prisma.notification.findFirst({ where: { id } });
    if (!notification) throw new NotFoundError('Notificação');
    return prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  },

  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { readAt: null, OR: [{ userId }, { userId: null }] },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  },

  /**
   * Cria uma notificação e a entrega em tempo real.
   * Canais externos (e-mail/WhatsApp) são despachados via fila.
   */
  async notifyEvent(companyId: string, event: NotificationEvent, input: NotifyInput) {
    try {
      const notification = await tenantContext.runAsSystem(() =>
        prisma.notification.create({
          data: {
            companyId,
            userId: input.userId ?? null,
            channel: input.channel ?? NotificationChannel.IN_APP,
            event,
            title: input.title,
            message: input.message,
            data: (input.data ?? undefined) as never,
            sentAt: new Date(),
          },
        }),
      );

      if (input.userId) {
        emitToUser(input.userId, SOCKET_EVENTS.notificationCreated, notification);
      } else {
        emitToCompany(companyId, SOCKET_EVENTS.notificationCreated, notification);
      }

      if (notification.channel !== NotificationChannel.IN_APP) {
        await enqueue(QUEUE_NAMES.notifications, JOB_NAMES.sendNotification, {
          notificationId: notification.id,
          companyId,
        });
      }

      return notification;
    } catch (error) {
      logger.warn({ error, event }, 'Falha ao criar notificação');
      return null;
    }
  },
};

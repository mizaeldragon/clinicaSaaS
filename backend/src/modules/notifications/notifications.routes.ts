import { Router } from 'express';
import { z } from 'zod';
import { notificationsService } from './notifications.service';
import { validate } from '../../shared/middlewares/validate';
import { asyncHandler, serialize } from '../../shared/utils/http';

export const notificationsRoutes = Router();

// Notificações internas ficam disponíveis para todos os usuários autenticados,
// independentemente do módulo — é o canal de avisos do próprio sistema.

notificationsRoutes.get(
  '/',
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      perPage: z.coerce.number().int().min(1).max(100).optional(),
      unreadOnly: z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.json(
      serialize(
        await notificationsService.list({
          ...(req.query as Record<string, never>),
          userId: req.user!.id,
        }),
      ),
    );
  }),
);

notificationsRoutes.post(
  '/:id/read',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await notificationsService.markAsRead(req.params.id)));
  }),
);

notificationsRoutes.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    res.json(await notificationsService.markAllAsRead(req.user!.id));
  }),
);

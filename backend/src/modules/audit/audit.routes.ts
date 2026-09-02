import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { asyncHandler, getPagination, paginated, serialize } from '../../shared/utils/http';

export const auditRoutes = Router();

auditRoutes.use(requirePermission(PERMISSIONS.settingsManage));

auditRoutes.get(
  '/',
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      perPage: z.coerce.number().int().min(1).max(100).optional(),
      entity: z.string().optional(),
      entityId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
      action: z.string().optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as {
      page?: number;
      perPage?: number;
      entity?: string;
      entityId?: string;
      userId?: string;
      action?: string;
      from?: Date;
      to?: Date;
    };

    const pagination = getPagination(query);

    const where: Prisma.AuditLogWhereInput = {
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.action ? { action: { contains: query.action } } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json(serialize(paginated(data, total, pagination)));
  }),
);

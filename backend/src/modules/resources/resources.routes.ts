import { Router } from 'express';
import { z } from 'zod';
import { resourceCategoriesService, resourcesService } from './resources.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { requireModule } from '../../shared/middlewares/moduleGuard';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';
import {
  changeStatusSchema,
  createResourceCategorySchema,
  createResourceSchema,
  idParamSchema,
  listResourcesSchema,
  updateResourceCategorySchema,
  updateResourceSchema,
} from './resources.schema';

export const resourcesRoutes = Router();

resourcesRoutes.use(requireModule('resources'), requirePermission(PERMISSIONS.resourcesView));

// ---------------------------------------------------------------- categorias
resourcesRoutes.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.json(serialize(await resourceCategoriesService.list()));
  }),
);

resourcesRoutes.post(
  '/categories',
  requirePermission(PERMISSIONS.resourcesManage),
  validate({ body: createResourceCategorySchema }),
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(serialize(await resourceCategoriesService.create(req.companyId as string, req.body)));
  }),
);

resourcesRoutes.patch(
  '/categories/:id',
  requirePermission(PERMISSIONS.resourcesManage),
  validate({ params: idParamSchema, body: updateResourceCategorySchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await resourceCategoriesService.update(req.params.id, req.body)));
  }),
);

resourcesRoutes.delete(
  '/categories/:id',
  requirePermission(PERMISSIONS.resourcesManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await resourceCategoriesService.remove(req.params.id);
    res.status(204).send();
  }),
);

// ------------------------------------------------------------------ recursos
resourcesRoutes.get(
  '/',
  validate({ query: listResourcesSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await resourcesService.list(req.query as never)));
  }),
);

resourcesRoutes.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    res.json(await resourcesService.stats());
  }),
);

resourcesRoutes.get(
  '/occupancy',
  validate({ query: z.object({ date: z.coerce.date().optional() }) }),
  asyncHandler(async (req, res) => {
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    res.json(serialize(await resourcesService.occupancy(date)));
  }),
);

resourcesRoutes.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await resourcesService.get(req.params.id)));
  }),
);

resourcesRoutes.post(
  '/',
  requirePermission(PERMISSIONS.resourcesManage),
  validate({ body: createResourceSchema }),
  asyncHandler(async (req, res) => {
    const resource = await resourcesService.create(req.companyId as string, req.body);
    await recordAudit({
      action: 'resource.created',
      entity: 'Resource',
      entityId: resource.id,
      after: req.body,
      ip: req.ip,
    });
    res.status(201).json(serialize(resource));
  }),
);

resourcesRoutes.patch(
  '/:id',
  requirePermission(PERMISSIONS.resourcesManage),
  validate({ params: idParamSchema, body: updateResourceSchema }),
  asyncHandler(async (req, res) => {
    res.json(
      serialize(await resourcesService.update(req.companyId as string, req.params.id, req.body)),
    );
  }),
);

resourcesRoutes.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.resourcesManage),
  validate({ params: idParamSchema, body: changeStatusSchema }),
  asyncHandler(async (req, res) => {
    res.json(
      serialize(
        await resourcesService.changeStatus(
          req.companyId as string,
          req.params.id,
          req.body.status,
        ),
      ),
    );
  }),
);

resourcesRoutes.delete(
  '/:id',
  requirePermission(PERMISSIONS.resourcesManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await resourcesService.remove(req.params.id);
    await recordAudit({
      action: 'resource.removed',
      entity: 'Resource',
      entityId: req.params.id,
      ip: req.ip,
    });
    res.status(204).send();
  }),
);

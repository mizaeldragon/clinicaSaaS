import { Router } from 'express';
import { serviceCategoriesService, servicesService } from './services.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { requireModule } from '../../shared/middlewares/moduleGuard';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';
import {
  createCategorySchema,
  createServiceSchema,
  idParamSchema,
  listServicesSchema,
  updateCategorySchema,
  updateServiceSchema,
} from './services.schema';

export const servicesRoutes = Router();

servicesRoutes.use(requireModule('services'), requirePermission(PERMISSIONS.servicesView));

// ---------------------------------------------------------------- categorias
servicesRoutes.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.json(serialize(await serviceCategoriesService.list()));
  }),
);

servicesRoutes.post(
  '/categories',
  requirePermission(PERMISSIONS.servicesManage),
  validate({ body: createCategorySchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(serialize(await serviceCategoriesService.create(req.body)));
  }),
);

servicesRoutes.patch(
  '/categories/:id',
  requirePermission(PERMISSIONS.servicesManage),
  validate({ params: idParamSchema, body: updateCategorySchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await serviceCategoriesService.update(req.params.id, req.body)));
  }),
);

servicesRoutes.delete(
  '/categories/:id',
  requirePermission(PERMISSIONS.servicesManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await serviceCategoriesService.remove(req.params.id);
    res.status(204).send();
  }),
);

// ------------------------------------------------------------------ serviços
servicesRoutes.get(
  '/',
  validate({ query: listServicesSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await servicesService.list(req.query as never)));
  }),
);

servicesRoutes.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await servicesService.get(req.params.id)));
  }),
);

servicesRoutes.post(
  '/',
  requirePermission(PERMISSIONS.servicesManage),
  validate({ body: createServiceSchema }),
  asyncHandler(async (req, res) => {
    const service = await servicesService.create(req.companyId as string, req.body);
    await recordAudit({ action: 'service.created', entity: 'Service', entityId: service.id, after: req.body, ip: req.ip });
    res.status(201).json(serialize(service));
  }),
);

servicesRoutes.patch(
  '/:id',
  requirePermission(PERMISSIONS.servicesManage),
  validate({ params: idParamSchema, body: updateServiceSchema }),
  asyncHandler(async (req, res) => {
    const service = await servicesService.update(req.companyId as string, req.params.id, req.body);
    await recordAudit({ action: 'service.updated', entity: 'Service', entityId: service.id, after: req.body, ip: req.ip });
    res.json(serialize(service));
  }),
);

servicesRoutes.delete(
  '/:id',
  requirePermission(PERMISSIONS.servicesManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await servicesService.remove(req.params.id);
    await recordAudit({ action: 'service.removed', entity: 'Service', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  }),
);

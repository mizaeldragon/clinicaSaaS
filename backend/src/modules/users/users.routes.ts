import { Router } from 'express';
import { usersService } from './users.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, ROLE_PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';
import { createUserSchema, idParamSchema, listUsersSchema, updateUserSchema } from './users.schema';

export const usersRoutes = Router();

usersRoutes.use(requirePermission(PERMISSIONS.usersManage));

/** Catálogo de permissões para montar a tela de perfis configuráveis. */
usersRoutes.get('/permissions', (_req, res) => {
  res.json({
    permissions: Object.values(PERMISSIONS),
    rolePresets: ROLE_PERMISSIONS,
  });
});

usersRoutes.get(
  '/',
  validate({ query: listUsersSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await usersService.list(req.companyId as string, req.query as never)));
  }),
);

usersRoutes.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await usersService.get(req.companyId as string, req.params.id)));
  }),
);

usersRoutes.post(
  '/',
  validate({ body: createUserSchema }),
  asyncHandler(async (req, res) => {
    const user = await usersService.create(req.companyId as string, req.body);
    await recordAudit({ action: 'user.created', entity: 'User', entityId: user.id, after: { email: user.email, role: user.role }, ip: req.ip });
    res.status(201).json(serialize(user));
  }),
);

usersRoutes.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateUserSchema }),
  asyncHandler(async (req, res) => {
    const user = await usersService.update(
      req.companyId as string,
      req.params.id,
      req.body,
      req.user!.id,
    );
    await recordAudit({ action: 'user.updated', entity: 'User', entityId: user.id, after: req.body, ip: req.ip });
    res.json(serialize(user));
  }),
);

usersRoutes.delete(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await usersService.remove(req.companyId as string, req.params.id, req.user!.id);
    await recordAudit({ action: 'user.deactivated', entity: 'User', entityId: req.params.id, ip: req.ip });
    res.status(204).send();
  }),
);

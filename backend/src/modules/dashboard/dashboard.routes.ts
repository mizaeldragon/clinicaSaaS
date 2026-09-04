import { Router } from 'express';
import { dashboardService } from './dashboard.service';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { asyncHandler, serialize } from '../../shared/utils/http';

export const dashboardRoutes = Router();

dashboardRoutes.get(
  '/',
  requirePermission(PERMISSIONS.dashboardView),
  asyncHandler(async (req, res) => {
    const viewer = {
      permissions: req.user?.permissions ?? [],
      isAdmin: req.user?.role === 'COMPANY_ADMIN' || req.user?.role === 'SUPER_ADMIN',
    };
    res.json(serialize(await dashboardService.overview(req.enabledModules ?? [], viewer)));
  }),
);

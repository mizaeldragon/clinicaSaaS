import { Router } from 'express';
import { dashboardService } from './dashboard.service';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { asyncHandler, serialize } from '../../shared/utils/http';

export const dashboardRoutes = Router();

dashboardRoutes.get(
  '/',
  requirePermission(PERMISSIONS.dashboardView),
  asyncHandler(async (req, res) => {
    res.json(serialize(await dashboardService.overview(req.enabledModules ?? [])));
  }),
);

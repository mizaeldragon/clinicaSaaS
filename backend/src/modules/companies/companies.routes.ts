import { Router } from 'express';
import { companiesController } from './companies.controller';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { asyncHandler } from '../../shared/utils/http';
import { businessHoursSchema, toggleModuleSchema, updateCompanySchema } from './companies.schema';

export const companiesRoutes = Router();

companiesRoutes.get('/', asyncHandler(companiesController.show));

companiesRoutes.patch(
  '/',
  requirePermission(PERMISSIONS.settingsManage),
  validate({ body: updateCompanySchema }),
  asyncHandler(companiesController.update),
);

companiesRoutes.put(
  '/business-hours',
  requirePermission(PERMISSIONS.settingsManage),
  validate({ body: businessHoursSchema }),
  asyncHandler(companiesController.businessHours),
);

companiesRoutes.get('/modules', asyncHandler(companiesController.listModules));

companiesRoutes.patch(
  '/modules',
  requirePermission(PERMISSIONS.settingsManage),
  validate({ body: toggleModuleSchema }),
  asyncHandler(companiesController.toggleModule),
);

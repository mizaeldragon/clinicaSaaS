import { Router } from 'express';
import { z } from 'zod';
import { companiesController } from './companies.controller';
import { holidaysService } from './holidays.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { asyncHandler, serialize } from '../../shared/utils/http';
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

/* ------------------------------------------------------ feriados e folgas */

companiesRoutes.get(
  '/holidays',
  validate({ query: z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() }) }),
  asyncHandler(async (req, res) => {
    const { year } = req.query as unknown as { year?: number };
    res.json(serialize(await holidaysService.list(year)));
  }),
);

companiesRoutes.post(
  '/holidays',
  requirePermission(PERMISSIONS.settingsManage),
  validate({
    body: z.object({
      date: z.coerce.date(),
      name: z.string().min(2, 'Dê um nome ao fechamento').max(120),
    }),
  }),
  asyncHandler(async (req, res) => {
    const holiday = await holidaysService.create(req.companyId as string, req.body);
    res.status(201).json(serialize(holiday));
  }),
);

/** Traz a lista oficial do ano sem sobrescrever fechamentos próprios. */
companiesRoutes.post(
  '/holidays/import',
  requirePermission(PERMISSIONS.settingsManage),
  validate({ body: z.object({ year: z.coerce.number().int().min(2000).max(2100) }) }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await holidaysService.importNational(req.companyId as string, req.body.year)));
  }),
);

companiesRoutes.delete(
  '/holidays/:id',
  requirePermission(PERMISSIONS.settingsManage),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    await holidaysService.remove(req.params.id);
    res.status(204).send();
  }),
);

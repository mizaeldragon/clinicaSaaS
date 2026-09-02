import { Router } from 'express';
import { onboardingService } from './onboarding.service';
import { onboardingSchema } from './onboarding.schema';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { asyncHandler } from '../../shared/utils/http';
import { serialize } from '../../shared/utils/http';
import { COMPANY_TYPE_LABELS } from '../companies/company.constants';
import {
  ONBOARDING_SERVICE_CATALOG,
  RENTAL_RESOURCE_TYPES,
} from './onboarding.constants';

export const onboardingRoutes = Router();

/** Opções exibidas no wizard (tipos de empresa, serviços, recursos). */
onboardingRoutes.get('/options', (_req, res) => {
  res.json({
    companyTypes: Object.entries(COMPANY_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    services: ONBOARDING_SERVICE_CATALOG.map((s) => ({
      key: s.key,
      label: s.label,
      category: s.category,
    })),
    rentalResources: RENTAL_RESOURCE_TYPES.map((r) => ({ key: r.key, label: r.label })),
  });
});

onboardingRoutes.get(
  '/status',
  asyncHandler(async (req, res) => {
    res.json(serialize(await onboardingService.status(req.companyId as string)));
  }),
);

onboardingRoutes.post(
  '/preview',
  validate({ body: onboardingSchema }),
  asyncHandler(async (req, res) => {
    res.json(onboardingService.preview(req.body));
  }),
);

onboardingRoutes.post(
  '/complete',
  requirePermission(PERMISSIONS.settingsManage),
  validate({ body: onboardingSchema }),
  asyncHandler(async (req, res) => {
    const result = await onboardingService.complete(req.companyId as string, req.body);
    res.json(serialize(result));
  }),
);

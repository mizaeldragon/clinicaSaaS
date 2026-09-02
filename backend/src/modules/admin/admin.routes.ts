import { Router } from 'express';
import { z } from 'zod';
import { BillingInterval, CompanyStatus, CompanyType, ModuleKey } from '@prisma/client';
import { adminService } from './admin.service';
import { validate } from '../../shared/middlewares/validate';
import { requireSuperAdmin } from '../../shared/middlewares/rbac';
import { asyncHandler, serialize } from '../../shared/utils/http';

export const adminRoutes = Router();

adminRoutes.use(requireSuperAdmin);

const idParamSchema = z.object({ id: z.string().uuid() });

adminRoutes.get(
  '/metrics',
  asyncHandler(async (_req, res) => {
    res.json(serialize(await adminService.metrics()));
  }),
);

// ------------------------------------------------------------------ empresas
adminRoutes.get(
  '/companies',
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      perPage: z.coerce.number().int().min(1).max(100).optional(),
      search: z.string().trim().optional(),
      status: z.nativeEnum(CompanyStatus).optional(),
      planSlug: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await adminService.listCompanies(req.query as never)));
  }),
);

adminRoutes.get(
  '/companies/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await adminService.getCompany(req.params.id)));
  }),
);

adminRoutes.post(
  '/companies',
  validate({
    body: z.object({
      name: z.string().min(2).max(120),
      type: z.nativeEnum(CompanyType).optional(),
      planSlug: z.string().min(1),
      adminName: z.string().min(2).max(120),
      adminEmail: z.string().email().toLowerCase(),
      adminPassword: z.string().min(8).max(72),
      trialDays: z.coerce.number().int().min(0).max(365).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    res.status(201).json(serialize(await adminService.createCompany(req.body)));
  }),
);

adminRoutes.patch(
  '/companies/:id/status',
  validate({ params: idParamSchema, body: z.object({ status: z.nativeEnum(CompanyStatus) }) }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await adminService.setCompanyStatus(req.params.id, req.body.status)));
  }),
);

adminRoutes.patch(
  '/companies/:id/modules',
  validate({
    params: idParamSchema,
    body: z.object({ module: z.nativeEnum(ModuleKey), enabled: z.boolean() }),
  }),
  asyncHandler(async (req, res) => {
    res.json(
      serialize(
        await adminService.setCompanyModule(req.params.id, req.body.module, req.body.enabled),
      ),
    );
  }),
);

adminRoutes.post(
  '/companies/:id/extend-trial',
  validate({
    params: idParamSchema,
    body: z.object({ days: z.coerce.number().int().min(1).max(365) }),
  }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await adminService.extendTrial(req.params.id, req.body.days)));
  }),
);

adminRoutes.patch(
  '/companies/:id/plan',
  validate({ params: idParamSchema, body: z.object({ planSlug: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await adminService.setCompanyPlan(req.params.id, req.body.planSlug)));
  }),
);

// -------------------------------------------------------------------- planos
const planSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen'),
  description: z.string().max(500).nullable().optional(),
  price: z.coerce.number().min(0),
  billingInterval: z.nativeEnum(BillingInterval).default(BillingInterval.MONTHLY),
  trialDays: z.coerce.number().int().min(0).max(365).default(14),
  maxUsers: z.coerce.number().int().min(1).nullable().optional(),
  maxProfessionals: z.coerce.number().int().min(1).nullable().optional(),
  maxAppointmentsMonth: z.coerce.number().int().min(1).nullable().optional(),
  modules: z.array(z.nativeEnum(ModuleKey)).min(1),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

adminRoutes.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    res.json(serialize(await adminService.listPlans()));
  }),
);

adminRoutes.post(
  '/plans',
  validate({ body: planSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(serialize(await adminService.createPlan(req.body)));
  }),
);

adminRoutes.patch(
  '/plans/:id',
  validate({ params: idParamSchema, body: planSchema.partial() }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await adminService.updatePlan(req.params.id, req.body)));
  }),
);

adminRoutes.delete(
  '/plans/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await adminService.removePlan(req.params.id);
    res.status(204).send();
  }),
);

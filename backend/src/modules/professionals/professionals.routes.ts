import { Router } from 'express';
import { z } from 'zod';
import { professionalsService } from './professionals.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { requireModule } from '../../shared/middlewares/moduleGuard';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { ForbiddenError } from '../../shared/errors/AppError';
import { recordAudit } from '../../shared/services/audit.service';
import {
  createProfessionalSchema,
  createTimeOffSchema,
  idParamSchema,
  listProfessionalsSchema,
  setWorkingHoursSchema,
  updateProfessionalSchema,
} from './professionals.schema';

export const professionalsRoutes = Router();

professionalsRoutes.use(
  requireModule('professionals'),
  requirePermission(PERMISSIONS.professionalsView),
);

professionalsRoutes.get(
  '/',
  validate({ query: listProfessionalsSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await professionalsService.list(req.query as never)));
  }),
);

professionalsRoutes.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await professionalsService.get(req.params.id)));
  }),
);

professionalsRoutes.get(
  '/:id/dashboard',
  validate({
    params: idParamSchema,
    query: z.object({ reference: z.coerce.date().optional() }),
  }),
  asyncHandler(async (req, res) => {
    // Profissional só acessa o próprio painel.
    if (req.user?.role === 'PROFESSIONAL' && req.user.professionalId !== req.params.id) {
      throw new ForbiddenError('Você só pode visualizar o próprio painel');
    }
    const reference = req.query.reference ? new Date(req.query.reference as string) : new Date();
    res.json(serialize(await professionalsService.dashboard(req.params.id, reference)));
  }),
);

professionalsRoutes.post(
  '/',
  requirePermission(PERMISSIONS.professionalsManage),
  validate({ body: createProfessionalSchema }),
  asyncHandler(async (req, res) => {
    const professional = await professionalsService.create(req.companyId as string, req.body);
    await recordAudit({
      action: 'professional.created',
      entity: 'Professional',
      entityId: professional.id,
      after: { name: professional.name },
      ip: req.ip,
    });
    res.status(201).json(serialize(professional));
  }),
);

professionalsRoutes.patch(
  '/:id',
  requirePermission(PERMISSIONS.professionalsManage),
  validate({ params: idParamSchema, body: updateProfessionalSchema }),
  asyncHandler(async (req, res) => {
    const professional = await professionalsService.update(
      req.companyId as string,
      req.params.id,
      req.body,
    );
    await recordAudit({
      action: 'professional.updated',
      entity: 'Professional',
      entityId: professional.id,
      after: req.body,
      ip: req.ip,
    });
    res.json(serialize(professional));
  }),
);

professionalsRoutes.put(
  '/:id/working-hours',
  requirePermission(PERMISSIONS.professionalsManage),
  validate({ params: idParamSchema, body: setWorkingHoursSchema }),
  asyncHandler(async (req, res) => {
    res.json(
      serialize(
        await professionalsService.setWorkingHours(
          req.companyId as string,
          req.params.id,
          req.body,
        ),
      ),
    );
  }),
);

professionalsRoutes.post(
  '/:id/time-off',
  requirePermission(PERMISSIONS.professionalsManage),
  validate({ params: idParamSchema, body: createTimeOffSchema }),
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(
        serialize(
          await professionalsService.addTimeOff(req.companyId as string, req.params.id, req.body),
        ),
      );
  }),
);

professionalsRoutes.delete(
  '/time-off/:id',
  requirePermission(PERMISSIONS.professionalsManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await professionalsService.removeTimeOff(req.params.id);
    res.status(204).send();
  }),
);

professionalsRoutes.delete(
  '/:id',
  requirePermission(PERMISSIONS.professionalsManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const resultado = await professionalsService.remove(req.params.id);
    await recordAudit({
      action: resultado.deactivated ? 'professional.deactivated' : 'professional.removed',
      entity: 'Professional',
      entityId: req.params.id,
      ip: req.ip,
    });
    // Responde o que de fato aconteceu, em vez de 204: apagar e inativar são
    // desfechos diferentes, e a tela precisa contar o certo para a pessoa.
    res.json(resultado);
  }),
);

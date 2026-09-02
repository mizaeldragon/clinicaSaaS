import { Router } from 'express';
import { expenseCategoriesService, financialService } from './financial.service';
import { validate } from '../../shared/middlewares/validate';
import { PERMISSIONS, requirePermission } from '../../shared/middlewares/rbac';
import { requireModule } from '../../shared/middlewares/moduleGuard';
import { asyncHandler, serialize } from '../../shared/utils/http';
import { recordAudit } from '../../shared/services/audit.service';
import {
  createTransactionSchema,
  dashboardQuerySchema,
  expenseCategorySchema,
  idParamSchema,
  listTransactionsSchema,
  payTransactionSchema,
  updateTransactionSchema,
} from './financial.schema';

export const financialRoutes = Router();

financialRoutes.use(requireModule('financial'), requirePermission(PERMISSIONS.financialView));

financialRoutes.get(
  '/dashboard',
  validate({ query: dashboardQuerySchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await financialService.dashboard(req.query as never)));
  }),
);

financialRoutes.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.json(serialize(await expenseCategoriesService.list()));
  }),
);

financialRoutes.post(
  '/categories',
  requirePermission(PERMISSIONS.financialManage),
  validate({ body: expenseCategorySchema }),
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(serialize(await expenseCategoriesService.create(req.companyId as string, req.body)));
  }),
);

financialRoutes.delete(
  '/categories/:id',
  requirePermission(PERMISSIONS.financialManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await expenseCategoriesService.remove(req.params.id);
    res.status(204).send();
  }),
);

financialRoutes.get(
  '/transactions',
  validate({ query: listTransactionsSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await financialService.list(req.query as never)));
  }),
);

financialRoutes.get(
  '/transactions/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(serialize(await financialService.get(req.params.id)));
  }),
);

financialRoutes.post(
  '/transactions',
  requirePermission(PERMISSIONS.financialManage),
  validate({ body: createTransactionSchema }),
  asyncHandler(async (req, res) => {
    const transaction = await financialService.create(
      req.companyId as string,
      req.body,
      req.user?.id,
    );
    await recordAudit({
      action: 'financial.created',
      entity: 'FinancialTransaction',
      entityId: transaction.id,
      after: req.body,
      ip: req.ip,
    });
    res.status(201).json(serialize(transaction));
  }),
);

financialRoutes.patch(
  '/transactions/:id',
  requirePermission(PERMISSIONS.financialManage),
  validate({ params: idParamSchema, body: updateTransactionSchema }),
  asyncHandler(async (req, res) => {
    res.json(
      serialize(await financialService.update(req.companyId as string, req.params.id, req.body)),
    );
  }),
);

financialRoutes.post(
  '/transactions/:id/pay',
  requirePermission(PERMISSIONS.financialManage),
  validate({ params: idParamSchema, body: payTransactionSchema }),
  asyncHandler(async (req, res) => {
    const transaction = await financialService.pay(
      req.companyId as string,
      req.params.id,
      req.body,
    );
    await recordAudit({
      action: 'financial.paid',
      entity: 'FinancialTransaction',
      entityId: transaction.id,
      after: req.body,
      ip: req.ip,
    });
    res.json(serialize(transaction));
  }),
);

financialRoutes.delete(
  '/transactions/:id',
  requirePermission(PERMISSIONS.financialManage),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await financialService.remove(req.params.id);
    await recordAudit({
      action: 'financial.removed',
      entity: 'FinancialTransaction',
      entityId: req.params.id,
      ip: req.ip,
    });
    res.status(204).send();
  }),
);

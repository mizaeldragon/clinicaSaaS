import { Router } from 'express';
import { authController } from './auth.controller';
import { subscriptionsService } from '../subscriptions/subscriptions.service';
import { serialize } from '../../shared/utils/http';
import { authenticate } from '../../shared/middlewares/auth';
import { validate } from '../../shared/middlewares/validate';
import { authRateLimiter } from '../../shared/middlewares/rateLimit';
import { asyncHandler } from '../../shared/utils/http';
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerCompanySchema,
} from './auth.schema';

export const authRoutes = Router();

authRoutes.post(
  '/login',
  authRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(authController.login),
);

authRoutes.post(
  '/register',
  authRateLimiter,
  validate({ body: registerCompanySchema }),
  asyncHandler(authController.register),
);

authRoutes.post('/refresh', validate({ body: refreshSchema }), asyncHandler(authController.refresh));

authRoutes.post('/logout', asyncHandler(authController.logout));

authRoutes.post('/logout-all', authenticate, asyncHandler(authController.logoutAll));

authRoutes.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  asyncHandler(authController.changePassword),
);

authRoutes.get('/me', authenticate, asyncHandler(authController.me));

/** Catálogo público de planos — usado na tela de cadastro. */
authRoutes.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    res.json(serialize(await subscriptionsService.planMatrix()));
  }),
);

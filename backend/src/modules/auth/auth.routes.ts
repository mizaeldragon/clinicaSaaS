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
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerCompanySchema,
  resetPasswordSchema,
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

/**
 * Esqueci a senha. Sob o limitador do login: a rota responde igual para conta
 * que existe e que não existe, mas sem teto alguém a usaria para varrer
 * endereços — e para disparar e-mail em cima de terceiros.
 */
authRoutes.post(
  '/forgot-password',
  authRateLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(authController.forgotPassword),
);

authRoutes.post(
  '/reset-password',
  authRateLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(authController.resetPassword),
);

authRoutes.get('/me', authenticate, asyncHandler(authController.me));

/** Catálogo público de planos — usado na tela de cadastro. */
authRoutes.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    res.json(serialize(await subscriptionsService.planMatrix()));
  }),
);

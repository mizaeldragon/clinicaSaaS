import { Router } from 'express';
import { authenticate } from '../shared/middlewares/auth';
import { tenantMiddleware } from '../shared/middlewares/tenant';
import { authRoutes } from '../modules/auth/auth.routes';
import { companiesRoutes } from '../modules/companies/companies.routes';
import { onboardingRoutes } from '../modules/onboarding/onboarding.routes';
import { usersRoutes } from '../modules/users/users.routes';
import { dashboardRoutes } from '../modules/dashboard/dashboard.routes';
import { customersRoutes } from '../modules/customers/customers.routes';
import { servicesRoutes } from '../modules/services/services.routes';
import { professionalsRoutes } from '../modules/professionals/professionals.routes';
import { appointmentsRoutes } from '../modules/appointments/appointments.routes';
import { resourcesRoutes } from '../modules/resources/resources.routes';
import { rentalsRoutes } from '../modules/rentals/rentals.routes';
import { bookingsRoutes } from '../modules/rentals/bookings.routes';
import { shiftsRoutes } from '../modules/shifts/shifts.routes';
import { publicRoutes } from '../modules/public/public.routes';
import { financialRoutes } from '../modules/financial/financial.routes';
import { commissionsRoutes } from '../modules/commissions/commissions.routes';
import { reportsRoutes } from '../modules/reports/reports.routes';
import { notificationsRoutes } from '../modules/notifications/notifications.routes';
import { subscriptionsRoutes } from '../modules/subscriptions/subscriptions.routes';
import { adminRoutes } from '../modules/admin/admin.routes';
import { auditRoutes } from '../modules/audit/audit.routes';

export const routes = Router();

// -------------------------------------------------------------------- público
routes.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

routes.use('/auth', authRoutes);

// Página pública de agendamento — sem login, isolada pelo slug da empresa.
routes.use('/public/:slug', publicRoutes);

// ------------------------------------------------------------- autenticado
const secured = Router();
secured.use(authenticate, tenantMiddleware);

secured.use('/company', companiesRoutes);
secured.use('/onboarding', onboardingRoutes);
secured.use('/users', usersRoutes);
secured.use('/dashboard', dashboardRoutes);
secured.use('/customers', customersRoutes);
secured.use('/services', servicesRoutes);
secured.use('/professionals', professionalsRoutes);
secured.use('/appointments', appointmentsRoutes);
secured.use('/resources', resourcesRoutes);
secured.use('/shifts', shiftsRoutes);
// Antes de /rentals para que "bookings" não caia na rota /rentals/:id.
secured.use('/rentals/bookings', bookingsRoutes);
secured.use('/rentals', rentalsRoutes);
secured.use('/financial', financialRoutes);
secured.use('/commissions', commissionsRoutes);
secured.use('/reports', reportsRoutes);
secured.use('/notifications', notificationsRoutes);
secured.use('/subscription', subscriptionsRoutes);
secured.use('/audit-logs', auditRoutes);

// Painel do SaaS (super admin)
secured.use('/admin', adminRoutes);

routes.use(secured);

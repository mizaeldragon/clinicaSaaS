import { ModuleKey } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { NotFoundError } from '../../shared/errors/AppError';

export const subscriptionsService = {
  /** Planos disponíveis para contratação. */
  async listPublicPlans() {
    return tenantContext.runAsSystem(() =>
      prisma.plan.findMany({
        where: { isActive: true, isPublic: true },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  },

  async current(companyId: string) {
    const subscription = await tenantContext.runAsSystem(() =>
      prisma.subscription.findUnique({
        where: { companyId },
        include: { plan: true },
      }),
    );
    if (!subscription) throw new NotFoundError('Assinatura');

    const [users, professionals, appointmentsMonth] = await tenantContext.run(
      { companyId },
      async () => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return Promise.all([
          prisma.user.count({ where: { companyId, isActive: true } }),
          prisma.professional.count({ where: { isActive: true } }),
          prisma.appointment.count({ where: { createdAt: { gte: monthStart } } }),
        ]);
      },
    );

    return {
      subscription,
      usage: {
        users: { current: users, limit: subscription.plan.maxUsers },
        professionals: { current: professionals, limit: subscription.plan.maxProfessionals },
        appointments: {
          current: appointmentsMonth,
          limit: subscription.plan.maxAppointmentsMonth,
        },
      },
    };
  },

  /** Módulos disponíveis em cada plano — usado na tela de upgrade. */
  async planMatrix() {
    const plans = await this.listPublicPlans();
    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      price: plan.price,
      description: plan.description,
      trialDays: plan.trialDays,
      limits: {
        users: plan.maxUsers,
        professionals: plan.maxProfessionals,
        appointmentsMonth: plan.maxAppointmentsMonth,
      },
      modules: plan.modules as ModuleKey[],
    }));
  },
};

import { ModuleKey, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import { invalidateCompanyContext } from '../../shared/services/companyContext.service';
import { CORE_MODULES } from '../companies/company.constants';

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

  /**
   * Troca de plano. Os módulos ativos são recalculados: o que não existe no
   * novo plano é desativado automaticamente (mantendo os módulos essenciais).
   */
  async changePlan(companyId: string, planSlug: string) {
    return tenantContext.runAsSystem(async () => {
      const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
      if (!plan || !plan.isActive) throw new NotFoundError('Plano');

      const subscription = await prisma.subscription.findUnique({ where: { companyId } });
      if (!subscription) throw new NotFoundError('Assinatura');

      const currentModules = await prisma.companyModule.findMany({
        where: { companyId, enabled: true },
      });

      const toDisable = currentModules
        .map((m) => m.module)
        .filter((m) => !plan.modules.includes(m) && !CORE_MODULES.includes(m));

      const periodEnd = new Date();
      periodEnd.setMonth(
        periodEnd.getMonth() + (plan.billingInterval === 'YEARLY' ? 12 : plan.billingInterval === 'QUARTERLY' ? 3 : 1),
      );

      await prisma.$transaction([
        prisma.subscription.update({
          where: { companyId },
          data: {
            planId: plan.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
          },
        }),
        prisma.companyModule.updateMany({
          where: { companyId, module: { in: toDisable } },
          data: { enabled: false },
        }),
        prisma.company.update({ where: { id: companyId }, data: { status: 'ACTIVE' } }),
      ]);

      invalidateCompanyContext(companyId);

      return { plan, disabledModules: toDisable };
    });
  },

  async cancel(companyId: string) {
    return tenantContext.runAsSystem(async () => {
      const subscription = await prisma.subscription.findUnique({ where: { companyId } });
      if (!subscription) throw new NotFoundError('Assinatura');
      if (subscription.status === 'CANCELED') {
        throw new BadRequestError('A assinatura já está cancelada');
      }

      const updated = await prisma.subscription.update({
        where: { companyId },
        data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
      });

      invalidateCompanyContext(companyId);
      return updated;
    });
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

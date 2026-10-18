import { CompanyStatus, ModuleKey, Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import { getPagination, paginated } from '../../shared/utils/http';
import { hashPassword } from '../../shared/utils/hash';
import { asaas } from '../../shared/integrations/asaas';
import { breachMessage, checkBreachedPassword } from '../../shared/services/breachedPassword.service';
import { uniqueSlug } from '../../shared/utils/slug';
import { invalidateCompanyContext } from '../../shared/services/companyContext.service';
import { CORE_MODULES, DEFAULT_BUSINESS_HOURS } from '../companies/company.constants';

function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

/** Todas as operações do painel do SaaS rodam fora do escopo de tenant. */
function asSystem<T>(fn: () => Promise<T>): Promise<T> {
  return tenantContext.runAsSystem(fn);
}

export const adminService = {
  async metrics() {
    return asSystem(async () => {
      const [byStatus, subscriptions, plans, recentCompanies] = await Promise.all([
        prisma.company.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.subscription.findMany({ include: { plan: true } }),
        prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
        prisma.company.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { subscription: { include: { plan: true } }, _count: { select: { users: true } } },
        }),
      ]);

      const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));

      const mrr = subscriptions
        .filter((s) => s.status === 'ACTIVE')
        .reduce((sum, s) => {
          const price = num(s.plan.price);
          const monthly =
            s.plan.billingInterval === 'YEARLY'
              ? price / 12
              : s.plan.billingInterval === 'QUARTERLY'
                ? price / 3
                : price;
          return sum + monthly;
        }, 0);

      const planDistribution = plans.map((plan) => ({
        planId: plan.id,
        name: plan.name,
        slug: plan.slug,
        price: num(plan.price),
        companies: subscriptions.filter((s) => s.planId === plan.id).length,
        active: subscriptions.filter((s) => s.planId === plan.id && s.status === 'ACTIVE').length,
      }));

      return {
        companies: {
          total: byStatus.reduce((sum, s) => sum + s._count._all, 0),
          active: statusMap.ACTIVE ?? 0,
          trialing: statusMap.TRIALING ?? 0,
          suspended: statusMap.SUSPENDED ?? 0,
          canceled: statusMap.CANCELED ?? 0,
        },
        subscriptions: {
          active: subscriptions.filter((s) => s.status === 'ACTIVE').length,
          trialing: subscriptions.filter((s) => s.status === 'TRIALING').length,
          pastDue: subscriptions.filter((s) => s.status === 'PAST_DUE').length,
          canceled: subscriptions.filter((s) => s.status === 'CANCELED').length,
        },
        mrr,
        arr: mrr * 12,
        planDistribution,
        recentCompanies,
      };
    });
  },

  async listCompanies(query: {
    page?: number;
    perPage?: number;
    search?: string;
    status?: CompanyStatus;
    planSlug?: string;
  }) {
    return asSystem(async () => {
      const pagination = getPagination(query);

      const where: Prisma.CompanyWhereInput = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.planSlug ? { subscription: { plan: { slug: query.planSlug } } } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { slug: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [data, total] = await Promise.all([
        prisma.company.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: pagination.skip,
          take: pagination.take,
          include: {
            subscription: { include: { plan: true } },
            _count: {
              select: { users: true, customers: true, appointments: true, professionals: true },
            },
          },
        }),
        prisma.company.count({ where }),
      ]);

      return paginated(data, total, pagination);
    });
  },

  async getCompany(id: string) {
    return asSystem(async () => {
      const company = await prisma.company.findUnique({
        where: { id },
        include: {
          subscription: { include: { plan: true } },
          modules: true,
          users: {
            select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true },
          },
          _count: {
            select: { customers: true, appointments: true, professionals: true, resources: true, rentals: true },
          },
        },
      });
      if (!company) throw new NotFoundError('Empresa');
      return company;
    });
  },

  /** Criação de empresa direto pelo painel do SaaS (com admin inicial). */
  async createCompany(dto: {
    name: string;
    type?: string;
    planSlug: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    trialDays?: number;
  }) {
    return asSystem(async () => {
      const plan = await prisma.plan.findUnique({ where: { slug: dto.planSlug } });
      if (!plan) throw new NotFoundError('Plano');

      const duplicated = await prisma.user.findFirst({ where: { email: dto.adminEmail } });
      if (duplicated) throw new BadRequestError('Já existe um usuário com este e-mail');

      const slug = await uniqueSlug(dto.name, async (candidate) =>
        Boolean(await prisma.company.findUnique({ where: { slug: candidate }, select: { id: true } })),
      );

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + (dto.trialDays ?? plan.trialDays));

      const company = await prisma.company.create({
        data: {
          name: dto.name,
          slug,
          type: (dto.type as never) ?? 'OTHER',
          status: CompanyStatus.TRIALING,
          subscription: {
            create: {
              planId: plan.id,
              status: SubscriptionStatus.TRIALING,
              trialEndsAt,
              currentPeriodEnd: trialEndsAt,
            },
          },
          modules: {
            create: CORE_MODULES.filter((m) => plan.modules.includes(m)).map((module) => ({
              module,
              enabled: true,
            })),
          },
          businessHours: { create: DEFAULT_BUSINESS_HOURS },
          users: {
            create: {
              name: dto.adminName,
              email: dto.adminEmail,
              passwordHash: await hashPassword(dto.adminPassword),
              role: 'COMPANY_ADMIN',
            },
          },
        },
        include: { subscription: { include: { plan: true } } },
      });

      return company;
    });
  },

  async setCompanyStatus(id: string, status: CompanyStatus) {
    return asSystem(async () => {
      const company = await prisma.company.update({ where: { id }, data: { status } });

      // Bloquear a empresa encerra as sessões ativas de seus usuários.
      if (status === 'SUSPENDED' || status === 'CANCELED') {
        const users = await prisma.user.findMany({ where: { companyId: id }, select: { id: true } });
        await prisma.refreshToken.updateMany({
          where: { userId: { in: users.map((u) => u.id) }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      invalidateCompanyContext(id);
      return company;
    });
  },

  async setCompanyModule(id: string, module: ModuleKey, enabled: boolean) {
    return asSystem(async () => {
      await prisma.companyModule.upsert({
        where: { companyId_module: { companyId: id, module } },
        create: { companyId: id, module, enabled },
        update: { enabled },
      });
      invalidateCompanyContext(id);
      return prisma.companyModule.findMany({ where: { companyId: id } });
    });
  },

  async extendTrial(id: string, days: number) {
    return asSystem(async () => {
      const subscription = await prisma.subscription.findUnique({ where: { companyId: id } });
      if (!subscription) throw new NotFoundError('Assinatura');

      const base = subscription.trialEndsAt && subscription.trialEndsAt > new Date()
        ? subscription.trialEndsAt
        : new Date();
      const trialEndsAt = new Date(base);
      trialEndsAt.setDate(trialEndsAt.getDate() + days);

      const updated = await prisma.subscription.update({
        where: { companyId: id },
        data: { trialEndsAt, status: SubscriptionStatus.TRIALING, currentPeriodEnd: trialEndsAt },
      });

      await prisma.company.update({ where: { id }, data: { status: CompanyStatus.TRIALING } });
      invalidateCompanyContext(id);
      return updated;
    });
  },

  /**
   * Troca o plano de uma empresa pelo painel.
   *
   * Faz o mesmo que a troca feita pela própria dona, e mais duas coisas que só
   * o painel precisa: liga o que o plano novo trouxe (subir para o Premium sem
   * ver Aluguel no menu deixaria a troca pela metade) e corrige o valor no
   * Asaas — senão o painel diria Premium enquanto a cobrança seguia no Pro.
   */
  async setCompanyPlan(id: string, planSlug: string) {
    return asSystem(async () => {
      const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
      if (!plan) throw new NotFoundError('Plano');

      const subscription = await prisma.subscription.findUnique({
        where: { companyId: id },
        include: { plan: true },
      });
      if (!subscription) throw new NotFoundError('Assinatura');

      // O Asaas primeiro: se ele recusar, nada muda aqui e o painel não fica
      // anunciando um plano que não está sendo cobrado.
      if (subscription.asaasSubscriptionId && asaas.isEnabled()) {
        await asaas.updateSubscription(subscription.asaasSubscriptionId, {
          value: Number(plan.price),
          description: `CliniStudio — plano ${plan.name}`,
        });
      }

      const modules = await prisma.companyModule.findMany({ where: { companyId: id, enabled: true } });
      const toDisable = modules
        .map((m) => m.module)
        .filter((m) => !plan.modules.includes(m) && !CORE_MODULES.includes(m));
      const toEnable = plan.modules.filter((m) => !subscription.plan.modules.includes(m));

      await prisma.$transaction([
        prisma.subscription.update({ where: { companyId: id }, data: { planId: plan.id } }),
        prisma.companyModule.updateMany({
          where: { companyId: id, module: { in: toDisable } },
          data: { enabled: false },
        }),
        ...toEnable.map((module) =>
          prisma.companyModule.upsert({
            where: { companyId_module: { companyId: id, module } },
            create: { companyId: id, module, enabled: true },
            update: { enabled: true },
          }),
        ),
      ]);

      invalidateCompanyContext(id);
      return { plan, disabledModules: toDisable, enabledModules: toEnable };
    });
  },

  /**
   * Muda a data até quando a empresa pode usar o sistema.
   *
   * Em teste, é o fim do teste; assinando, é o fim do período pago — as duas
   * datas que `evaluateAccess` lê para decidir se tranca. A data chega como dia
   * (`2026-11-30`) e vale até o fim dele, no horário de Brasília: quem escolhe
   * "dia 30" não espera ser trancado na madrugada do dia 30.
   *
   * Não mexe na data da próxima cobrança do Asaas; quando ela for paga, o
   * webhook recalcula o período como sempre.
   */
  async setDueDate(id: string, day: string) {
    return asSystem(async () => {
      const subscription = await prisma.subscription.findUnique({ where: { companyId: id } });
      if (!subscription) throw new NotFoundError('Assinatura');

      const dueAt = new Date(`${day}T23:59:59-03:00`);
      if (Number.isNaN(dueAt.getTime())) throw new BadRequestError('Data inválida');

      const trialing = subscription.status === SubscriptionStatus.TRIALING;
      const updated = await prisma.subscription.update({
        where: { companyId: id },
        data: trialing
          ? { trialEndsAt: dueAt, currentPeriodEnd: dueAt }
          : { currentPeriodEnd: dueAt },
      });

      invalidateCompanyContext(id);
      return updated;
    });
  },

  /**
   * Define uma senha nova para um usuário da empresa — o caminho quando a dona
   * liga dizendo que não consegue entrar e o e-mail de redefinição não chega.
   *
   * Passa pela mesma checagem de vazamento das outras portas, e derruba as
   * sessões abertas: se alguém entrou com a senha antiga, sai agora.
   */
  async resetUserPassword(id: string, userId: string, newPassword: string) {
    return asSystem(async () => {
      const user = await prisma.user.findFirst({ where: { id: userId, companyId: id } });
      if (!user) throw new NotFoundError('Usuário');

      const breach = await checkBreachedPassword(newPassword);
      if (breach.breached) throw new BadRequestError(breachMessage(breach.count));

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { passwordHash: await hashPassword(newPassword) },
        }),
        prisma.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);

      return { userId, email: user.email };
    });
  },

  /**
   * Apaga a empresa e tudo o que é dela. Não tem volta.
   *
   * O nome digitado é conferido aqui também, não só na tela: é a última trava
   * antes de sumir com a agenda e o caixa de alguém.
   *
   * A assinatura do Asaas é cancelada antes — empresa apagada com cobrança
   * ativa seguiria gerando boleto para quem não tem mais conta.
   *
   * Atendimentos e aluguéis saem primeiro porque apontam para clientes,
   * serviços e salas com RESTRICT; apagados juntos pela cascata da empresa, o
   * Postgres pode chegar neles depois e recusar.
   */
  async deleteCompany(id: string, confirmName: string) {
    return asSystem(async () => {
      const company = await prisma.company.findUnique({
        where: { id },
        include: { subscription: true },
      });
      if (!company) throw new NotFoundError('Empresa');

      if (confirmName.trim() !== company.name.trim()) {
        throw new BadRequestError('O nome digitado não confere com o da empresa');
      }

      const asaasSubscriptionId = company.subscription?.asaasSubscriptionId;
      if (asaasSubscriptionId && asaas.isEnabled()) {
        await asaas.cancelSubscription(asaasSubscriptionId);
      }

      await prisma.$transaction([
        prisma.appointment.deleteMany({ where: { companyId: id } }),
        prisma.rentalBooking.deleteMany({ where: { companyId: id } }),
        prisma.rental.deleteMany({ where: { companyId: id } }),
        prisma.company.delete({ where: { id } }),
      ]);

      invalidateCompanyContext(id);
      return { id, name: company.name };
    });
  },

  // ---------------------------------------------------------------- planos
  async listPlans() {
    return asSystem(() =>
      prisma.plan.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { subscriptions: true } } },
      }),
    );
  },

  async createPlan(dto: Prisma.PlanUncheckedCreateInput) {
    return asSystem(() => prisma.plan.create({ data: dto }));
  },

  async updatePlan(id: string, dto: Prisma.PlanUncheckedUpdateInput) {
    return asSystem(async () => {
      const plan = await prisma.plan.findUnique({ where: { id } });
      if (!plan) throw new NotFoundError('Plano');
      return prisma.plan.update({ where: { id }, data: dto });
    });
  },

  async removePlan(id: string) {
    return asSystem(async () => {
      const subscriptions = await prisma.subscription.count({ where: { planId: id } });
      if (subscriptions > 0) {
        // Plano em uso: apenas deixa de ser oferecido.
        return prisma.plan.update({ where: { id }, data: { isActive: false, isPublic: false } });
      }
      return prisma.plan.delete({ where: { id } });
    });
  },
};

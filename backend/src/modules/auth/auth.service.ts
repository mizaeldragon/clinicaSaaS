import { CompanyStatus, ModuleKey, Prisma, SubscriptionStatus, UserRole } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { tenantContext } from '../../shared/database/tenantContext';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors/AppError';
import { comparePassword, hashPassword } from '../../shared/utils/hash';
import {
  AccessTokenPayload,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../../shared/utils/jwt';
import { PERMISSIONS, resolvePermissions } from '../../shared/middlewares/rbac';
import { uniqueSlug } from '../../shared/utils/slug';
import { env } from '../../config/env';
import { CORE_MODULES, DEFAULT_BUSINESS_HOURS } from '../companies/company.constants';
import { getCompanyContext, invalidateCompanyContext } from '../../shared/services/companyContext.service';
import type { ChangePasswordDTO, LoginDTO, RegisterCompanyDTO } from './auth.schema';

interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl: string | null;
    permissions: string[];
    companyId: string | null;
    professionalId: string | null;
  };
  company: Awaited<ReturnType<typeof getCompanyContext>>;
}

/**
 * A locatária aluga o espaço e toca o próprio negócio dentro dele: precisa
 * gerenciar a agenda e as clientes dela. O recorte de carteira (ver
 * `PortfolioScope`) garante que essas permissões só alcancem o que é dela —
 * comissão, por outro lado, não faz sentido para quem cobra a própria cliente.
 */
function permissionsFor(
  role: UserRole,
  custom: string[],
  professional?: { revenueOwner?: string } | null,
): string[] {
  const permissions = resolvePermissions(role, custom);

  if (professional?.revenueOwner === 'PROFESSIONAL') {
    const own = new Set(
      permissions.filter((permission) => !permission.startsWith('commissions:')),
    );
    own.add(PERMISSIONS.appointmentsManage);
    own.add(PERMISSIONS.customersManage);
    return [...own];
  }

  // Quem não aluga não tem turnos para acompanhar.
  return permissions.filter((permission) => permission !== 'rentals:view_own');
}

async function issueSession(
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl: string | null;
    permissions: string[];
    companyId: string | null;
    professional?: { id: string; revenueOwner?: string } | null;
  },
  meta: SessionMeta,
): Promise<AuthResult> {
  const permissions = permissionsFor(user.role, user.permissions, user.professional);

  const payload: AccessTokenPayload = {
    sub: user.id,
    companyId: user.companyId,
    role: user.role,
    permissions,
    professionalId: user.professional?.id ?? null,
    isRenter: user.professional?.revenueOwner === 'PROFESSIONAL',
  };

  const accessToken = signAccessToken(payload);
  const { token, tokenHash, expiresAt } = generateRefreshToken();

  await tenantContext.runAsSystem(() =>
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
      },
    }),
  );

  return {
    accessToken,
    refreshToken: token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      permissions,
      companyId: user.companyId,
      professionalId: user.professional?.id ?? null,
    },
    company: user.companyId ? await getCompanyContext(user.companyId) : null,
  };
}

export const authService = {
  async login(dto: LoginDTO, meta: SessionMeta): Promise<AuthResult> {
    const users = await tenantContext.runAsSystem(() =>
      prisma.user.findMany({
        where: { email: dto.email, isActive: true },
        include: {
          professional: { select: { id: true, revenueOwner: true } },
          company: { select: { slug: true, status: true } },
        },
      }),
    );

    if (users.length === 0) throw new UnauthorizedError('E-mail ou senha inválidos');

    let candidate = users[0];

    if (users.length > 1) {
      if (!dto.companySlug) {
        throw new BadRequestError('Este e-mail está vinculado a mais de uma empresa. Informe a empresa.', {
          companies: users.map((u) => ({ slug: u.company?.slug, name: u.company?.slug })),
        });
      }
      const found = users.find((u) => u.company?.slug === dto.companySlug);
      if (!found) throw new UnauthorizedError('E-mail ou senha inválidos');
      candidate = found;
    }

    const valid = await comparePassword(dto.password, candidate.passwordHash);
    if (!valid) throw new UnauthorizedError('E-mail ou senha inválidos');

    if (candidate.company && ['SUSPENDED', 'CANCELED'].includes(candidate.company.status)) {
      throw new ForbiddenError('Empresa bloqueada. Entre em contato com o suporte.');
    }

    await tenantContext.runAsSystem(() =>
      prisma.user.update({ where: { id: candidate.id }, data: { lastLoginAt: new Date() } }),
    );

    return issueSession(candidate, meta);
  },

  async registerCompany(dto: RegisterCompanyDTO, meta: SessionMeta): Promise<AuthResult> {
    return tenantContext.runAsSystem(async () => {
      const existing = await prisma.user.findFirst({
        where: { email: dto.admin.email, companyId: { not: null } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictError('Já existe uma conta com este e-mail');
      }

      const plan = dto.planSlug
        ? await prisma.plan.findUnique({ where: { slug: dto.planSlug } })
        : await prisma.plan.findFirst({
            where: { isActive: true, isPublic: true },
            orderBy: { sortOrder: 'asc' },
          });

      if (!plan) {
        throw new BadRequestError(
          'Nenhum plano disponível para assinatura. Execute o seed da base (npm run seed).',
        );
      }

      const slug = await uniqueSlug(dto.company.name, async (candidate) => {
        const found = await prisma.company.findUnique({ where: { slug: candidate }, select: { id: true } });
        return Boolean(found);
      });

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + (plan.trialDays || env.DEFAULT_TRIAL_DAYS));

      const passwordHash = await hashPassword(dto.admin.password);

      // Módulos iniciais: básicos limitados ao que o plano oferece.
      const initialModules = CORE_MODULES.filter((m) => plan.modules.includes(m));

      const company = await prisma.company.create({
        data: {
          name: dto.company.name,
          slug,
          type: dto.company.type,
          phone: dto.company.phone,
          document: dto.company.document,
          status: CompanyStatus.TRIALING,
          subscription: {
            create: {
              planId: plan.id,
              status: SubscriptionStatus.TRIALING,
              trialEndsAt,
              currentPeriodStart: new Date(),
              currentPeriodEnd: trialEndsAt,
            },
          },
          modules: {
            create: initialModules.map((module) => ({ module, enabled: true })),
          },
          businessHours: { create: DEFAULT_BUSINESS_HOURS },
          users: {
            create: {
              name: dto.admin.name,
              email: dto.admin.email,
              phone: dto.admin.phone,
              passwordHash,
              role: UserRole.COMPANY_ADMIN,
            },
          },
        },
        include: { users: true },
      });

      const admin = company.users[0];
      invalidateCompanyContext(company.id);

      return issueSession({ ...admin, professional: null }, meta);
    });
  },

  async refresh(rawToken: string, meta: SessionMeta): Promise<AuthResult> {
    return tenantContext.runAsSystem(async () => {
      const tokenHash = hashRefreshToken(rawToken);
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash },
        include: {
          user: {
            include: {
              professional: { select: { id: true, revenueOwner: true } },
              company: { select: { status: true } },
            },
          },
        },
      });

      if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
        throw new UnauthorizedError('Sessão expirada. Faça login novamente.');
      }
      if (!stored.user.isActive) throw new UnauthorizedError('Usuário inativo');
      if (stored.user.company && ['SUSPENDED', 'CANCELED'].includes(stored.user.company.status)) {
        throw new ForbiddenError('Empresa bloqueada');
      }

      // Rotação: o refresh usado é imediatamente revogado.
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      return issueSession(stored.user, meta);
    });
  },

  async logout(rawToken: string): Promise<void> {
    await tenantContext.runAsSystem(async () => {
      const tokenHash = hashRefreshToken(rawToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  },

  async logoutAll(userId: string): Promise<void> {
    await tenantContext.runAsSystem(() =>
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
  },

  async changePassword(userId: string, dto: ChangePasswordDTO): Promise<void> {
    await tenantContext.runAsSystem(async () => {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundError('Usuário');

      const valid = await comparePassword(dto.currentPassword, user.passwordHash);
      if (!valid) throw new BadRequestError('Senha atual incorreta');

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(dto.newPassword) },
      });

      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  },

  /** Contexto completo do usuário logado: perfil, empresa, módulos e plano. */
  async context(userId: string) {
    const user = await tenantContext.runAsSystem(() =>
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          professional: { select: { id: true, name: true, avatarUrl: true, revenueOwner: true } },
        },
      }),
    );

    if (!user) throw new NotFoundError('Usuário');

    const company = user.companyId ? await getCompanyContext(user.companyId) : null;

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        permissions: permissionsFor(user.role, user.permissions, user.professional),
        companyId: user.companyId,
        professional: user.professional,
      },
      company,
      modules: company?.modules ?? ([] as ModuleKey[]),
    };
  },
};

export type { AuthResult };
export type PrismaTx = Prisma.TransactionClient;

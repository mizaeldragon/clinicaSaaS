import { NextFunction, Request, RequestHandler, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';

/**
 * Catálogo de permissões granulares. Papéis fixos recebem um conjunto padrão;
 * o papel MANAGER é configurável via `user.permissions`.
 */
export const PERMISSIONS = {
  dashboardView: 'dashboard:view',

  customersView: 'customers:view',
  customersManage: 'customers:manage',

  appointmentsView: 'appointments:view',
  appointmentsManage: 'appointments:manage',
  appointmentsViewAll: 'appointments:view_all',

  servicesView: 'services:view',
  servicesManage: 'services:manage',

  professionalsView: 'professionals:view',
  professionalsManage: 'professionals:manage',

  financialView: 'financial:view',
  financialManage: 'financial:manage',

  commissionsView: 'commissions:view',
  commissionsManage: 'commissions:manage',

  resourcesView: 'resources:view',
  resourcesManage: 'resources:manage',

  rentalsView: 'rentals:view',
  /** A locatária enxerga apenas os próprios turnos alugados. */
  rentalsViewOwn: 'rentals:view_own',
  rentalsManage: 'rentals:manage',

  reportsView: 'reports:view',

  usersManage: 'users:manage',
  settingsManage: 'settings:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  COMPANY_ADMIN: ALL_PERMISSIONS,
  MANAGER: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.customersView,
    PERMISSIONS.customersManage,
    PERMISSIONS.appointmentsView,
    PERMISSIONS.appointmentsManage,
    PERMISSIONS.appointmentsViewAll,
    PERMISSIONS.servicesView,
    PERMISSIONS.professionalsView,
    PERMISSIONS.financialView,
    PERMISSIONS.commissionsView,
    PERMISSIONS.resourcesView,
    PERMISSIONS.rentalsView,
    PERMISSIONS.reportsView,
  ],
  RECEPTIONIST: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.customersView,
    PERMISSIONS.customersManage,
    PERMISSIONS.appointmentsView,
    PERMISSIONS.appointmentsManage,
    PERMISSIONS.appointmentsViewAll,
    PERMISSIONS.servicesView,
    PERMISSIONS.professionalsView,
    PERMISSIONS.resourcesView,
    PERMISSIONS.financialView,
  ],
  PROFESSIONAL: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.appointmentsView,
    PERMISSIONS.customersView,
    PERMISSIONS.servicesView,
    PERMISSIONS.commissionsView,
    PERMISSIONS.rentalsViewOwn,
  ],
};

export function resolvePermissions(role: UserRole, custom: string[] = []): string[] {
  if (role === 'MANAGER' && custom.length > 0) return custom;
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(req: Request, permission: Permission): boolean {
  if (!req.user) return false;
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'COMPANY_ADMIN') return true;
  return req.user.permissions.includes(permission);
}

/** Exige um dos papéis informados. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('Seu perfil não tem acesso a esta funcionalidade');
    }
    next();
  };
}

/** Exige uma permissão específica (admins da empresa sempre passam). */
export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    const allowed = permissions.some((p) => hasPermission(req, p));
    if (!allowed) throw new ForbiddenError('Você não tem permissão para esta ação');
    next();
  };
}

export const requireSuperAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Área restrita ao administrador da plataforma');
  }
  next();
};

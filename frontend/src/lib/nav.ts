import type { NavItem } from '@/config/navigation';
import type { ModuleKey, UserRole } from '@/types';

/**
 * Regra única de visibilidade do menu: módulo ativo na empresa +
 * permissão do usuário (qualquer uma da lista) + papel permitido.
 */
export function isNavItemVisible(
  item: NavItem,
  ctx: {
    role?: UserRole;
    hasModule: (module: ModuleKey) => boolean;
    can: (permission: string) => boolean;
  },
): boolean {
  if (item.module && !ctx.hasModule(item.module)) return false;
  if (item.roles && (!ctx.role || !item.roles.includes(ctx.role))) return false;

  if (item.permission) {
    const permissions = Array.isArray(item.permission) ? item.permission : [item.permission];
    if (!permissions.some((permission) => ctx.can(permission))) return false;
  }

  return true;
}

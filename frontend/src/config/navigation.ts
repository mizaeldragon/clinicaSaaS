import {
  Banknote,
  CalendarDays,
  Building2,
  Users,
  UserCog,
  Scissors,
  Percent,
  DoorOpen,
  KeyRound,
  BarChart3,
  Settings,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleKey, UserRole } from '@/types';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Só aparece se o módulo estiver ativo para a empresa. */
  module?: ModuleKey;
  /** Só aparece se o usuário tiver alguma destas permissões. */
  permission?: string | string[];
  /** Quando definido, restringe o item a estes papéis. */
  roles?: UserRole[];
  group: 'operação' | 'gestão' | 'configuração';
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/app',
    icon: LayoutDashboard,
    permission: 'dashboard:view',
    group: 'operação',
  },
  {
    label: 'Agenda',
    to: '/app/agenda',
    icon: CalendarDays,
    module: 'appointments',
    permission: 'appointments:view',
    group: 'operação',
  },
  {
    label: 'Clientes',
    to: '/app/clientes',
    icon: Users,
    module: 'customers',
    permission: 'customers:view',
    group: 'operação',
  },
  {
    label: 'Serviços',
    to: '/app/servicos',
    icon: Scissors,
    module: 'services',
    permission: 'services:view',
    group: 'operação',
  },
  {
    label: 'Profissionais',
    to: '/app/profissionais',
    icon: UserCog,
    module: 'professionals',
    permission: 'professionals:view',
    group: 'operação',
  },
  {
    label: 'Recursos',
    to: '/app/recursos',
    icon: DoorOpen,
    module: 'resources',
    permission: 'resources:view',
    group: 'gestão',
  },
  {
    label: 'Aluguéis',
    to: '/app/alugueis',
    icon: KeyRound,
    module: 'rentals',
    permission: 'rentals:view',
    group: 'gestão',
  },
  {
    label: 'Meus turnos',
    to: '/app/meus-turnos',
    icon: KeyRound,
    module: 'rentals',
    permission: 'rentals:view_own',
    roles: ['PROFESSIONAL'],
    group: 'operação',
  },
  {
    label: 'Financeiro',
    to: '/app/financeiro',
    icon: Banknote,
    module: 'financial',
    permission: 'financial:view',
    group: 'gestão',
  },
  {
    label: 'Comissões',
    to: '/app/comissoes',
    icon: Percent,
    module: 'commissions',
    permission: 'commissions:view',
    group: 'gestão',
  },
  {
    label: 'Relatórios',
    to: '/app/relatorios',
    icon: BarChart3,
    module: 'reports',
    permission: 'reports:view',
    group: 'gestão',
  },
  // Configurações não fica no menu lateral: mora no menu da empresa, no topo,
  // junto da identidade e do sair.
];

export const ADMIN_NAV: NavItem[] = [
  { label: 'Visão geral', to: '/admin', icon: LayoutDashboard, group: 'operação' },
  { label: 'Empresas', to: '/admin/empresas', icon: Building2, group: 'operação' },
  { label: 'Planos', to: '/admin/planos', icon: Banknote, group: 'gestão' },
];

export const MODULE_ICONS: Record<ModuleKey, LucideIcon> = {
  appointments: CalendarDays,
  customers: Users,
  professionals: UserCog,
  services: Scissors,
  financial: Banknote,
  commissions: Percent,
  resources: DoorOpen,
  rentals: KeyRound,
  reports: BarChart3,
  notifications: Settings,
};

import { CompanyType, ModuleKey } from '@prisma/client';

/** Módulos considerados básicos: toda empresa nasce com eles habilitados. */
export const CORE_MODULES: ModuleKey[] = [
  ModuleKey.appointments,
  ModuleKey.customers,
  ModuleKey.services,
];

/** Ordem canônica de exibição dos módulos no menu e nas telas de configuração. */
export const MODULE_ORDER: ModuleKey[] = [
  ModuleKey.appointments,
  ModuleKey.customers,
  ModuleKey.professionals,
  ModuleKey.services,
  ModuleKey.resources,
  ModuleKey.rentals,
  ModuleKey.financial,
  ModuleKey.commissions,
  ModuleKey.reports,
  ModuleKey.notifications,
];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  appointments: 'Agenda',
  customers: 'Clientes',
  professionals: 'Profissionais',
  services: 'Serviços',
  financial: 'Financeiro',
  commissions: 'Comissões',
  resources: 'Salas e Recursos',
  rentals: 'Aluguel de Espaços',
  reports: 'Relatórios',
  notifications: 'Notificações',
};

export const MODULE_DESCRIPTIONS: Record<ModuleKey, string> = {
  appointments: 'Agenda visual por dia, semana e mês com prevenção de conflitos',
  customers: 'Cadastro de clientes, histórico e timeline de atendimentos',
  professionals: 'Equipe, especialidades, jornada de trabalho e agenda própria',
  services: 'Catálogo de serviços, categorias, preços e durações',
  financial: 'Receitas, despesas, formas de pagamento e dashboard financeiro',
  commissions: 'Cálculo automático de comissões por serviço ou profissional',
  resources: 'Salas, mesas, cadeiras, macas e equipamentos',
  rentals: 'Contratos de aluguel de espaços com cobrança recorrente',
  reports: 'Relatórios gerenciais de atendimentos, faturamento e equipe',
  notifications: 'Lembretes e avisos internos, por e-mail e (futuro) WhatsApp',
};

/** Horário de funcionamento padrão criado no cadastro (seg–sex 9–19, sáb 9–17). */
export const DEFAULT_BUSINESS_HOURS = [
  { weekday: 0, opensAt: '09:00', closesAt: '18:00', isClosed: true },
  { weekday: 1, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { weekday: 2, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { weekday: 3, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { weekday: 4, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { weekday: 5, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { weekday: 6, opensAt: '09:00', closesAt: '17:00', isClosed: false },
];

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  AESTHETIC_CLINIC: 'Clínica de estética',
  BEAUTY_SALON: 'Salão de beleza',
  NAIL_STUDIO: 'Studio de unhas',
  BROW_STUDIO: 'Studio de sobrancelhas',
  BARBERSHOP: 'Barbearia',
  BEAUTY_SPACE: 'Espaço de beleza',
  SPECIALIZED_CLINIC: 'Clínica especializada',
  BEAUTY_COWORKING: 'Coworking de beleza',
  OTHER: 'Outro',
};

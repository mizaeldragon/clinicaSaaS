import type {
  AppointmentStatus,
  CommissionStatus,
  CompanyType,
  PaymentMethod,
  PaymentStatus,
  RentalBillingCycle,
  RentalStatus,
  ResourceStatus,
  UserRole,
} from '@/types';

type Tone = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

export const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; tone: Tone; dot: string }> = {
  SCHEDULED: { label: 'Agendado', tone: 'info', dot: 'bg-sky-500' },
  CONFIRMED: { label: 'Confirmado', tone: 'default', dot: 'bg-violet-500' },
  IN_PROGRESS: { label: 'Em atendimento', tone: 'warning', dot: 'bg-amber-500' },
  COMPLETED: { label: 'Finalizado', tone: 'success', dot: 'bg-emerald-500' },
  CANCELED: { label: 'Cancelado', tone: 'danger', dot: 'bg-rose-500' },
  NO_SHOW: { label: 'Não compareceu', tone: 'muted', dot: 'bg-slate-400' },
};

export const RESOURCE_STATUS: Record<ResourceStatus, { label: string; tone: Tone }> = {
  AVAILABLE: { label: 'Disponível', tone: 'success' },
  IN_USE: { label: 'Em uso', tone: 'info' },
  MAINTENANCE: { label: 'Manutenção', tone: 'warning' },
  INACTIVE: { label: 'Inativo', tone: 'muted' },
};

export const RENTAL_STATUS: Record<RentalStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Ativo', tone: 'success' },
  ENDED: { label: 'Encerrado', tone: 'muted' },
  OVERDUE: { label: 'Atrasado', tone: 'danger' },
  CANCELED: { label: 'Cancelado', tone: 'muted' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  PAID: { label: 'Pago', tone: 'success' },
  PARTIAL: { label: 'Parcial', tone: 'warning' },
  PENDING: { label: 'Pendente', tone: 'info' },
  CANCELED: { label: 'Cancelado', tone: 'muted' },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BANK_TRANSFER: 'Transferência',
  OTHER: 'Outro',
};

export const BILLING_CYCLE: Record<RentalBillingCycle, string> = {
  HOURLY: 'Por hora',
  DAILY: 'Por dia',
  WEEKLY: 'Por semana',
  MONTHLY: 'Por mês',
  CUSTOM: 'Personalizado',
};

export const COMMISSION_STATUS: Record<CommissionStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'A pagar', tone: 'warning' },
  PAID: { label: 'Pago', tone: 'success' },
  CANCELED: { label: 'Cancelado', tone: 'muted' },
};

export const USER_ROLE: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super admin',
  COMPANY_ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  RECEPTIONIST: 'Recepcionista',
  PROFESSIONAL: 'Profissional',
};

export const COMPANY_TYPE: Record<CompanyType, string> = {
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

export const COMPANY_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Ativa', tone: 'success' },
  TRIALING: { label: 'Em teste', tone: 'info' },
  SUSPENDED: { label: 'Bloqueada', tone: 'danger' },
  CANCELED: { label: 'Cancelada', tone: 'muted' },
};

export const TRANSACTION_ORIGIN: Record<string, string> = {
  APPOINTMENT: 'Atendimento',
  RENTAL: 'Aluguel',
  PRODUCT: 'Produto',
  MANUAL: 'Manual',
  OTHER: 'Outro',
};

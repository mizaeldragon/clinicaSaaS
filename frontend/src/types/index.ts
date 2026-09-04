export type ModuleKey =
  | 'appointments'
  | 'customers'
  | 'professionals'
  | 'services'
  | 'financial'
  | 'commissions'
  | 'resources'
  | 'rentals'
  | 'reports'
  | 'notifications';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'COMPANY_ADMIN'
  | 'MANAGER'
  | 'RECEPTIONIST'
  | 'PROFESSIONAL';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELED'
  | 'NO_SHOW';

export type ResourceStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'INACTIVE';
export type RentalStatus = 'ACTIVE' | 'ENDED' | 'OVERDUE' | 'CANCELED';
export type RentalBillingCycle = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type PaymentMethod =
  | 'CASH'
  | 'PIX'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'BANK_TRANSFER'
  | 'OTHER';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'CANCELED';
export type TransactionType = 'INCOME' | 'EXPENSE';
export type CommissionType = 'PERCENTAGE' | 'FIXED';
export type CommissionStatus = 'PENDING' | 'PAID' | 'CANCELED';
export type CompanyType =
  | 'AESTHETIC_CLINIC'
  | 'BEAUTY_SALON'
  | 'NAIL_STUDIO'
  | 'BROW_STUDIO'
  | 'BARBERSHOP'
  | 'BEAUTY_SPACE'
  | 'SPECIALIZED_CLINIC'
  | 'BEAUTY_COWORKING'
  | 'OTHER';

export interface Paginated<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  permissions: string[];
  companyId: string | null;
  professionalId?: string | null;
  /** Locatária: aluga um espaço da empresa e tem carteira própria. */
  isRenter?: boolean;
  professional?: { id: string; name: string; avatarUrl: string | null } | null;
}

export interface CompanyContext {
  id: string;
  name: string;
  slug: string;
  status: string;
  type: CompanyType;
  logoUrl: string | null;
  primaryColor: string;
  onboardingCompleted: boolean;
  modules: ModuleKey[];
  plan: {
    id: string;
    name: string;
    slug: string;
    maxUsers: number | null;
    maxProfessionals: number | null;
    maxAppointmentsMonth: number | null;
    modules: ModuleKey[];
  } | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  company: CompanyContext | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  birthDate: string | null;
  document: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { appointments: number };
}

export interface ServiceCategory {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { services: number };
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  bufferMinutes: number;
  categoryId: string | null;
  resourceCategoryId: string | null;
  commissionType: CommissionType | null;
  commissionValue: number | null;
  isActive: boolean;
  category?: { id: string; name: string; color: string } | null;
  professionals?: { professionalId: string; professional: { id: string; name: string } }[];
}

export interface WorkingHour {
  id?: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  breakStart: string | null;
  breakEnd: string | null;
  isOff: boolean;
}

export interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  bio: string | null;
  specialties: string[];
  color: string;
  commissionType: CommissionType | null;
  commissionValue: number | null;
  /** PROFESSIONAL = locatária: aluga o espaço e cobra as próprias clientes. */
  revenueOwner?: 'COMPANY' | 'PROFESSIONAL';
  publicBookingEnabled?: boolean;
  isActive: boolean;
  workingHours?: WorkingHour[];
  timeOffs?: { id: string; startsAt: string; endsAt: string; reason: string | null }[];
  services?: { serviceId: string }[];
  user?: { id: string; email: string; role: UserRole } | null;
  _count?: { appointments: number };
}

export interface AppointmentServiceItem {
  id: string;
  serviceId: string;
  name: string;
  price: number;
  durationMinutes: number;
  quantity: number;
}

export interface Appointment {
  id: string;
  customerId: string;
  professionalId: string | null;
  roomId: string | null;
  resourceId: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  totalPrice: number;
  notes: string | null;
  canceledReason: string | null;
  customer: { id: string; name: string; phone: string | null; whatsapp: string | null };
  professional: { id: string; name: string; color: string; avatarUrl: string | null } | null;
  room: { id: string; name: string } | null;
  resource: { id: string; name: string } | null;
  services: AppointmentServiceItem[];
  transactions?: FinancialTransaction[];
  commissions?: Commission[];
}

export interface ResourceCategory {
  id: string;
  name: string;
  isRoom: boolean;
  icon: string | null;
  _count?: { resources: number };
}

export interface Resource {
  id: string;
  name: string;
  description: string | null;
  status: ResourceStatus;
  isRentable: boolean;
  categoryId: string | null;
  hourlyRate: number | null;
  dailyRate: number | null;
  weeklyRate: number | null;
  monthlyRate: number | null;
  isActive: boolean;
  category?: { id: string; name: string; isRoom: boolean } | null;
  rentals?: { id: string; renterName: string; amount: number; billingCycle: RentalBillingCycle }[];
}

export interface Rental {
  id: string;
  resourceId: string;
  professionalId: string | null;
  renterName: string;
  renterPhone: string | null;
  renterEmail: string | null;
  startsAt: string;
  endsAt: string | null;
  amount: number;
  billingCycle: RentalBillingCycle;
  dueDay: number | null;
  status: RentalStatus;
  notes: string | null;
  resource?: { id: string; name: string; category?: { name: string } | null };
  professional?: { id: string; name: string } | null;
  payments?: RentalPayment[];
  _count?: { payments: number };
}

export interface RentalPayment {
  id: string;
  rentalId: string;
  referenceMonth: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  paidAt: string | null;
  status: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  rental?: { id: string; renterName: string; resource: { name: string } };
}

export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
}

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  origin: string;
  description: string;
  amount: number;
  paidAmount: number;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  dueDate: string | null;
  paidAt: string | null;
  competenceDate: string;
  categoryId: string | null;
  customerId: string | null;
  notes: string | null;
  category?: { id: string; name: string; color: string } | null;
  customer?: { id: string; name: string } | null;
}

export interface Commission {
  id: string;
  professionalId: string;
  appointmentId: string | null;
  serviceId: string | null;
  baseAmount: number;
  type: CommissionType;
  value: number;
  amount: number;
  status: CommissionStatus;
  referenceMonth: string;
  paidAt: string | null;
  professional?: { id: string; name: string; avatarUrl: string | null };
  service?: { id: string; name: string } | null;
  appointment?: { id: string; startsAt: string; customer: { name: string } } | null;
}

export interface Notification {
  id: string;
  channel: string;
  event: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface CompanyModuleInfo {
  module: ModuleKey;
  label: string;
  description: string;
  enabled: boolean;
  availableInPlan: boolean;
  required: boolean;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  trialDays: number;
  limits: {
    users: number | null;
    professionals: number | null;
    appointmentsMonth: number | null;
  };
  modules: ModuleKey[];
}

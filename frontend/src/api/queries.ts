/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type {
  Appointment,
  Commission,
  CompanyModuleInfo,
  Customer,
  ExpenseCategory,
  FinancialTransaction,
  Notification,
  Paginated,
  PaymentStatus,
  Plan,
  Professional,
  Rental,
  RentalPayment,
  Resource,
  ResourceCategory,
  Service,
  ServiceCategory,
} from '@/types';
import type { BillingOverview, BillingType } from '@/types';

export const keys = {
  dashboard: ['dashboard'] as const,
  customers: (params?: unknown) => ['customers', params] as const,
  customer: (id: string) => ['customer', id] as const,
  customerProfile: (id: string) => ['customer', id, 'profile'] as const,
  services: (params?: unknown) => ['services', params] as const,
  serviceCategories: ['service-categories'] as const,
  professionals: (params?: unknown) => ['professionals', params] as const,
  professional: (id: string) => ['professional', id] as const,
  professionalDashboard: (id: string) => ['professional', id, 'dashboard'] as const,
  appointments: (params?: unknown) => ['appointments', params] as const,
  appointment: (id: string) => ['appointment', id] as const,
  availability: (params?: unknown) => ['availability', params] as const,
  resources: (params?: unknown) => ['resources', params] as const,
  resourceCategories: ['resource-categories'] as const,
  resourceStats: ['resource-stats'] as const,
  rentals: (params?: unknown) => ['rentals', params] as const,
  rentalPayments: (params?: unknown) => ['rental-payments', params] as const,
  rentalStats: ['rental-stats'] as const,
  financialDashboard: (params?: unknown) => ['financial-dashboard', params] as const,
  transactions: (params?: unknown) => ['transactions', params] as const,
  expenseCategories: ['expense-categories'] as const,
  commissions: (params?: unknown) => ['commissions', params] as const,
  commissionSummary: (month: string) => ['commission-summary', month] as const,
  reports: (name: string, params?: unknown) => ['reports', name, params] as const,
  notifications: (params?: unknown) => ['notifications', params] as const,
  company: ['company'] as const,
  companyModules: ['company-modules'] as const,
  users: (params?: unknown) => ['users', params] as const,
  subscription: ['subscription'] as const,
  plans: ['plans'] as const,
  auditLogs: (params?: unknown) => ['audit-logs', params] as const,
  adminMetrics: ['admin-metrics'] as const,
  adminCompanies: (params?: unknown) => ['admin-companies', params] as const,
  adminPlans: ['admin-plans'] as const,
};

/** Trata erros de mutação com toast padronizado. */
export function handleError(error: unknown, fallback?: unknown) {
  const message = typeof fallback === 'string' ? fallback : 'Não foi possível concluir a ação';
  if (error instanceof ApiError) {
    const details = Array.isArray(error.details)
      ? (error.details as { field: string; message: string }[])
          .map((d) => `${d.field}: ${d.message}`)
          .join('\n')
      : undefined;
    toast.error(error.message, { description: details });
    return;
  }
  toast.error(message);
}

function useApiQuery<T>(key: readonly unknown[], path: string, params?: Record<string, unknown>, options?: Partial<UseQueryOptions<T>>) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => api.get<T>(path, params),
    ...options,
  });
}

/* --------------------------------------------------------------- Dashboard */
export interface DashboardData {
  today: {
    appointments: number;
    revenue: number;
    byStatus: { status: string; count: number }[];
    upcoming: Appointment[];
    canceled: number;
  } | null;
  company: { customers: number; professionals: number; servicesCompletedMonth: number };
  financial: {
    monthIncome: number;
    monthExpense: number;
    monthProfit: number;
    toReceive: number;
    toPay: number;
    upcoming: FinancialTransaction[];
  } | null;
  resources: { total: number; available: number; inUse: number; maintenance: number; inactive: number } | null;
  rentals: {
    active: number;
    overdue: number;
    pendingAmount: number;
    monthlyRecurringRevenue: number;
    upcoming: RentalPayment[];
  } | null;
  revenueSeries: { date: string; revenue: number; count: number }[];
}

export const useDashboard = () => useApiQuery<DashboardData>(keys.dashboard, '/dashboard');

/* ---------------------------------------------------------------- Clientes */
export const useCustomers = (params: Record<string, unknown>) =>
  useApiQuery<Paginated<Customer>>(keys.customers(params), '/customers', params);

export const useCustomerProfile = (id: string) =>
  useApiQuery<{
    customer: Customer;
    metrics: {
      totalSpent: number;
      totalAppointments: number;
      lastVisit: string | null;
      upcomingAppointment: Appointment | null;
      statusBreakdown: { status: string; count: number }[];
    };
    appointments: Appointment[];
    transactions: FinancialTransaction[];
    timeline: {
      id: string;
      date: string;
      status: string;
      title: string;
      professional: string | null;
      amount: number;
    }[];
  }>(keys.customerProfile(id), `/customers/${id}/profile`);

export function useCustomerMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['customers'] });
    qc.invalidateQueries({ queryKey: ['customer'] });
  };

  return {
    create: useMutation({
      mutationFn: (body: Partial<Customer>) => api.post<Customer>('/customers', body),
      onSuccess: () => {
        toast.success('Cliente cadastrado');
        invalidate();
      },
      onError: handleError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Partial<Customer> & { id: string }) =>
        api.patch<Customer>(`/customers/${id}`, body),
      onSuccess: () => {
        toast.success('Cliente atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/customers/${id}`),
      onSuccess: () => {
        toast.success('Cliente removido');
        invalidate();
      },
      onError: handleError,
    }),
  };
}

/* ---------------------------------------------------------------- Serviços */
export const useServices = (params: Record<string, unknown> = {}) =>
  useApiQuery<Paginated<Service>>(keys.services(params), '/services', { perPage: 100, ...params });

export const useServiceCategories = () =>
  useApiQuery<ServiceCategory[]>(keys.serviceCategories, '/services/categories');

export function useServiceMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['services'] });
    qc.invalidateQueries({ queryKey: ['service-categories'] });
  };

  return {
    create: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post<Service>('/services', body),
      onSuccess: () => {
        toast.success('Serviço criado');
        invalidate();
      },
      onError: handleError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
        api.patch<Service>(`/services/${id}`, body),
      onSuccess: () => {
        toast.success('Serviço atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/services/${id}`),
      onSuccess: () => {
        toast.success('Serviço removido');
        invalidate();
      },
      onError: handleError,
    }),
    createCategory: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post('/services/categories', body),
      onSuccess: () => {
        toast.success('Categoria criada');
        invalidate();
      },
      onError: handleError,
    }),
    removeCategory: useMutation({
      mutationFn: (id: string) => api.delete(`/services/categories/${id}`),
      onSuccess: () => {
        toast.success('Categoria removida');
        invalidate();
      },
      onError: handleError,
    }),
  };
}

/* ----------------------------------------------------------- Profissionais */
export const useProfessionals = (params: Record<string, unknown> = {}) =>
  useApiQuery<Paginated<Professional>>(keys.professionals(params), '/professionals', {
    perPage: 100,
    ...params,
  });

export const useProfessional = (id: string) =>
  useApiQuery<Professional>(keys.professional(id), `/professionals/${id}`);

export const useProfessionalDashboard = (id: string) =>
  useApiQuery<{
    revenueMonth: number;
    completedMonth: number;
    appointmentsToday: number;
    commissionsMonth: number;
    upcoming: Appointment[];
    statusBreakdown: { status: string; count: number }[];
  }>(keys.professionalDashboard(id), `/professionals/${id}/dashboard`);

export function useProfessionalMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['professionals'] });
    qc.invalidateQueries({ queryKey: ['professional'] });
  };

  return {
    create: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post<Professional>('/professionals', body),
      onSuccess: () => {
        toast.success('Profissional cadastrado');
        invalidate();
      },
      onError: handleError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
        api.patch<Professional>(`/professionals/${id}`, body),
      onSuccess: () => {
        toast.success('Profissional atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/professionals/${id}`),
      onSuccess: () => {
        toast.success('Profissional removido');
        invalidate();
      },
      onError: handleError,
    }),
    setWorkingHours: useMutation({
      mutationFn: ({ id, workingHours }: { id: string; workingHours: unknown[] }) =>
        api.put(`/professionals/${id}/working-hours`, { workingHours }),
      onSuccess: () => {
        toast.success('Jornada atualizada');
        invalidate();
      },
      onError: handleError,
    }),
    addTimeOff: useMutation({
      mutationFn: ({ id, ...body }: { id: string; startsAt: string; endsAt: string; reason?: string }) =>
        api.post(`/professionals/${id}/time-off`, body),
      onSuccess: () => {
        toast.success('Ausência registrada');
        invalidate();
      },
      onError: handleError,
    }),
  };
}

/* ------------------------------------------------------------------ Agenda */
export const useCalendar = (params: Record<string, unknown>) =>
  useApiQuery<Appointment[]>(keys.appointments(params), '/appointments/calendar', params, {
    enabled: Boolean(params.from && params.to),
  });

export const useAppointment = (id: string | null) =>
  useQuery<Appointment>({
    queryKey: keys.appointment(id ?? ''),
    queryFn: () => api.get<Appointment>(`/appointments/${id}`),
    enabled: Boolean(id),
  });

export const useAvailability = (params: {
  professionalId?: string;
  date?: string;
  durationMinutes?: number;
}) =>
  useQuery<{ startsAt: string; endsAt: string; time: string; available: boolean; reason?: string }[]>({
    queryKey: keys.availability(params),
    queryFn: () => api.get('/appointments/availability', params),
    enabled: Boolean(params.professionalId && params.date),
  });

export function useAppointmentMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['appointments'] });
    qc.invalidateQueries({ queryKey: ['appointment'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['availability'] });
    qc.invalidateQueries({ queryKey: ['financial-dashboard'] });
  };

  return {
    create: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post<Appointment>('/appointments', body),
      onSuccess: () => {
        toast.success('Agendamento criado');
        invalidate();
      },
      onError: handleError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
        api.patch<Appointment>(`/appointments/${id}`, body),
      onSuccess: () => {
        toast.success('Agendamento atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    updateStatus: useMutation({
      mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
        api.patch<Appointment>(`/appointments/${id}/status`, body),
      onSuccess: () => {
        toast.success('Status atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/appointments/${id}`),
      onSuccess: () => {
        toast.success('Agendamento excluído');
        invalidate();
      },
      onError: handleError,
    }),
  };
}

/* ---------------------------------------------------------------- Recursos */
export const useResources = (params: Record<string, unknown> = {}) =>
  useApiQuery<Paginated<Resource>>(keys.resources(params), '/resources', { perPage: 100, ...params });

export const useResourceCategories = () =>
  useApiQuery<ResourceCategory[]>(keys.resourceCategories, '/resources/categories');

export const useResourceStats = () => useApiQuery<{ total: number; available: number; inUse: number; maintenance: number; inactive: number }>(
    keys.resourceStats,
    '/resources/stats',
  );

export function useResourceMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['resources'] });
    qc.invalidateQueries({ queryKey: ['resource-categories'] });
    qc.invalidateQueries({ queryKey: ['resource-stats'] });
  };

  return {
    create: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post<Resource>('/resources', body),
      onSuccess: () => {
        toast.success('Recurso criado');
        invalidate();
      },
      onError: handleError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
        api.patch<Resource>(`/resources/${id}`, body),
      onSuccess: () => {
        toast.success('Recurso atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    changeStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: string }) =>
        api.patch(`/resources/${id}/status`, { status }),
      onSuccess: () => {
        toast.success('Status do recurso atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/resources/${id}`),
      onSuccess: () => {
        toast.success('Recurso removido');
        invalidate();
      },
      onError: handleError,
    }),
    createCategory: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post('/resources/categories', body),
      onSuccess: () => {
        toast.success('Categoria criada');
        invalidate();
      },
      onError: handleError,
    }),
  };
}

/* ---------------------------------------------------------------- Aluguéis */
export const useRentals = (params: Record<string, unknown> = {}) =>
  useApiQuery<Paginated<Rental>>(keys.rentals(params), '/rentals', params);

export const useRentalPayments = (params: Record<string, unknown> = {}) =>
  useApiQuery<Paginated<RentalPayment> & { totals: { status: string; amount: number; paidAmount: number }[] }>(
    keys.rentalPayments(params),
    '/rentals/payments',
    params,
  );

export const useRentalStats = () =>
  useApiQuery<{
    activeRentals: number;
    overdueRentals: number;
    pendingCount: number;
    pendingAmount: number;
    monthlyRecurringRevenue: number;
    upcoming: RentalPayment[];
  }>(keys.rentalStats, '/rentals/stats');

export function useRentalMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rentals'] });
    qc.invalidateQueries({ queryKey: ['rental-payments'] });
    qc.invalidateQueries({ queryKey: ['rental-stats'] });
    qc.invalidateQueries({ queryKey: ['resources'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  return {
    create: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post<Rental>('/rentals', body),
      onSuccess: () => {
        toast.success('Contrato de aluguel criado');
        invalidate();
      },
      onError: handleError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
        api.patch<Rental>(`/rentals/${id}`, body),
      onSuccess: () => {
        toast.success('Contrato atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/rentals/${id}`),
      onSuccess: () => {
        toast.success('Contrato removido');
        invalidate();
      },
      onError: handleError,
    }),
    pay: useMutation({
      mutationFn: ({ id, ...body }: { id: string; amount: number; paymentMethod: string }) =>
        api.post(`/rentals/payments/${id}/pay`, body),
      onSuccess: () => {
        toast.success('Pagamento registrado');
        invalidate();
      },
      onError: handleError,
    }),
    generateCharges: useMutation({
      mutationFn: (id: string) => api.post<{ created: number }>(`/rentals/${id}/generate-charges`),
      onSuccess: (data) => {
        toast.success(`${data.created} cobrança(s) gerada(s)`);
        invalidate();
      },
      onError: handleError,
    }),
  };
}

/* -------------------------------------------------------------- Financeiro */
export interface FinancialDashboard {
  period: { from: string; to: string };
  today: { income: number; received: number };
  month: {
    income: number;
    incomeReceived: number;
    expense: number;
    expensePaid: number;
    profit: number;
    margin: number;
  };
  pending: { toReceive: number; toPay: number };
  upcoming: FinancialTransaction[];
  byPaymentMethod: { method: string; total: number }[];
  byExpenseCategory: { categoryId: string | null; name: string; total: number }[];
  dailySeries: { day: string; type: string; total: number }[];
}

export const useFinancialDashboard = (params: Record<string, unknown> = {}) =>
  useApiQuery<FinancialDashboard>(keys.financialDashboard(params), '/financial/dashboard', params);

export const useTransactions = (params: Record<string, unknown> = {}) =>
  useApiQuery<
    Paginated<FinancialTransaction> & {
      totals: { income: number; incomeReceived: number; expense: number; expensePaid: number };
    }
  >(keys.transactions(params), '/financial/transactions', params);

export const useExpenseCategories = () =>
  useApiQuery<ExpenseCategory[]>(keys.expenseCategories, '/financial/categories');

export function useFinancialMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: ['financial-dashboard'] });
    qc.invalidateQueries({ queryKey: ['expense-categories'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  return {
    create: useMutation({
      mutationFn: (body: Record<string, unknown>) =>
        api.post<FinancialTransaction>('/financial/transactions', body),
      onSuccess: () => {
        toast.success('Lançamento registrado');
        invalidate();
      },
      onError: handleError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
        api.patch(`/financial/transactions/${id}`, body),
      onSuccess: () => {
        toast.success('Lançamento atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    pay: useMutation({
      mutationFn: ({ id, ...body }: { id: string; amount: number; paymentMethod: string }) =>
        api.post(`/financial/transactions/${id}/pay`, body),
      onSuccess: () => {
        toast.success('Pagamento registrado');
        invalidate();
      },
      onError: handleError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/financial/transactions/${id}`),
      onSuccess: () => {
        toast.success('Lançamento excluído');
        invalidate();
      },
      onError: handleError,
    }),
    createCategory: useMutation({
      mutationFn: (body: { name: string; color?: string }) => api.post('/financial/categories', body),
      onSuccess: () => {
        toast.success('Categoria criada');
        invalidate();
      },
      onError: handleError,
    }),
  };
}

/* --------------------------------------------------------------- Comissões */
export const useCommissions = (params: Record<string, unknown> = {}) =>
  useApiQuery<
    Paginated<Commission> & { totals: { status: string; total: number }[] }
  >(keys.commissions(params), '/commissions', params);

export const useCommissionSummary = (month: string) =>
  useApiQuery<{
    referenceMonth: string;
    professionals: {
      professionalId: string;
      name: string;
      avatarUrl: string | null;
      pending: number;
      paid: number;
      total: number;
      count: number;
    }[];
  }>(keys.commissionSummary(month), '/commissions/summary', { referenceMonth: month });

export function useCommissionMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['commissions'] });
    qc.invalidateQueries({ queryKey: ['commission-summary'] });
  };

  return {
    payMonth: useMutation({
      mutationFn: (body: { professionalId: string; referenceMonth: string }) =>
        api.post<{ paid: number }>('/commissions/pay-month', body),
      onSuccess: (data) => {
        toast.success(`${data.paid} comissão(ões) marcada(s) como paga(s)`);
        invalidate();
      },
      onError: handleError,
    }),
    pay: useMutation({
      mutationFn: (ids: string[]) => api.post('/commissions/pay', { ids }),
      onSuccess: () => {
        toast.success('Comissões pagas');
        invalidate();
      },
      onError: handleError,
    }),
  };
}

/* -------------------------------------------------------------- Relatórios */
export const useReport = <T,>(name: string, params: Record<string, unknown> = {}) =>
  useApiQuery<T>(keys.reports(name, params), `/reports/${name}`, params);

/* ----------------------------------------------------------- Notificações */
export const useNotifications = (params: Record<string, unknown> = {}) =>
  useApiQuery<Paginated<Notification> & { unread: number }>(
    keys.notifications(params),
    '/notifications',
    params,
    { refetchInterval: 60_000 },
  );

export function useNotificationMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] });

  return {
    markAsRead: useMutation({
      mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
      onSuccess: invalidate,
    }),
    markAllAsRead: useMutation({
      mutationFn: () => api.post('/notifications/read-all'),
      onSuccess: invalidate,
    }),
  };
}

/* ------------------------------------------------------ Empresa e ajustes */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useCompany = () => useApiQuery<any>(keys.company, '/company');
export const useCompanyModules = () =>
  useApiQuery<CompanyModuleInfo[]>(keys.companyModules, '/company/modules');
export const useUsers = (params: Record<string, unknown> = {}) =>
  useApiQuery<Paginated<any>>(keys.users(params), '/users', params);
export const useSubscription = () =>
  useApiQuery<{
    subscription: { status: string; trialEndsAt: string | null; plan: Plan & { price: number } };
    usage: Record<string, { current: number; limit: number | null }>;
  }>(keys.subscription, '/subscription');
export const usePlans = () => useApiQuery<Plan[]>(keys.plans, '/subscription/plans');
export const useAuditLogs = (params: Record<string, unknown> = {}) =>
  useApiQuery<Paginated<any>>(keys.auditLogs(params), '/audit-logs', params);

/* ---------------------------------------------------------- Painel do SaaS */
export const useAdminMetrics = () => useApiQuery<any>(keys.adminMetrics, '/admin/metrics');
export const useAdminCompanies = (params: Record<string, unknown> = {}) =>
  useApiQuery<Paginated<any>>(keys.adminCompanies(params), '/admin/companies', params);
export const useAdminPlans = () => useApiQuery<any[]>(keys.adminPlans, '/admin/plans');

/* ------------------------------------------------- Mutations de empresa */
export function useCompanyMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['company'] });
    qc.invalidateQueries({ queryKey: ['company-modules'] });
  };

  return {
    update: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.patch('/company', body),
      onSuccess: () => {
        toast.success('Dados da empresa atualizados');
        invalidate();
      },
      onError: handleError,
    }),
    setBusinessHours: useMutation({
      mutationFn: (hours: unknown[]) => api.put('/company/business-hours', { hours }),
      onSuccess: () => {
        toast.success('Horário de funcionamento salvo');
        invalidate();
      },
      onError: handleError,
    }),
    toggleModule: useMutation({
      mutationFn: (body: { module: string; enabled: boolean }) => api.patch('/company/modules', body),
      onSuccess: () => {
        toast.success('Módulos atualizados');
        invalidate();
      },
      onError: handleError,
    }),
  };
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  national: boolean;
}

export const useHolidays = (year: number) =>
  useApiQuery<Holiday[]>(['holidays', year], '/company/holidays', { year });

export function useHolidayMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['holidays'] });
    qc.invalidateQueries({ queryKey: ['appointments'] });
  };

  return {
    create: useMutation({
      mutationFn: (body: { date: string; name: string }) => api.post('/company/holidays', body),
      onSuccess: () => {
        toast.success('Dia fechado');
        invalidate();
      },
      onError: handleError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/company/holidays/${id}`),
      onSuccess: () => {
        toast.success('Dia reaberto');
        invalidate();
      },
      onError: handleError,
    }),
    importNational: useMutation({
      mutationFn: (target: number) =>
        api.post<{ imported: number; skipped: number }>('/company/holidays/import', {
          year: target,
        }),
      onSuccess: (result) => {
        toast.success(
          result.imported > 0
            ? `${result.imported} feriado(s) adicionado(s)`
            : 'Os feriados deste ano já estavam na lista',
        );
        invalidate();
      },
      onError: handleError,
    }),
  };
}

export function useUserMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  return {
    create: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post('/users', body),
      onSuccess: () => {
        toast.success('Usuário criado');
        invalidate();
      },
      onError: handleError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
        api.patch(`/users/${id}`, body),
      onSuccess: () => {
        toast.success('Usuário atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/users/${id}`),
      onSuccess: () => {
        toast.success('Usuário desativado');
        invalidate();
      },
      onError: handleError,
    }),
  };
}

export function useSubscriptionMutations() {
  const qc = useQueryClient();
  return {
    changePlan: useMutation({
      mutationFn: (planSlug: string) => api.post('/subscription/change-plan', { planSlug }),
      onSuccess: () => {
        toast.success('Plano alterado com sucesso');
        qc.invalidateQueries({ queryKey: ['subscription'] });
        qc.invalidateQueries({ queryKey: ['company-modules'] });
      },
      onError: handleError,
    }),
  };
}

/* ------------------------------------------------ Mutations do Super Admin */
export function useAdminMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-companies'] });
    qc.invalidateQueries({ queryKey: ['admin-metrics'] });
    qc.invalidateQueries({ queryKey: ['admin-plans'] });
  };

  return {
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: string }) =>
        api.patch(`/admin/companies/${id}/status`, { status }),
      onSuccess: () => {
        toast.success('Status da empresa atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    extendTrial: useMutation({
      mutationFn: ({ id, days }: { id: string; days: number }) =>
        api.post(`/admin/companies/${id}/extend-trial`, { days }),
      onSuccess: () => {
        toast.success('Período de teste estendido');
        invalidate();
      },
      onError: handleError,
    }),
    setPlan: useMutation({
      mutationFn: ({ id, planSlug }: { id: string; planSlug: string }) =>
        api.patch(`/admin/companies/${id}/plan`, { planSlug }),
      onSuccess: () => {
        toast.success('Plano da empresa atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    createCompany: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post('/admin/companies', body),
      onSuccess: () => {
        toast.success('Empresa criada');
        invalidate();
      },
      onError: handleError,
    }),
    createPlan: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post('/admin/plans', body),
      onSuccess: () => {
        toast.success('Plano criado');
        invalidate();
      },
      onError: handleError,
    }),
    updatePlan: useMutation({
      mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
        api.patch(`/admin/plans/${id}`, body),
      onSuccess: () => {
        toast.success('Plano atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    removePlan: useMutation({
      mutationFn: (id: string) => api.delete(`/admin/plans/${id}`),
      onSuccess: () => {
        toast.success('Plano removido');
        invalidate();
      },
      onError: handleError,
    }),
  };
}

/* ---------------------------------------------------------------- Turnos */
export const useShifts = () => useApiQuery<any[]>(['shifts'], '/shifts');

export const useShiftPrices = () =>
  useApiQuery<{
    shifts: { id: string; name: string; startsAt: string; endsAt: string }[];
    resources: {
      id: string;
      name: string;
      category: { id: string; name: string } | null;
      dailyRate: number | null;
      shiftPrices: { shiftId: string; price: number | null }[];
    }[];
  }>(['shift-prices'], '/shifts/prices');

export function useShiftMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['shifts'] });
    qc.invalidateQueries({ queryKey: ['shift-prices'] });
  };

  return {
    create: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post('/shifts', body),
      onSuccess: () => {
        toast.success('Turno criado');
        invalidate();
      },
      onError: handleError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
        api.patch(`/shifts/${id}`, body),
      onSuccess: () => {
        toast.success('Turno atualizado');
        invalidate();
      },
      onError: handleError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/shifts/${id}`),
      onSuccess: () => {
        toast.success('Turno removido');
        invalidate();
      },
      onError: handleError,
    }),
    seedDefaults: useMutation({
      mutationFn: () => api.post('/shifts/defaults'),
      onSuccess: () => {
        toast.success('Turnos Manhã, Tarde e Noite criados');
        invalidate();
      },
      onError: handleError,
    }),
    setPrices: useMutation({
      mutationFn: (body: { resourceId: string; prices: { shiftId: string; price: number }[] }) =>
        api.put('/shifts/prices', body),
      onSuccess: () => {
        toast.success('Preços salvos');
        invalidate();
      },
      onError: handleError,
    }),
  };
}

/* ------------------------------------------------------ Reservas de turno */
export interface RentalBooking {
  id: string;
  date: string;
  startsAt: string;
  endsAt: string;
  kind: 'SHIFT' | 'DAILY';
  price: number;
  paidAmount: number;
  status: 'RESERVED' | 'CONFIRMED' | 'CANCELED';
  paymentStatus: PaymentStatus;
  notes: string | null;
  resource: { id: string; name: string; category: { id: string; name: string } | null };
  professional: { id: string; name: string; color: string; avatarUrl: string | null; phone: string | null };
  shift: { id: string; name: string; startsAt: string; endsAt: string } | null;
}

export const useBookings = (params: Record<string, unknown> = {}) =>
  useApiQuery<Paginated<RentalBooking> & { totals: { status: string; amount: number; paidAmount: number }[] }>(
    ['bookings', params],
    '/rentals/bookings',
    params,
  );

export const useDayMap = (date: string) =>
  useApiQuery<{
    date: string;
    shifts: { id: string; name: string; startsAt: string; endsAt: string }[];
    resources: {
      id: string;
      name: string;
      category: { id: string; name: string } | null;
      daily: RentalBooking | null;
      shifts: { shiftId: string; booking: RentalBooking | null }[];
    }[];
  }>(['day-map', date], '/rentals/bookings/day-map', { date });

export const useBookingStats = () =>
  useApiQuery<{
    bookingsToday: number;
    bookingsNext30Days: number;
    pendingCount: number;
    pendingAmount: number;
    revenueNext30Days: number;
  }>(['booking-stats'], '/rentals/bookings/stats');

export interface BookingPeriod {
  resourceId: string;
  professionalId: string;
  date: string;
  until?: string;
  weekdays?: number[];
  kind: 'SHIFT' | 'DAILY';
  shiftIds?: string[];
  price?: number;
}

export interface BookingPreview {
  days: {
    date: string;
    shiftId: string | null;
    shift: string;
    price: number;
    available: boolean;
    reason: string | null;
  }[];
  total: number;
  available: number;
  blocked: number;
  amount: number;
}

/** Simula o período antes de gravar: quantos turnos, quais barrados, quanto dá. */
export function useBookingPreview(body: BookingPeriod | null) {
  return useQuery<BookingPreview>({
    queryKey: ['booking-preview', body],
    queryFn: () => api.post<BookingPreview>('/rentals/bookings/preview', body as never),
    enabled: Boolean(body),
    retry: false,
  });
}

export function useBookingMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bookings'] });
    qc.invalidateQueries({ queryKey: ['day-map'] });
    qc.invalidateQueries({ queryKey: ['booking-stats'] });
    qc.invalidateQueries({ queryKey: ['appointments'] });
    qc.invalidateQueries({ queryKey: ['financial-dashboard'] });
  };

  return {
    create: useMutation({
      mutationFn: (body: Record<string, unknown>) =>
        api.post<{ created: RentalBooking[]; skipped: { date: string; reason: string }[] }>(
          '/rentals/bookings',
          body,
        ),
      onSuccess: (data) => {
        const skipped = data.skipped.length;
        toast.success(
          `${data.created.length} turno(s) reservado(s)` +
            (skipped ? ` · ${skipped} dia(s) já ocupado(s)` : ''),
        );
        invalidate();
      },
      onError: handleError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
        api.patch(`/rentals/bookings/${id}`, body),
      onSuccess: () => {
        toast.success('Reserva atualizada');
        invalidate();
      },
      onError: handleError,
    }),
    pay: useMutation({
      mutationFn: ({ id, ...body }: { id: string; amount: number; paymentMethod: string }) =>
        api.post(`/rentals/bookings/${id}/pay`, body),
      onSuccess: () => {
        toast.success('Pagamento do turno registrado');
        invalidate();
      },
      onError: handleError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/rentals/bookings/${id}`),
      onSuccess: () => {
        toast.success('Reserva excluída');
        invalidate();
      },
      onError: handleError,
    }),
  };
}

// ===========================================================================
//  Cobrança da mensalidade
// ===========================================================================

export function useBilling(enabled = true) {
  return useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get<BillingOverview>('/billing'),
    enabled,
  });
}

export function useBillingMutations() {
  const qc = useQueryClient();
  // A cobrança muda o que o painel libera, então o contexto da empresa
  // precisa ser relido junto — senão a tela continua trancada depois de pagar.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['billing'] });
    qc.invalidateQueries({ queryKey: ['subscription'] });
    qc.invalidateQueries({ queryKey: ['me'] });
  };

  return {
    subscribe: useMutation({
      mutationFn: (body: { planSlug?: string; billingType: BillingType }) =>
        api.post<BillingOverview>('/billing/subscribe', body),
      onSuccess: () => {
        toast.success('Assinatura criada. A cobrança já está disponível abaixo.');
        invalidate();
      },
      onError: handleError,
    }),
    sync: useMutation({
      mutationFn: () => api.post<BillingOverview>('/billing/sync', {}),
      onSuccess: () => {
        toast.success('Cobranças atualizadas');
        invalidate();
      },
      onError: handleError,
    }),
    cancel: useMutation({
      mutationFn: () => api.post<BillingOverview>('/billing/cancel', {}),
      onSuccess: () => {
        toast.success('Assinatura cancelada');
        invalidate();
      },
      onError: handleError,
    }),
  };
}

// ===========================================================================
//  Senha
// ===========================================================================

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.post('/auth/change-password', body),
    onSuccess: () => toast.success('Senha alterada. As outras sessões foram encerradas.'),
    onError: handleError,
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (body: { email: string }) => api.post('/auth/forgot-password', body),
    onError: handleError,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { token: string; newPassword: string }) =>
      api.post('/auth/reset-password', body),
    onError: handleError,
  });
}

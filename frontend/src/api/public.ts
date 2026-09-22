import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Storefront {
  company: {
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string;
    publicDescription: string | null;
    publicCoverUrl: string | null;
    publicNotice: string | null;
    publicNoticeEnabled: boolean;
    phone: string | null;
    whatsapp: string | null;
    addressStreet: string | null;
    addressNumber: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressZip: string | null;
  };
  businessHours: {
    weekday: number;
    opensAt: string;
    closesAt: string;
    isClosed: boolean;
  }[];
  categories: { id: string; name: string; color: string }[];
  services: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    durationMinutes: number;
    categoryId: string | null;
  }[];
  professionals: {
    id: string;
    name: string;
    avatarUrl: string | null;
    color: string;
    specialties: string[];
    bio: string | null;
  }[];
}

export interface PublicProfessional {
  id: string;
  name: string;
  avatarUrl: string | null;
  color: string;
  specialties: string[];
  bio: string | null;
  publicSlug: string | null;
}

/** Vitrine individual: o link que cada profissional divulga. */
export interface ProfessionalStorefront {
  company: Storefront['company'];
  businessHours: Storefront['businessHours'];
  professional: PublicProfessional;
  categories: Storefront['categories'];
  services: Storefront['services'];
}

export function useProfessionalStorefront(slug: string, professionalSlug?: string) {
  return useQuery<ProfessionalStorefront>({
    queryKey: ['storefront', slug, professionalSlug],
    queryFn: () => api.get<ProfessionalStorefront>(`/public/${slug}/p/${professionalSlug}`),
    enabled: Boolean(professionalSlug),
    retry: false,
  });
}

export interface PublicSlot {
  time: string;
  startsAt: string;
  endsAt: string;
  resourceId: string | null;
  /** false quando alguem ja marcou: aparece apagado, sem sumir da lista. */
  disponivel: boolean;
}

export interface PublicAvailability {
  service: { id: string; name: string; durationMinutes: number; price: number };
  date: string;
  professionals: {
    professional: { id: string; name: string; avatarUrl: string | null; color: string };
    price: number;
    durationMinutes: number;
    slots: PublicSlot[];
  }[];
}

export function useStorefront(slug: string, enabled = true) {
  return useQuery<Storefront>({
    queryKey: ['storefront', slug],
    queryFn: () => api.get<Storefront>(`/public/${slug}`),
    enabled,
    retry: false,
  });
}

export function usePublicAvailability(
  slug: string,
  serviceId?: string,
  date?: string,
  professionalId?: string,
  ignoreAppointmentId?: string,
) {
  return useQuery<PublicAvailability>({
    queryKey: ['public-availability', slug, serviceId, date, professionalId, ignoreAppointmentId],
    queryFn: () =>
      api.get<PublicAvailability>(`/public/${slug}/availability`, {
        serviceId,
        date,
        professionalId,
        ignoreAppointmentId,
      }),
    enabled: Boolean(serviceId && date),
  });
}

export function usePublicAgenda(
  slug: string,
  serviceId?: string,
  from?: string,
  days = 14,
  professionalId?: string,
) {
  return useQuery<{ date: string; available: boolean }[]>({
    queryKey: ['public-agenda', slug, serviceId, from, days, professionalId],
    queryFn: () => api.get(`/public/${slug}/agenda/${serviceId}`, { from, days, professionalId }),
    enabled: Boolean(serviceId && from),
  });
}

export interface PublicBookingResult {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  professional: { id: string; name: string } | null;
  service: string;
  requiresApproval: boolean;
  /** Endereço do próprio horário: consultar, remarcar ou cancelar sem conta. */
  token: string | null;
}

/* ------------------------------- o horário da cliente, pelo link recebido */

export interface PublicAppointment {
  company: Storefront['company'];
  appointment: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    customerName: string;
    professional: { id: string; name: string; avatarUrl: string | null; publicSlug: string | null } | null;
    service: { serviceId: string; name: string; price: number; durationMinutes: number } | null;
    totalPrice: number;
    changeable: boolean;
  };
}

export function usePublicAppointment(slug: string, token?: string) {
  return useQuery<PublicAppointment>({
    queryKey: ['public-appointment', slug, token],
    queryFn: () => api.get<PublicAppointment>(`/public/${slug}/agendamento/${token}`),
    enabled: Boolean(token),
    retry: false,
  });
}

export function usePublicAppointmentActions(slug: string, token?: string) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ['public-appointment', slug, token] });

  return {
    cancel: useMutation({
      mutationFn: (reason?: string) =>
        api.post(`/public/${slug}/agendamento/${token}/cancelar`, { reason }),
      onSuccess: refresh,
    }),
    reschedule: useMutation({
      mutationFn: (startsAt: string) =>
        api.post(`/public/${slug}/agendamento/${token}/remarcar`, { startsAt }),
      onSuccess: refresh,
    }),
  };
}

export function usePublicBooking(slug: string) {
  return useMutation({
    mutationFn: (body: {
      serviceId: string;
      professionalId: string;
      startsAt: string;
      customer: { name: string; phone: string; email?: string };
      notes?: string;
    }) => api.post<PublicBookingResult>(`/public/${slug}/appointments`, body),
  });
}

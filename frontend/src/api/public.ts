import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Storefront {
  company: {
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string;
    publicDescription: string | null;
    phone: string | null;
    whatsapp: string | null;
    addressStreet: string | null;
    addressNumber: string | null;
    addressCity: string | null;
    addressState: string | null;
  };
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
) {
  return useQuery<PublicAvailability>({
    queryKey: ['public-availability', slug, serviceId, date, professionalId],
    queryFn: () =>
      api.get<PublicAvailability>(`/public/${slug}/availability`, {
        serviceId,
        date,
        professionalId,
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

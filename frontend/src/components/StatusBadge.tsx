import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  APPOINTMENT_STATUS,
  COMMISSION_STATUS,
  COMPANY_STATUS,
  PAYMENT_STATUS,
  RENTAL_STATUS,
  RESOURCE_STATUS,
} from '@/config/labels';
import type {
  AppointmentStatus,
  CommissionStatus,
  PaymentStatus,
  RentalStatus,
  ResourceStatus,
} from '@/types';

type Variant = BadgeProps['variant'];

function render(map: Record<string, { label: string; tone: string }>, value: string) {
  const entry = map[value] ?? { label: value, tone: 'secondary' };
  return <Badge variant={entry.tone as Variant}>{entry.label}</Badge>;
}

export const AppointmentStatusBadge = ({ status }: { status: AppointmentStatus }) =>
  render(APPOINTMENT_STATUS, status);

export const ResourceStatusBadge = ({ status }: { status: ResourceStatus }) =>
  render(RESOURCE_STATUS, status);

export const RentalStatusBadge = ({ status }: { status: RentalStatus }) =>
  render(RENTAL_STATUS, status);

export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) =>
  render(PAYMENT_STATUS, status);

export const CommissionStatusBadge = ({ status }: { status: CommissionStatus }) =>
  render(COMMISSION_STATUS, status);

export const CompanyStatusBadge = ({ status }: { status: string }) =>
  render(COMPANY_STATUS, status);

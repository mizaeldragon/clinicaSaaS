import { APPOINTMENT_STATUS, APPOINTMENT_STATUS_ORDER } from '@/config/labels';
import type { AppointmentStatus } from '@/types';

/**
 * O que cada cor da agenda quer dizer.
 *
 * Cor sem legenda é adivinhação — quem abre a agenda pela primeira vez não tem
 * como saber que verde é "finalizado". Fica discreta, numa linha só, e mostra
 * quantos atendimentos há de cada situação no período aberto: é a leitura que
 * a dona faz de manhã, "quantas ainda não confirmaram".
 *
 * Os status sem nenhum atendimento no período somem em vez de aparecerem
 * zerados; uma legenda com seis itens sempre visíveis viraria ruído.
 */
export function StatusLegend({ statuses }: { statuses: AppointmentStatus[] }) {
  const counts = new Map<AppointmentStatus, number>();
  for (const status of statuses) {
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  const shown = APPOINTMENT_STATUS_ORDER.filter((status) => counts.has(status));
  if (!shown.length) return null;

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {shown.map((status) => {
        const info = APPOINTMENT_STATUS[status];
        return (
          <li key={status} className="flex items-center gap-1.5" title={info.hint}>
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: `${info.color}33`, borderLeft: `3px solid ${info.color}` }}
              aria-hidden
            />
            {info.label}
            <span className="tabular-nums font-medium text-foreground">
              {counts.get(status)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

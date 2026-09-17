import { CalendarClock, Phone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEncaixes } from '@/api/queries';
import { currency, timeLabel, shortDate } from '@/lib/format';

/**
 * Os buracos do dia e quem caberia neles.
 *
 * Um vão de 45 minutos entre dois atendimentos não se vende sozinho: ninguém
 * passa na porta na hora certa. Mas quem pagaria por ele já está na agenda,
 * marcada para daqui a alguns dias — e prefere ser atendida antes.
 *
 * Sugere apenas antecipar, e apenas com a mesma profissional. É uma lista de
 * ligações a fazer, não uma remarcação automática: quem decide se vale mexer no
 * horário de alguém é quem atende.
 */
export function EncaixesCard({ data }: { data: string }) {
  const { data: vaos, isLoading } = useEncaixes(data);

  if (isLoading || !vaos || vaos.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4 text-primary" />
          Encaixes possíveis
        </CardTitle>
        <CardDescription>
          {vaos.length === 1
            ? 'Um intervalo aberto neste dia pode ser preenchido'
            : `${vaos.length} intervalos abertos neste dia podem ser preenchidos`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {vaos.map((vao) => (
          <div key={`${vao.professional.id}-${vao.comecaEm}`} className="rounded-lg border border-border/70 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{vao.professional.name}</p>
              <p className="text-xs text-muted-foreground">
                {timeLabel(vao.comecaEm)} às {timeLabel(vao.terminaEm)} · {vao.minutos} min livres
              </p>
            </div>

            <div className="mt-2.5 space-y-2">
              {vao.candidatas.map((candidata) => (
                <div
                  key={candidata.appointmentId}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <span className="font-medium">{candidata.customer.name}</span>
                      {candidata.servico ? (
                        <span className="text-muted-foreground"> · {candidata.servico}</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Hoje marcada para {shortDate(candidata.marcadaPara)} ·{' '}
                      {candidata.motivos.join(' · ')}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold">{currency(candidata.valor)}</span>
                    {candidata.customer.phone ? (
                      <a
                        href={`https://wa.me/55${candidata.customer.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-card px-2 py-1 text-[11px] font-medium shadow-soft transition-colors hover:bg-secondary"
                      >
                        <Phone className="size-3" />
                        Convidar
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

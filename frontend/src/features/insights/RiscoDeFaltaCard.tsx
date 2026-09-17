import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, Phone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRiscoDeFalta, type AtendimentoEmRisco } from '@/api/queries';
import { currency, dateTimeLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Quem provavelmente não vem nos próximos dias.
 *
 * O cartão mostra o motivo junto da nota, e não só a nota. Uma porcentagem
 * solta não muda o comportamento de ninguém: a recepção liga para confirmar
 * quando entende que aquela cliente faltou nas últimas duas vezes e marcou
 * sozinha pelo link há três semanas.
 *
 * Aparece calado quando não há risco alto — um cartão que grita todo dia vira
 * um cartão que ninguém lê.
 */

function Linha({ atendimento }: { atendimento: AtendimentoEmRisco }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="rounded-lg border border-border/70">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center gap-3 p-3 text-left"
        aria-expanded={aberto}
      >
        <span
          className={cn(
            'flex size-11 shrink-0 flex-col items-center justify-center rounded-lg text-sm font-semibold',
            atendimento.faixa === 'alto'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-warning/15 text-warning-foreground',
          )}
        >
          {Math.round(atendimento.risco * 100)}%
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{atendimento.customer.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {dateTimeLabel(atendimento.startsAt)}
            {atendimento.servico ? ` · ${atendimento.servico}` : ''}
            {' · '}
            {currency(atendimento.valor)}
          </p>
        </div>

        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-180')}
        />
      </button>

      {aberto ? (
        <div className="space-y-2 border-t border-border/60 px-3 py-3">
          <ul className="space-y-1.5">
            {atendimento.motivos.map((motivo) => (
              <li key={motivo.texto} className="flex items-start gap-2 text-xs">
                <span
                  className={cn(
                    'mt-px font-bold',
                    motivo.direcao === 'cima' ? 'text-destructive' : 'text-success',
                  )}
                  aria-hidden
                >
                  {motivo.direcao === 'cima' ? '▲' : '▼'}
                </span>
                <span className="text-muted-foreground">{motivo.texto}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 pt-1">
            {atendimento.customer.phone ? (
              <a
                href={`https://wa.me/55${atendimento.customer.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-secondary/70"
              >
                <Phone className="size-3.5" />
                Confirmar por WhatsApp
              </a>
            ) : null}
            <Link
              to="/app/agenda"
              className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:underline"
            >
              Ver na agenda
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RiscoDeFaltaCard() {
  const { data, isLoading } = useRiscoDeFalta(7);

  if (isLoading || !data) return null;

  // Sem histórico não há o que prever, e um cartão dizendo isso só ocupa espaço.
  if (data.baseadoEm < 12) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" />
              Risco de falta
            </CardTitle>
            <CardDescription>
              Próximos 7 dias · {data.total} {data.total === 1 ? 'atendimento' : 'atendimentos'}
            </CardDescription>
          </div>
          {data.emRisco > 0 ? (
            <Badge variant="warning">{currency(data.valorEmRisco)} em risco</Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {data.emRisco === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Nenhum atendimento de risco alto na semana. A taxa de falta da casa é{' '}
            {data.taxaEmTexto}.
          </p>
        ) : (
          <>
            {data.principais.map((atendimento) => (
              <Linha key={atendimento.appointmentId} atendimento={atendimento} />
            ))}
            <p className="pt-1 text-[11px] text-muted-foreground">
              Calculado sobre {data.baseadoEm} atendimentos já realizados. A taxa média da casa é{' '}
              {data.taxaEmTexto}.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

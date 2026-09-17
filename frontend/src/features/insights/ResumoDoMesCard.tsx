import { useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useResumoDoMes } from '@/api/queries';
import { cn } from '@/lib/utils';

/**
 * O mês em palavras.
 *
 * Os gráficos acima respondem "quanto" muito bem e "e daí?" muito mal. Aqui
 * está a leitura que a dona do espaço faria em voz alta para o contador:
 * cresceu ou caiu, por causa do quê, e o que merece atenção.
 *
 * Cada frase sai de uma conta sobre os dados dela — nada é gerado por modelo de
 * linguagem. Num resumo financeiro, um número inventado é pior que resumo
 * nenhum, porque ninguém iria conferir.
 */

function mesAnterior(mes: string): string {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesSeguinte(mes: string): string {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function ResumoDoMesCard() {
  const [mes, setMes] = useState(mesAtual);
  const { data, isLoading } = useResumoDoMes(mes);

  const ehAtual = mes === mesAtual();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              O mês em resumo
            </CardTitle>
            <CardDescription className="capitalize">
              {data?.rotulo ?? '—'}
              {ehAtual ? ' (em andamento)' : ''}
            </CardDescription>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMes(mesAnterior(mes))}
              aria-label="Mês anterior"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMes(mesSeguinte(mes))}
              disabled={ehAtual}
              aria-label="Mês seguinte"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading || !data ? (
          <p className="py-2 text-sm text-muted-foreground">Lendo os números…</p>
        ) : (
          <ul className="space-y-2.5">
            {data.destaques.map((destaque) => (
              <li key={destaque.texto} className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-1.5 size-1.5 shrink-0 rounded-full',
                    destaque.tom === 'bom' && 'bg-success',
                    destaque.tom === 'ruim' && 'bg-destructive',
                    destaque.tom === 'neutro' && 'bg-muted-foreground/40',
                  )}
                  aria-hidden
                />
                <span className="text-sm leading-relaxed">{destaque.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

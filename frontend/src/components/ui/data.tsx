import * as React from 'react';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Card } from './card';

/* ------------------------------------------------------------------ Table
 *
 * No celular a tabela vira uma pilha de cartões — quem faz isso é o CSS
 * (`.tabela-cards`, em globals.css). O que falta lá é o rótulo de cada valor,
 * e é o que este componente resolve aqui.
 *
 * Copiar o texto de cada `<th>` para o `data-label` da célula da mesma coluna
 * poderia ser feito à mão, tabela por tabela — são quinze no sistema, e toda
 * coluna nova depois dependeria de alguém lembrar. Lendo do próprio cabeçalho
 * depois que o navegador montou, nenhuma delas precisou ser editada, e as
 * futuras já nascem certas.
 */
export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  const ref = React.useRef<HTMLTableElement>(null);

  // Sem lista de dependências de propósito: a tabela muda de conteúdo a cada
  // página, filtro e ordenação, e os rótulos precisam acompanhar. O custo é
  // percorrer algumas dezenas de células — as listas todas são paginadas.
  React.useEffect(() => {
    const table = ref.current;
    if (!table) return;

    const titulos = Array.from(table.querySelectorAll('thead th')).map((th) =>
      (th.textContent ?? '').trim(),
    );
    if (!titulos.length) return;

    for (const linha of Array.from(table.querySelectorAll('tbody tr'))) {
      const celulas = Array.from(linha.children) as HTMLTableCellElement[];

      // Linha de uma célula só que atravessa a tabela ("Nenhum registro"):
      // não é par de rótulo e valor, então fica sem rótulo.
      if (celulas.length === 1 && celulas[0].colSpan > 1) {
        delete celulas[0].dataset.label;
        continue;
      }

      celulas.forEach((celula, indice) => {
        const titulo = titulos[indice];
        if (titulo) celula.dataset.label = titulo;
        else delete celula.dataset.label;
      });
    }
  });

  return (
    <div className="tabela-cards w-full sm:overflow-x-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('border-b border-border/70 transition-colors hover:bg-muted/50', className)}
      {...props}
    />
  );
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-11 whitespace-nowrap px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle', className)} {...props} />;
}

/* ------------------------------------------------------------- Pagination */
export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <p className="px-1 py-3 text-xs text-muted-foreground">
        {total} {total === 1 ? 'registro' : 'registros'}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-1 py-3">
      <p className="text-xs text-muted-foreground">
        Página {page} de {totalPages} · {total} registros
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- StatCard */
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  className?: string;
}

const toneStyles: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/12 text-emerald-600',
  danger: 'bg-rose-500/12 text-rose-600',
  warning: 'bg-amber-500/15 text-amber-600',
  info: 'bg-sky-500/12 text-sky-600',
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'default', className }: StatCardProps) {
  return (
    <Card className={cn('p-5 transition-shadow hover:shadow-pop', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-2xl font-semibold tracking-tight">{value}</p>
          {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        {Icon ? (
          <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', toneStyles[tone])}>
            <Icon className="size-5" />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------- PageHeader */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

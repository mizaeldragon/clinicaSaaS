import * as React from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/* --------------------------------------------------------------- Skeleton */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} {...props} />;
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-3">
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton
              key={col}
              className={cn('h-11 flex-1', col === 0 && 'max-w-[240px]')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Spinner */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-muted-foreground', className)} />;
}

export function PageLoader({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Spinner className="size-6" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------- EmptyState */
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center',
        className,
      )}
    >
      {Icon ? (
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-7" />
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="font-semibold">{title}</h3>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Button onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- ErrorState */
export function ErrorState({
  message = 'Não foi possível carregar as informações.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

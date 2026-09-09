import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarOff, Download, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/primitives';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { useHolidayMutations, useHolidays } from '@/api/queries';
import { calendarDate } from '@/lib/format';

/**
 * Dias em que a empresa não atende.
 *
 * Vale acima do horário de funcionamento: nesses dias a agenda recusa
 * agendamento e o link público não oferece horário nenhum. Serve tanto para o
 * feriado nacional quanto para o fechamento próprio da casa.
 */
export function HolidaysCard({ canManage }: { canManage: boolean }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = useHolidays(year);
  const { create, remove, importNational } = useHolidayMutations();

  const [form, setForm] = useState({ date: '', name: '' });

  const years = [year - 1, year, year + 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feriados e fechamentos</CardTitle>
        <CardDescription>
          Nestes dias a agenda não aceita atendimento e o link público não oferece horário
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {years.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={option === year ? 'default' : 'outline'}
              onClick={() => setYear(option)}
            >
              {option}
            </Button>
          ))}

          {canManage ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto"
              loading={importNational.isPending}
              onClick={() => importNational.mutate(year)}
            >
              <Download />
              Trazer feriados nacionais
            </Button>
          ) : null}
        </div>

        {canManage ? (
          <form
            className="grid gap-3 rounded-lg border border-border/70 p-3 sm:grid-cols-[160px_1fr_auto] sm:items-end"
            onSubmit={async (event) => {
              event.preventDefault();
              await create
                .mutateAsync({ date: form.date, name: form.name })
                .then(() => setForm({ date: '', name: '' }))
                .catch(() => undefined);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="holiday-date">Dia</Label>
              <Input
                id="holiday-date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="holiday-name">Motivo</Label>
              <Input
                id="holiday-name"
                required
                placeholder="Recesso, reforma, aniversário da cidade..."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <Button type="submit" loading={create.isPending}>
              <Plus />
              Fechar dia
            </Button>
          </form>
        ) : null}

        {isLoading ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : !data?.length ? (
          <EmptyState
            icon={CalendarOff}
            title={`Nenhum dia fechado em ${year}`}
            description="Traga os feriados nacionais ou marque os dias em que a casa não abre."
          />
        ) : (
          <ul className="divide-y rounded-lg border">
            {data.map((holiday) => (
              <li key={holiday.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                  {format(calendarDate(holiday.date), "dd 'de' MMM", { locale: ptBR })}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{holiday.name}</span>
                {holiday.national ? <Badge variant="secondary">Nacional</Badge> : null}
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remover ${holiday.name}`}
                    onClick={() => remove.mutate(holiday.id)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

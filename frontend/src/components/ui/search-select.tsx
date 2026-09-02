import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './primitives';

export interface Option {
  value: string;
  label: string;
  description?: string;
  color?: string;
}

interface SearchSelectProps {
  options: Option[];
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

/** Select com busca — usado para clientes, profissionais e serviços. */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecionar...',
  emptyText = 'Nenhum resultado',
  className,
  disabled,
  allowClear,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) ||
        option.description?.toLowerCase().includes(term),
    );
  }, [options, search]);

  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate">
            {selected ? (
              <span className="flex items-center gap-2">
                {selected.color ? (
                  <span className="size-2 rounded-full" style={{ backgroundColor: selected.color }} />
                ) : null}
                {selected.label}
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b p-2">
          <Input
            autoFocus
            icon={<Search />}
            placeholder="Buscar..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 border-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          {allowClear && selected ? (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-secondary"
            >
              Limpar seleção
            </button>
          ) : null}

          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setSearch('');
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary',
                  option.value === value && 'bg-secondary',
                )}
              >
                {option.color ? (
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {option.description ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {option.value === value ? <Check className="size-4 text-primary" /> : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

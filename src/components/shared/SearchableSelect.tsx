/**
 * SearchableSelect — combobox con búsqueda por texto (Popover + Command).
 * Reemplazo drop-in de los Select simples en listas largas: el usuario puede
 * escribir para filtrar en vez de scrollear.
 */

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '../ui/command';
import { cn } from '../ui/utils';

export interface SearchableOption {
  value: string;
  label: string;
  /** Texto extra para el match de búsqueda (ej. código + nombre) */
  keywords?: string;
}

interface SearchableSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Si true, incluye la opción "nullLabel" que limpia la selección */
  nullable?: boolean;
  nullLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  searchPlaceholder = 'Escribe para buscar…',
  emptyText = 'Sin resultados',
  nullable = false,
  nullLabel = 'Ninguno',
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
        <Command
          filter={(v, search, keywords) => {
            const haystack = `${v} ${(keywords ?? []).join(' ')}`.toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {nullable && (
                <CommandItem
                  value="__none__"
                  onSelect={() => { onChange(null); setOpen(false); }}
                >
                  <Check className={cn('mr-2 size-4', value === null ? 'opacity-100' : 'opacity-0')} />
                  {nullLabel}
                </CommandItem>
              )}
              {options.map(o => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  keywords={o.keywords ? [o.keywords] : undefined}
                  onSelect={() => { onChange(o.value); setOpen(false); }}
                >
                  <Check className={cn('mr-2 size-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

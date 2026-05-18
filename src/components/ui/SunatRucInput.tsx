/**
 * SunatRucInput — Input de RUC con búsqueda SUNAT integrada.
 * Al ingresar 11 dígitos, consulta automáticamente la API de SUNAT
 * y notifica al padre con los datos encontrados.
 */
import { useState, useRef } from 'react';
import { Search, Loader2, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { Input } from './input';
import { Button } from './button';
import { Badge } from './badge';
import { cn } from './utils';
import { consultarRUC, type SunatRucResult } from '../../lib/sunat/sunat-service';

interface SunatRucInputProps {
  value: string;
  onChange: (value: string) => void;
  onSunatData?: (data: SunatRucResult) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

type QueryStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error';

export function SunatRucInput({
  value,
  onChange,
  onSunatData,
  disabled,
  error,
  className,
}: SunatRucInputProps) {
  const [status, setStatus] = useState<QueryStatus>('idle');
  const [sunatData, setSunatData] = useState<SunatRucResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 11);
    onChange(v);
    setSunatData(null);
    setStatus('idle');

    // Auto-search when 11 digits entered
    if (v.length === 11) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => buscar(v), 500);
    }
  };

  const buscar = async (ruc?: string) => {
    const rucToSearch = (ruc ?? value).replace(/\D/g, '');
    if (rucToSearch.length !== 11) return;

    setStatus('loading');
    const result = await consultarRUC(rucToSearch);

    if (!result) {
      setStatus('not_found');
      return;
    }

    setSunatData(result);
    setStatus('found');
    onSunatData?.(result);
  };

  const limpiar = () => {
    onChange('');
    setSunatData(null);
    setStatus('idle');
  };

  const statusIcon = {
    idle: null,
    loading: <Loader2 className="size-4 animate-spin text-muted-foreground" />,
    found: <CheckCircle className="size-4 text-green-600" />,
    not_found: <XCircle className="size-4 text-red-500" />,
    error: <AlertCircle className="size-4 text-amber-500" />,
  }[status];

  const condicionColor = {
    'HABIDO': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'NO HABIDO': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }[sunatData?.condicion ?? ''] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={value}
            onChange={handleChange}
            placeholder="Ej: 20123456789"
            maxLength={11}
            disabled={disabled}
            className={cn(
              'pr-8',
              error && 'border-destructive',
              status === 'found' && 'border-green-500',
            )}
          />
          {statusIcon && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {statusIcon}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || value.length !== 11 || status === 'loading'}
          onClick={() => buscar()}
          className="shrink-0"
        >
          <Search className="size-4" />
          Buscar
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={limpiar}
            disabled={disabled}
            className="shrink-0 px-2"
          >
            <XCircle className="size-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Resultado SUNAT */}
      {status === 'found' && sunatData && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-green-900">{sunatData.razonSocial}</span>
            <Badge className={cn('text-xs', condicionColor)}>{sunatData.condicion}</Badge>
            <Badge variant="outline" className="text-xs">{sunatData.estado}</Badge>
          </div>
          {sunatData.nombreComercial && (
            <p className="text-xs text-green-700">Nombre comercial: {sunatData.nombreComercial}</p>
          )}
          {sunatData.direccion && (
            <p className="text-xs text-green-700">
              {[sunatData.direccion, sunatData.distrito, sunatData.provincia, sunatData.departamento]
                .filter(Boolean).join(', ')}
            </p>
          )}
          {sunatData.actividadEconomica && (
            <p className="text-xs text-muted-foreground">Actividad: {sunatData.actividadEconomica}</p>
          )}
        </div>
      )}

      {status === 'not_found' && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <XCircle className="size-3" />
          RUC no encontrado en SUNAT
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

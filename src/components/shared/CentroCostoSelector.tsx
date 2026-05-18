/**
 * Selector de Centro de Costo — dropdown reutilizable
 * Muestra centros de costo activos
 */

import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useCentrosCosto } from '../../lib/centros-costo/centros-costo-store';

interface CentroCostoSelectorProps {
  value: string | null;
  onChange: (id: string | null) => void;
  /** Si true, muestra opción "Sin centro de costo" */
  nullable?: boolean;
  disabled?: boolean;
  className?: string;
}

export function CentroCostoSelector({
  value,
  onChange,
  nullable = true,
  disabled = false,
  className,
}: CentroCostoSelectorProps) {
  const { t } = useTranslation();
  const { centrosCosto } = useCentrosCosto();

  // Solo mostrar activos
  const activos = centrosCosto.filter(cc => cc.activo);

  return (
    <Select
      value={value ?? '__none__'}
      onValueChange={v => onChange(v === '__none__' ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={t('selectors.select_cost_center', 'Seleccionar centro de costo')} />
      </SelectTrigger>
      <SelectContent>
        {nullable && (
          <SelectItem value="__none__">
            {t('selectors.no_cost_center', 'Sin centro de costo')}
          </SelectItem>
        )}
        {activos.map(cc => (
          <SelectItem key={cc._dbId} value={cc._dbId}>
            {cc.codigo} — {cc.nombre}
          </SelectItem>
        ))}
        {activos.length === 0 && (
          <SelectItem value="__empty__" disabled>
            {t('selectors.no_cost_centers_available', 'No hay centros de costo disponibles')}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

/**
 * Selector de Centro de Costo — combobox reutilizable CON BÚSQUEDA
 * Muestra centros de costo activos; escribe para filtrar.
 */

import { useTranslation } from 'react-i18next';
import { SearchableSelect } from './SearchableSelect';
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
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={activos.map(cc => ({
        value: cc._dbId,
        label: `${cc.codigo} — ${cc.nombre}`,
      }))}
      placeholder={t('selectors.select_cost_center', 'Seleccionar centro de costo')}
      searchPlaceholder={t('selectors.search_cost_center', 'Buscar centro de costo…')}
      emptyText={t('selectors.no_cost_centers_available', 'No hay centros de costo disponibles')}
      nullable={nullable}
      nullLabel={t('selectors.no_cost_center', 'Sin centro de costo')}
      disabled={disabled}
      className={className}
    />
  );
}

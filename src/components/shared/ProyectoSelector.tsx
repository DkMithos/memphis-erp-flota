/**
 * Selector de Proyecto — combobox reutilizable CON BÚSQUEDA
 * Muestra proyectos activos (en_ejecucion, planificacion); escribe para filtrar.
 */

import { useTranslation } from 'react-i18next';
import { SearchableSelect } from './SearchableSelect';
import { useProyectos } from '../../lib/proyectos/proyectos-store';

interface ProyectoSelectorProps {
  value: string | null;
  onChange: (id: string | null) => void;
  /** Si true, muestra opción "Sin proyecto" */
  nullable?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ProyectoSelector({
  value,
  onChange,
  nullable = true,
  disabled = false,
  className,
}: ProyectoSelectorProps) {
  const { t } = useTranslation();
  const { proyectos } = useProyectos();

  // Filtrar solo proyectos activos (planificacion, en_ejecucion)
  const proyectosActivos = proyectos.filter(
    p => p.estado === 'planificacion' || p.estado === 'en_ejecucion'
  );

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={proyectosActivos.map(p => ({
        value: p._dbId,
        label: `${p.id} — ${p.nombre}`,
        keywords: `${p.entidadCliente ?? ''} ${p.region ?? ''}`,
      }))}
      placeholder={t('selectors.select_project', 'Seleccionar proyecto')}
      searchPlaceholder={t('selectors.search_project', 'Buscar proyecto…')}
      emptyText={t('selectors.no_projects_available', 'No hay proyectos disponibles')}
      nullable={nullable}
      nullLabel={t('selectors.no_project', 'Sin proyecto')}
      disabled={disabled}
      className={className}
    />
  );
}

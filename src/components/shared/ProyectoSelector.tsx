/**
 * Selector de Proyecto — combobox reutilizable CON BÚSQUEDA.
 *
 * Muestra los proyectos que todavía pueden recibir gasto. Eso incluye los que
 * están EN LIQUIDACIÓN: es justo la etapa en la que aterrizan los últimos
 * costos. Dejarlos fuera hacía que GORE ICA — el único en liquidación — no
 * apareciera al registrar un requerimiento, y Compras no tenía dónde imputarlo.
 * Se marcan, para que quien lo elige sepa que el proyecto ya va de salida.
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

  const IMPUTABLES = ['planificacion', 'en_ejecucion', 'liquidacion'];
  const proyectosActivos = proyectos.filter(p => IMPUTABLES.includes(p.estado));

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={proyectosActivos.map(p => ({
        value: p._dbId,
        label: p.estado === 'liquidacion'
          ? `${p.id} — ${p.nombre} · en liquidación`
          : `${p.id} — ${p.nombre}`,
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

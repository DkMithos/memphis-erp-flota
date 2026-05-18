/**
 * Selector de Proyecto — dropdown reutilizable
 * Muestra proyectos activos (en_ejecucion, planificacion)
 */

import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
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
    <Select
      value={value ?? '__none__'}
      onValueChange={v => onChange(v === '__none__' ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={t('selectors.select_project', 'Seleccionar proyecto')} />
      </SelectTrigger>
      <SelectContent>
        {nullable && (
          <SelectItem value="__none__">
            {t('selectors.no_project', 'Sin proyecto')}
          </SelectItem>
        )}
        {proyectosActivos.map(p => (
          <SelectItem key={p._dbId} value={p._dbId}>
            {p.id} — {p.nombre}
          </SelectItem>
        ))}
        {proyectosActivos.length === 0 && (
          <SelectItem value="__empty__" disabled>
            {t('selectors.no_projects_available', 'No hay proyectos disponibles')}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

/**
 * BotonExportar — el mismo botón de exportar en todas las pantallas.
 *
 * Existe para no repetir doce veces el mismo bloque (permiso + estado vacío +
 * nombre de archivo con fecha + aviso). Exporta **lo que está filtrado en
 * pantalla**, que es lo que pidió Kevin: "cada uno debe poder extraer todo lo
 * que requiera".
 *
 * El permiso se comprueba aquí y también en el manejador, no solo escondiendo
 * el botón: un botón oculto no es un control.
 */
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { usePermissions, type Modulo } from '../../lib/rbac/usePermissions';
import { exportToExcel } from '../../lib/shared/export-utils';

interface Props<T extends Record<string, unknown>> {
  /** Módulo cuyo permiso `exportar` se exige. */
  modulo: Modulo;
  /** Nombre base del archivo; se le añade la fecha. */
  nombre: string;
  /** Filas ya filtradas, tal como se ven. */
  datos: T[];
  /** Clave → título de columna, en el orden en que deben salir. */
  headers: Record<string, string>;
  /** Nombre de la hoja dentro del libro. */
  hoja?: string;
  etiqueta?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm';
  className?: string;
}

export function BotonExportar<T extends Record<string, unknown>>({
  modulo, nombre, datos, headers, hoja = 'Datos',
  etiqueta = 'Exportar', variant = 'outline', size = 'default', className,
}: Props<T>) {
  const { can } = usePermissions();
  const puedeExportar = can(modulo, 'exportar');
  const [exportando, setExportando] = useState(false);

  const exportar = async () => {
    if (!puedeExportar) return;
    if (datos.length === 0) { toast.error('No hay nada que exportar con estos filtros'); return; }
    setExportando(true);
    try {
      const fecha = new Date().toISOString().slice(0, 10);
      await exportToExcel(`${nombre}-${fecha}`, datos, headers as Record<keyof T, string>, hoja);
      toast.success(`${datos.length} fila(s) exportadas`);
    } catch (e) {
      toast.error('No se pudo exportar: ' + (e instanceof Error ? e.message : 'error'));
    } finally {
      setExportando(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={exportar}
      disabled={!puedeExportar || exportando || datos.length === 0}
      title={!puedeExportar ? 'No tienes permiso para exportar este módulo' : undefined}
    >
      <Download className="size-4" />
      {exportando ? 'Exportando…' : etiqueta}
    </Button>
  );
}

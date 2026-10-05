/**
 * Paginador — los controles de página que van debajo de cualquier tabla larga.
 *
 * Regla del proyecto (Kevin, 05/10/2026): todo lo que tenga bastante data se
 * pagina; nadie debería scrollear 100 filas para llegar a un botón. Se usa con
 * `usePagination` y pinta lo mismo que ya pintaban Órdenes y Requerimientos,
 * para que todo el ERP se vea igual. Con una sola página no dibuja nada.
 */
import { Button } from '../ui/button';

interface Props {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  setPage: (p: number) => void;
  /** Qué se cuenta: "participantes", "cartas"… Por defecto "registros". */
  nombre?: string;
  className?: string;
}

export function Paginador({ page, totalPages, totalItems, pageSize, setPage, nombre = 'registros', className = '' }: Props) {
  if (totalPages <= 1) return null;
  const desde = (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, totalItems);
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t ${className}`}>
      <span className="text-sm text-muted-foreground">
        {desde}–{hasta} de {totalItems} {nombre} · Página {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
          Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}

/** Número de fila absoluto (1-based) para la columna "#": no se reinicia en cada página. */
export const numeroDeFila = (page: number, pageSize: number, indice: number) => (page - 1) * pageSize + indice + 1;

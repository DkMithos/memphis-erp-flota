/**
 * Centro de notificaciones (/notificaciones): todo lo que le corresponde a esta persona, no solo
 * las 20 de la campana. Se alimenta del mismo hook (una sola suscripción por pestaña), así que
 * marcar leído aquí se refleja en la campana y viceversa. Paginado de 20 en 20 (regla de Kevin).
 */
import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, CheckCircle2, AlertTriangle, Info, XCircle, Inbox } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { PageNav } from '../shared/PageNav';
import { Paginador } from '../shared/Paginador';
import { usePagination } from '@/lib/shared/usePagination';
import { useNotifications, type Notificacion } from '@/lib/shared/useNotifications';

const ICONO: Record<Notificacion['tipo'], React.ReactNode> = {
  success: <CheckCircle2 className="size-4 text-green-500" />,
  warning: <AlertTriangle className="size-4 text-amber-500" />,
  error: <XCircle className="size-4 text-red-500" />,
  info: <Info className="size-4 text-blue-500" />,
};

/** A qué pantalla lleva cada aviso (misma tabla que la campana). */
export function rutaDeNotificacion(n: Pick<Notificacion, 'entidadTipo' | 'entidadId'>): string | undefined {
  const id = n.entidadId;
  const rutas: Record<string, string> = {
    orden_trabajo: '/flota/mantenimientos',
    tarea: '/proyectos/tareas',
    orden_compra: id ? `/compras/ordenes/${id}` : '/compras/ordenes',
    requerimiento: id ? `/compras/requerimientos/${id}` : '/compras/requerimientos',
    cotizacion: id ? `/compras/cotizaciones/${id}` : '/compras/cotizaciones',
    proyecto: id ? `/proyectos/360/${id}` : '/proyectos',
    articulo: '/inventario/articulos',
    proveedor: id ? `/proveedores/directorio/${id}` : '/proveedores/directorio',
    factura: '/compras/facturas',
    factura_proveedor: '/compras/facturas',
    viaje: id ? `/viajes/${id}` : '/viajes',
    lote_pago: '/finanzas/lotes-pago',
    caja_chica: '/finanzas/caja-chica',
    vencimientos: '/flota',
    carta_fianza: '/fianzas',
  };
  return n.entidadTipo ? rutas[n.entidadTipo] : undefined;
}

const ETIQUETA_ENTIDAD: Record<string, string> = {
  orden_compra: 'Órdenes', viaje: 'Viajes', lote_pago: 'Lotes de pago', caja_chica: 'Caja chica', vencimientos: 'Vencimientos',
  orden_trabajo: 'OT', tarea: 'Tareas', proyecto: 'Proyectos', factura: 'Facturas', factura_proveedor: 'Facturas',
  proveedor: 'Proveedores', requerimiento: 'Requerimientos', cotizacion: 'Cotizaciones', carta_fianza: 'Fianzas',
};

const fechaHora = (s: string) => new Date(s).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

export function NotificacionesCentro({ onNavigate }: { onNavigate?: (ruta: string) => void }) {
  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas } = useNotifications();
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [entidad, setEntidad] = useState('');

  const entidades = useMemo(
    () => Array.from(new Set(notificaciones.map(n => n.entidadTipo).filter((x): x is string => !!x))).sort(),
    [notificaciones],
  );
  const filtradas = useMemo(
    () => notificaciones.filter(n => (!soloPendientes || !n.leida) && (!entidad || n.entidadTipo === entidad)),
    [notificaciones, soloPendientes, entidad],
  );
  const pag = usePagination(filtradas, 20);
  useEffect(() => { pag.reset(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [soloPendientes, entidad]);

  const abrir = (n: Notificacion) => {
    if (!n.leida) void marcarLeida(n.id);
    const destino = rutaDeNotificacion(n);
    if (destino) onNavigate?.(destino);
  };

  return (
    <div className="space-y-4">
      <PageNav />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Bell className="size-6" /> Notificaciones</h1>
          <p className="text-sm text-muted-foreground">
            Lo que te corresponde: aprobaciones que te tocan, resultados de lo que pediste y avisos de tus módulos.
            {noLeidas > 0 ? ` Tienes ${noLeidas} sin leer.` : ' Estás al día.'}
          </p>
        </div>
        {noLeidas > 0 && <Button variant="outline" onClick={() => void marcarTodasLeidas()}><CheckCheck className="size-4" /> Marcar todas como leídas</Button>}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{soloPendientes ? 'Pendientes' : 'Todas'} ({filtradas.length})</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant={soloPendientes ? 'default' : 'outline'} onClick={() => setSoloPendientes(true)}>Pendientes</Button>
              <Button size="sm" variant={!soloPendientes ? 'default' : 'outline'} onClick={() => setSoloPendientes(false)}>Todas</Button>
              <select className="h-8 rounded-md border bg-background px-2 text-sm" value={entidad} onChange={e => setEntidad(e.target.value)}>
                <option value="">Todos los tipos</option>
                {entidades.map(e => <option key={e} value={e}>{ETIQUETA_ENTIDAD[e] ?? e}</option>)}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtradas.length === 0 && (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Inbox className="size-8" />
              {soloPendientes ? 'No tienes notificaciones pendientes.' : 'Sin notificaciones con esos filtros.'}
            </div>
          )}
          <ul className="divide-y">
            {pag.paged.map(n => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => abrir(n)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-accent transition-colors ${!n.leida ? 'bg-accent/40' : ''}`}
                >
                  <span className="mt-0.5 shrink-0">{ICONO[n.tipo] ?? ICONO.info}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm ${!n.leida ? 'font-medium' : ''}`}>{n.titulo}</span>
                      {n.dirigida && <Badge variant="outline" className="text-[10px]">para ti</Badge>}
                      {n.entidadTipo && <Badge variant="secondary" className="text-[10px]">{ETIQUETA_ENTIDAD[n.entidadTipo] ?? n.entidadTipo}</Badge>}
                    </span>
                    {n.mensaje && <span className="block text-xs text-muted-foreground mt-0.5">{n.mensaje}</span>}
                    <span className="block text-xs text-muted-foreground mt-1">{fechaHora(n.creadoEn)}</span>
                  </span>
                  {!n.leida && <span className="size-2 rounded-full bg-primary mt-2 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
          <Paginador page={pag.page} totalPages={pag.totalPages} totalItems={pag.totalItems} pageSize={pag.pageSize} setPage={pag.setPage} nombre="notificaciones" />
        </CardContent>
      </Card>
    </div>
  );
}

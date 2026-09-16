/**
 * MÓDULO COMPRAS — Dashboard.
 *
 * Esto era un componente que no pintaba nada: montaba, redirigía a
 * Requerimientos y enseñaba un spinner por el camino. Desde fuera se veía como
 * que el tablero "se rompe y te manda a Requerimientos", que es justo lo que
 * reportó Antonio.
 *
 * Ahora es un tablero de verdad, y cuenta el circuito tal como funciona aquí:
 * alguien pide (requerimiento), Compras cotiza, Gerencia aprueba la cotización
 * y de ahí sale la orden. Lo que importa mirar es dónde se está atascando.
 */

import { useMemo } from 'react';
import {
  ShoppingCart, ClipboardList, FileText, Package, ArrowRight,
  Clock, AlertTriangle, TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useRequerimientosStore } from '../../lib/compras/requerimientos-store';
import { useCotizacionesStore } from '../../lib/compras/cotizaciones-store';
import { useOrdenesStore } from '../../lib/compras/ordenes-store';
import { convertirAMonedaBase, formatMontoBase } from '../../lib/shared/currency-utils';
import { usePermissions } from '../../lib/rbac/usePermissions';

interface ComprasProps {
  onNavigate?: (route: string) => void;
}

/** Inicio del mes en curso, en hora local. */
function inicioDeMes(): Date {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
}

const esDeEsteMes = (iso?: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d >= inicioDeMes();
};

export function Compras({ onNavigate }: ComprasProps) {
  const { requerimientos } = useRequerimientosStore();
  const { cotizaciones } = useCotizacionesStore();
  const { ordenes } = useOrdenesStore();
  const { can } = usePermissions();

  const stats = useMemo(() => {
    const reqAbiertos = requerimientos.filter(
      r => r.estado === 'enviado' || r.estado === 'aprobado',
    );
    // Un requerimiento se considera atendido cuando ya tiene cotización. La
    // cotización guarda el UUID del requerimiento, no su número visible, así
    // que se cruza por las dos claves.
    const conCotizacion = new Set(
      cotizaciones.flatMap(c => [c.requerimientoId, c.requerimientoNumero]).filter(Boolean),
    );
    const sinCotizar = reqAbiertos.filter(
      r => !conCotizacion.has(r.id) && !conCotizacion.has(r._dbId),
    );

    const cotPorAprobar = cotizaciones.filter(
      c => c.estado === 'enviada' || c.estado === 'recibida',
    );
    const ordPorAprobar = ordenes.filter(o => o.estado === 'pendiente_aprobacion');

    const ordenesDelMes = ordenes.filter(
      o => o.estado !== 'anulada' && esDeEsteMes(o.fechaEmision),
    );
    const montoMes = ordenesDelMes.reduce(
      (s, o) => s + convertirAMonedaBase(o.total, o.moneda), 0,
    );

    // Proveedores por monto comprometido en el mes.
    const porProveedor = new Map<string, { n: number; monto: number }>();
    ordenesDelMes.forEach(o => {
      const k = o.proveedorNombre || '—';
      const acc = porProveedor.get(k) ?? { n: 0, monto: 0 };
      acc.n += 1;
      acc.monto += convertirAMonedaBase(o.total, o.moneda);
      porProveedor.set(k, acc);
    });
    const topProveedores = [...porProveedor.entries()]
      .sort((a, b) => b[1].monto - a[1].monto)
      .slice(0, 5);

    return {
      sinCotizar: sinCotizar.length,
      reqAbiertos: reqAbiertos.length,
      cotPorAprobar: cotPorAprobar.length,
      ordPorAprobar: ordPorAprobar.length,
      ordenesMes: ordenesDelMes.length,
      montoMes,
      topProveedores,
      ultimas: [...ordenes]
        .filter(o => o.estado !== 'anulada')
        .sort((a, b) => (b.fechaEmision ?? '').localeCompare(a.fechaEmision ?? ''))
        .slice(0, 6),
    };
  }, [requerimientos, cotizaciones, ordenes]);

  const kpi = (
    label: string, valor: string | number, icono: React.ReactNode,
    pie?: string, ruta?: string,
  ) => (
    <Card
      className={ruta ? 'cursor-pointer transition-colors hover:bg-accent/40' : undefined}
      onClick={ruta ? () => onNavigate?.(ruta) : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {icono}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold">{valor}</p>
        {pie && <p className="text-xs text-muted-foreground mt-0.5">{pie}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <ShoppingCart className="size-6" />
            Compras
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Del pedido a la orden: dónde está parado cada trámite
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => onNavigate?.('/compras/requerimientos')}>
            Requerimientos <ArrowRight className="size-4 ml-1" />
          </Button>
          {can('compras', 'ver') && (
            <Button onClick={() => onNavigate?.('/compras/ordenes')}>
              Órdenes <ArrowRight className="size-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Lo que está esperando a alguien */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi(
          'Pedidos sin cotizar', stats.sinCotizar,
          <ClipboardList className="size-4 text-amber-600" />,
          `de ${stats.reqAbiertos} abiertos`, '/compras/requerimientos',
        )}
        {kpi(
          'Cotizaciones por aprobar', stats.cotPorAprobar,
          <FileText className="size-4 text-blue-600" />,
          'esperan decisión', '/compras/cotizaciones',
        )}
        {kpi(
          'Órdenes por aprobar', stats.ordPorAprobar,
          <Clock className="size-4 text-orange-600" />,
          'en el flujo de montos', '/compras/ordenes',
        )}
        {kpi(
          'Comprado este mes', formatMontoBase(stats.montoMes),
          <TrendingUp className="size-4 text-green-600" />,
          `${stats.ordenesMes} órdenes · dólares convertidos`, '/compras/ordenes',
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proveedores del mes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.topProveedores.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Todavía no hay órdenes emitidas este mes.
              </p>
            )}
            {stats.topProveedores.map(([nombre, d]) => (
              <div key={nombre} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate" title={nombre}>{nombre}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary">{d.n}</Badge>
                  <span className="tabular-nums">{formatMontoBase(d.monto)}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas órdenes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.ultimas.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin órdenes todavía.</p>
            )}
            {stats.ultimas.map(o => (
              <button
                key={o.id}
                className="w-full flex items-center justify-between gap-3 text-sm text-left hover:underline"
                onClick={() => onNavigate?.(`/compras/ordenes/${o.id}`)}
              >
                <span className="truncate">
                  <span className="font-medium">{o.id}</span>
                  <span className="text-muted-foreground"> · {o.proveedorNombre}</span>
                </span>
                <span className="tabular-nums shrink-0">
                  {o.moneda === 'USD' ? '$ ' : 'S/ '}
                  {Number(o.total ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {stats.sinCotizar > 0 && (
        <Card className="border-amber-300 dark:border-amber-900">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">
                Hay {stats.sinCotizar} {stats.sinCotizar === 1 ? 'pedido' : 'pedidos'} sin
                ninguna cotización.
              </p>
              <p className="text-muted-foreground mt-0.5">
                Son solicitudes que alguien levantó y todavía no tienen precio. Mientras no se
                cotizan, no pueden convertirse en orden.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 flex items-center gap-3 text-sm text-muted-foreground">
          <Package className="size-4 shrink-0" />
          <span>
            Cualquiera puede levantar un requerimiento. El gasto se controla después: la
            cotización se aprueba y la orden pasa por el flujo de montos.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

// Exportar componentes reales del módulo
export * from './compras/RequerimientosLista';
export * from './compras/RequerimientoDetalle';
export * from './compras/RequerimientoForm';
export * from './compras/CotizacionesLista';
export * from './compras/CotizacionDetalle';
export * from './compras/CotizacionForm';
export * from './compras/OrdenesLista';
export * from './compras/OrdenDetalle';
export * from './compras/OrdenForm';
export * from './compras/RecepcionesLista';
export * from './compras/RecepcionDetalle';
export * from './compras/RecepcionForm';

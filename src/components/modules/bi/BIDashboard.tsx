/**
 * BI & REPORTERÍA — panorama del ERP.
 *
 * Enseña lo que el sistema sabe hoy, módulo por módulo, y dice en voz alta lo
 * que todavía no. La versión anterior pedía métricas a seis tablas vacías y
 * mostraba "Balance del mes S/ 0" o "Pipeline S/ 0" como si fueran cifras
 * reales; para Gerencia eso es peor que no mostrar nada.
 *
 * Los importes van separados por moneda a propósito — el gasto de Memphis es
 * mayoritariamente en dólares y no hay tabla de tipos de cambio por fecha.
 */
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  RefreshCw, Loader2, ShoppingCart, Wallet, Truck, Users, FolderKanban,
  ShieldCheck, ArrowRight, Info, BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { PageNav } from '../../shared/PageNav';
import { usePanelBI, PENDIENTES_DE_ALIMENTAR, type MesCompromiso } from '../../../lib/bi/panel';
import { nombreMes, type Importe } from '../../../lib/bi/cruzado';
import { usePermissions } from '../../../lib/rbac/usePermissions';

interface Props {
  onNavigate?: (route: string) => void;
}

const miles = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 0 });
const soles = (n: number) => `S/ ${miles(n)}`;
const dolares = (n: number) => `$ ${miles(n)}`;

/** Los dos importes, uno debajo del otro. Nunca sumados. */
function Plata({ importe }: { importe: Importe }) {
  if (!importe.pen && !importe.usd) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="leading-tight">
      {importe.pen !== 0 && <span className="block">{soles(importe.pen)}</span>}
      {importe.usd !== 0 && <span className="block text-muted-foreground text-sm">{dolares(importe.usd)}</span>}
    </span>
  );
}

interface TarjetaProps {
  titulo: string;
  icon: React.ReactNode;
  ruta: string;
  onNavigate?: (r: string) => void;
  lineas: { etiqueta: string; valor: React.ReactNode }[];
}

function TarjetaModulo({ titulo, icon, ruta, onNavigate, lineas }: TarjetaProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between gap-3">
        <dl className="space-y-1.5">
          {lineas.map(l => (
            <div key={l.etiqueta} className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-muted-foreground">{l.etiqueta}</dt>
              <dd className="font-semibold text-right">{l.valor}</dd>
            </div>
          ))}
        </dl>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start px-0 hover:bg-transparent hover:text-primary"
          onClick={() => onNavigate?.(ruta)}
        >
          Abrir módulo <ArrowRight className="size-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function BIDashboard({ onNavigate }: Props) {
  const { panel, cargando, actualizado, recargar } = usePanelBI();
  const { can } = usePermissions();

  if (cargando && !panel) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // El gráfico cruza compras con caja chica: cada serie se muestra solo a quien
  // puede ver ese módulo. Richard ve el compromiso de órdenes, no la caja.
  const verCompras = can('compras', 'ver');
  const verCaja = can('finanzas', 'ver');

  const datosGrafico = (panel?.tendencia ?? []).map((m: MesCompromiso) => ({
    mes: nombreMes(m.mes),
    'Órdenes S/': Math.round(m.ocPen),
    'Órdenes $': Math.round(m.ocUsd),
    'Caja chica S/': Math.round(m.cajaPen),
  }));

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <BarChart3 className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">BI &amp; Reportería</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Lo que el ERP sabe hoy, módulo por módulo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actualizado && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Actualizado: {actualizado}
            </span>
          )}
          <Button variant="default" size="sm" onClick={recargar} disabled={cargando}>
            {cargando ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Actualizar
          </Button>
        </div>
      </div>

      {/* ACCESOS A LOS OTROS DOS INFORMES */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => onNavigate?.('/bi/cruzado')}>
          <CardContent className="p-4 flex items-start gap-3">
            <BarChart3 className="size-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Reporte Cruzado</p>
              <p className="text-sm text-muted-foreground">
                Órdenes y caja chica cruzadas por proyecto, centro de costo, mes o proveedor. Con Excel.
              </p>
            </div>
          </CardContent>
        </Card>
        {can('admin', 'ver') && (
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => onNavigate?.('/bi/gerencia')}>
            <CardContent className="p-4 flex items-start gap-3">
              <FolderKanban className="size-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Flujo Gerencia</p>
                <p className="text-sm text-muted-foreground">
                  Compromiso mensual, proyectos, áreas y concentración de proveedores.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* MÓDULOS CON DATOS */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Con datos hoy
        </h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {can('compras', 'ver') && panel && (
            <TarjetaModulo
              titulo="Compras" ruta="/compras/ordenes" onNavigate={onNavigate}
              icon={<ShoppingCart className="size-4 text-primary" />}
              lineas={[
                { etiqueta: 'Órdenes vigentes', valor: miles(panel.compras.ordenesVivas) },
                { etiqueta: `Comprometido ${new Date().getFullYear()}`, valor: <Plata importe={panel.compras.comprometidoAnio} /> },
                { etiqueta: 'Requerimientos pendientes', valor: miles(panel.compras.requerimientosPendientes) },
                { etiqueta: 'Cotizaciones', valor: miles(panel.compras.cotizaciones) },
              ]}
            />
          )}

          {can('finanzas', 'ver') && panel && (
            <TarjetaModulo
              titulo="Caja chica" ruta="/finanzas/caja-chica" onNavigate={onNavigate}
              icon={<Wallet className="size-4 text-primary" />}
              lineas={[
                { etiqueta: 'Cajas abiertas', valor: miles(panel.caja.cajasAbiertas) },
                { etiqueta: `Egreso ${new Date().getFullYear()}`, valor: <Plata importe={panel.caja.egresoAnio} /> },
                { etiqueta: 'Gastos del año', valor: miles(panel.caja.gastosAnio) },
              ]}
            />
          )}

          {can('proyectos', 'ver') && panel && (
            <TarjetaModulo
              titulo="Proyectos" ruta="/proyectos/lista" onNavigate={onNavigate}
              icon={<FolderKanban className="size-4 text-primary" />}
              lineas={[
                { etiqueta: 'En ejecución', valor: `${panel.proyectos.enEjecucion} de ${panel.proyectos.total}` },
                {
                  etiqueta: 'Sin presupuesto cargado',
                  valor: panel.proyectos.sinPresupuesto > 0
                    ? <Badge variant="outline" className="text-amber-600 border-amber-500/50">{panel.proyectos.sinPresupuesto}</Badge>
                    : '—',
                },
              ]}
            />
          )}

          {can('fianzas', 'ver') && panel && (
            <TarjetaModulo
              titulo="Fianzas" ruta="/fianzas" onNavigate={onNavigate}
              icon={<ShieldCheck className="size-4 text-primary" />}
              lineas={[
                { etiqueta: 'Cartas vigentes', valor: miles(panel.fianzas.cartasVigentes) },
                { etiqueta: 'Monto afianzado', valor: <Plata importe={panel.fianzas.afianzado} /> },
                {
                  etiqueta: 'Vencen en 60 días',
                  valor: panel.fianzas.venceEn60 > 0
                    ? <Badge variant="outline" className="text-amber-600 border-amber-500/50">{panel.fianzas.venceEn60}</Badge>
                    : '—',
                },
              ]}
            />
          )}

          {can('flota', 'ver') && panel && (
            <TarjetaModulo
              titulo="Flota" ruta="/flota/vehiculos" onNavigate={onNavigate}
              icon={<Truck className="size-4 text-primary" />}
              lineas={[
                { etiqueta: 'Vehículos activos', valor: `${panel.flota.vehiculosActivos} de ${panel.flota.vehiculosTotal}` },
                { etiqueta: 'Mantenimientos abiertos', valor: miles(panel.flota.otAbiertas) },
              ]}
            />
          )}

          {can('proveedores', 'ver') && panel && (
            <TarjetaModulo
              titulo="Proveedores" ruta="/proveedores/directorio" onNavigate={onNavigate}
              icon={<Users className="size-4 text-primary" />}
              lineas={[
                { etiqueta: 'Activos', valor: miles(panel.proveedores.activos) },
              ]}
            />
          )}
        </div>
      </div>

      {/* TENDENCIA */}
      {datosGrafico.length > 0 && (verCompras || verCaja) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Compromiso mensual</CardTitle>
            <p className="text-sm text-muted-foreground">
              {verCompras && verCaja
                ? 'Órdenes de compra emitidas y egreso de caja chica. '
                : verCompras ? 'Órdenes de compra emitidas. ' : 'Egreso de caja chica. '}
              Soles y dólares en barras distintas: no se convierten.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={datosGrafico}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => miles(Number(v) / 1000) + 'k'} />
                <Tooltip formatter={(v: number, n: string) => [n.includes('$') ? dolares(v) : soles(v), n]} />
                <Legend />
                {verCompras && <Bar dataKey="Órdenes S/" fill="#0A66C2" />}
                {verCompras && <Bar dataKey="Órdenes $" fill="#f0c000" />}
                {verCaja && <Bar dataKey="Caja chica S/" fill="#64748B" />}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* LO QUE FALTA */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="size-4 text-muted-foreground" />
            Lo que todavía no se puede reportar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            {PENDIENTES_DE_ALIMENTAR.map(p => (
              <div key={p.titulo}>
                <dt className="text-sm font-medium">{p.titulo}</dt>
                <dd className="text-sm text-muted-foreground">{p.detalle}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

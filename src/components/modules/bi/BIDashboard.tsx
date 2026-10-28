/**
 * BI & REPORTERÍA — panorama del ERP.
 *
 * Enseña lo que el sistema sabe hoy, módulo por módulo, y dice en voz alta lo
 * que todavía no. La versión anterior pedía métricas a seis tablas vacías y
 * mostraba "Balance del mes S/ 0" o "Pipeline S/ 0" como si fueran cifras
 * reales; para Gerencia eso es peor que no mostrar nada.
 *
 * Los importes van separados por moneda a propósito — el gasto de Memphis es
 * mayoritariamente en dólares y una suma mixta engaña; el TC SUNAT diario lo
 * usan los informes que lo necesitan (Proyecto 360, Flujo Gerencia).
 *
 * 28/10/2026: se agregaron las tarjetas de lo que el ERP ya sabe (facturas y
 * cuentas por pagar, tesorería y bancos, ingresos por proyecto, contabilidad,
 * viajes, inventario con serie) y la lista de "lo que falta" se calcula con
 * datos en vez de ser un texto fijo que envejecía.
 */
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  RefreshCw, Loader2, ShoppingCart, Wallet, Truck, Users, FolderKanban,
  ShieldCheck, ArrowRight, Info, BarChart3, Receipt, Landmark, BookOpenCheck, Plane, Cpu, TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { PageNav } from '../../shared/PageNav';
import { usePanelBI, pendientesDeAlimentar, type MesCompromiso } from '../../../lib/bi/panel';
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

  const r = panel?.resumen ?? null;
  const anio = new Date().getFullYear();
  const fechaCorta = (s: string | null | undefined) => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—';
  const pendientes = pendientesDeAlimentar(r);

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
                {verCaja ? 'Órdenes y caja chica cruzadas' : 'Órdenes de compra cruzadas'} por
                proyecto, centro de costo, mes o proveedor. Con Excel.
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
                ...(r ? [{ etiqueta: 'Cartas con el Estado pendientes', valor: r.operaciones.cartas_vencidas > 0 ? <Badge variant="destructive">{miles(r.operaciones.cartas_pendientes)} · {r.operaciones.cartas_vencidas} vencidas</Badge> : miles(r.operaciones.cartas_pendientes) }] : []),
              ]}
            />
          )}

          {can('proyectos', 'ver') && r && (
            <TarjetaModulo
              titulo="Ingresos por proyecto" ruta="/proyectos/valorizaciones" onNavigate={onNavigate}
              icon={<TrendingUp className="size-4 text-primary" />}
              lineas={[
                { etiqueta: `Contratos (${r.proyectos.con_contrato})`, valor: soles(r.proyectos.contrato_total) },
                { etiqueta: 'Cobrado', valor: soles(r.proyectos.cobrado_total) },
                { etiqueta: 'Por cobrar', valor: <Plata importe={{ pen: r.cxc.pendiente_pen, usd: r.cxc.pendiente_usd }} /> },
                { etiqueta: 'Valorizaciones cobradas', valor: `${r.proyectos.valorizaciones_cobradas} de ${r.proyectos.valorizaciones_cobradas + r.proyectos.valorizaciones_por_cobrar}` },
              ]}
            />
          )}

          {can('compras', 'ver') && r && (
            <TarjetaModulo
              titulo="Facturas de proveedores" ruta="/compras/facturas" onNavigate={onNavigate}
              icon={<Receipt className="size-4 text-primary" />}
              lineas={[
                { etiqueta: 'Recibidas (SIRE + portal)', valor: miles(r.facturas.recibidas) },
                { etiqueta: 'Por conformar', valor: r.facturas.por_conformar > 0 ? <Badge variant="outline" className="text-amber-600 border-amber-500/50">{r.facturas.por_conformar}</Badge> : '—' },
                { etiqueta: 'Conformes por pagar', valor: miles(r.facturas.conformes) },
                { etiqueta: 'Última emisión', valor: fechaCorta(r.facturas.ultima_emision) },
              ]}
            />
          )}

          {can('finanzas', 'ver') && r && (
            <TarjetaModulo
              titulo="Cuentas por pagar" ruta="/finanzas/cuentas-pagar" onNavigate={onNavigate}
              icon={<Wallet className="size-4 text-primary" />}
              lineas={[
                { etiqueta: `Pendiente (${miles(r.cxp.compromisos)})`, valor: <Plata importe={{ pen: r.cxp.pendiente_pen, usd: r.cxp.pendiente_usd }} /> },
                { etiqueta: `Vencido (${miles(r.cxp.vencidos)})`, valor: <span className={r.cxp.vencidos > 0 ? 'text-red-600' : ''}><Plata importe={{ pen: r.cxp.vencido_pen, usd: r.cxp.vencido_usd }} /></span> },
              ]}
            />
          )}

          {can('finanzas', 'ver') && r && (
            <TarjetaModulo
              titulo="Tesorería y bancos" ruta="/finanzas/bancos" onNavigate={onNavigate}
              icon={<Landmark className="size-4 text-primary" />}
              lineas={[
                { etiqueta: `Pagado ${anio} (${miles(r.tesoreria.pagos_anio)})`, valor: <Plata importe={{ pen: r.tesoreria.pagado_pen, usd: r.tesoreria.pagado_usd }} /> },
                { etiqueta: `Cobrado ${anio}`, valor: <Plata importe={{ pen: r.tesoreria.cobrado_pen, usd: r.tesoreria.cobrado_usd }} /> },
                { etiqueta: 'Banco sin conciliar', valor: r.bancos.sin_conciliar > 0 ? <Badge variant="outline" className="text-amber-600 border-amber-500/50">{miles(r.bancos.sin_conciliar)}</Badge> : '—' },
                { etiqueta: 'Extracto hasta', valor: fechaCorta(r.bancos.extracto_hasta) },
              ]}
            />
          )}

          {can('contabilidad', 'ver') && r && (
            <TarjetaModulo
              titulo="Contabilidad" ruta="/contabilidad" onNavigate={onNavigate}
              icon={<BookOpenCheck className="size-4 text-primary" />}
              lineas={[
                { etiqueta: 'Asientos', valor: miles(r.contabilidad.asientos) },
                { etiqueta: 'Periodos abiertos', valor: miles(r.contabilidad.periodos_abiertos) },
                { etiqueta: 'TC SUNAT al', valor: fechaCorta(r.contabilidad.tc_fecha) },
                { etiqueta: 'Facturas 2026 sin asiento', valor: r.contabilidad.facturas_sin_contabilizar > 0 ? <Badge variant="outline" className="text-amber-600 border-amber-500/50">{r.contabilidad.facturas_sin_contabilizar}</Badge> : '—' },
              ]}
            />
          )}

          {can('viajes', 'ver') && r && (
            <TarjetaModulo
              titulo="Viajes y viáticos" ruta="/viajes" onNavigate={onNavigate}
              icon={<Plane className="size-4 text-primary" />}
              lineas={[
                { etiqueta: 'Viajes abiertos', valor: miles(r.operaciones.viajes_abiertos) },
                { etiqueta: 'Rendiciones por revisar', valor: r.operaciones.rendiciones_por_revisar > 0 ? <Badge variant="outline" className="text-amber-600 border-amber-500/50">{r.operaciones.rendiciones_por_revisar}</Badge> : '—' },
              ]}
            />
          )}

          {can('inventario', 'ver') && r && (
            <TarjetaModulo
              titulo="Inventario con serie" ruta="/inventario/unidades" onNavigate={onNavigate}
              icon={<Cpu className="size-4 text-primary" />}
              lineas={[
                { etiqueta: 'Unidades', valor: miles(r.operaciones.unidades) },
                { etiqueta: 'En almacén', valor: miles(r.operaciones.unidades_en_almacen) },
                { etiqueta: 'Instaladas o entregadas', valor: miles(r.operaciones.unidades_instaladas) },
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

      {/* LO QUE FALTA — calculado con los datos de hoy, no un texto fijo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="size-4 text-muted-foreground" />
            Lo que todavía falta alimentar
          </CardTitle>
          <p className="text-sm text-muted-foreground">Se calcula con los datos de hoy; cuando algo se carga, desaparece de aquí.</p>
        </CardHeader>
        <CardContent>
          {pendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada pendiente: todos los módulos activos tienen datos al día.</p>
          ) : (
            <dl className="space-y-3">
              {pendientes.map(p => (
                <div key={p.titulo} className={p.ruta ? 'cursor-pointer hover:text-primary' : ''} onClick={() => p.ruta && onNavigate?.(p.ruta)}>
                  <dt className="text-sm font-medium">{p.titulo}</dt>
                  <dd className="text-sm text-muted-foreground">{p.detalle}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

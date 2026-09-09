/**
 * REPORTE CRUZADO — a dónde se va la plata, por proyecto y por centro de costo.
 *
 * Cruza órdenes de compra con la caja chica sobre la vista `v_bi_movimientos`.
 * Soles y dólares van SIEMPRE separados: el gasto de Memphis es mayoritariamente
 * en dólares y consolidar con un tipo de cambio fijo movería el total en
 * millones. El consolidado llega con la tabla de tipos de cambio por fecha.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Search, BarChart3, FolderKanban, Building2,
  CalendarDays, Truck, AlertTriangle, ArrowDownRight, ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Checkbox } from '../../ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { CentroCostoSelector } from '../../shared/CentroCostoSelector';
import { BotonExportar } from '../../shared/BotonExportar';
import {
  fetchMovimientos, agrupar, totales, paraExportar, CABECERAS_EXPORT, FUENTES,
  fuentesPermitidas,
  type Movimiento, type Fuente, type Dimension, type Importe,
} from '../../../lib/bi/cruzado';
import { usePermissions } from '../../../lib/rbac/usePermissions';

const soles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const dolares = (n: number) =>
  `$ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fecha = (s: string) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

/** Los dos importes de una celda, uno debajo del otro. Cero se calla. */
function Plata({ importe, className = '' }: { importe: Importe; className?: string }) {
  if (importe.pen === 0 && importe.usd === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className={`leading-tight ${className}`}>
      {importe.pen !== 0 && <div>{soles(importe.pen)}</div>}
      {importe.usd !== 0 && <div className="text-muted-foreground">{dolares(importe.usd)}</div>}
    </div>
  );
}

const DIMENSIONES: { id: Dimension; label: string; icon: typeof FolderKanban }[] = [
  { id: 'proyecto', label: 'Por proyecto', icon: FolderKanban },
  { id: 'centroCosto', label: 'Por centro de costo', icon: Building2 },
  { id: 'mes', label: 'Por mes', icon: CalendarDays },
  { id: 'contraparte', label: 'Por proveedor', icon: Truck },
  { id: 'fuente', label: 'Por origen', icon: BarChart3 },
];

/** Arranca en el año corrido: es el rango que pide Gerencia. */
function rangoPorDefecto() {
  const hoy = new Date();
  return {
    desde: `${hoy.getFullYear()}-01-01`,
    hasta: hoy.toISOString().slice(0, 10),
  };
}

export function ReporteCruzado() {
  const inicial = rangoPorDefecto();

  const [desde, setDesde] = useState(inicial.desde);
  const [hasta, setHasta] = useState(inicial.hasta);
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [centroCostoId, setCentroCostoId] = useState<string | null>(null);
  // El reporte cruza compras con caja chica. Quien no puede ver finanzas no
  // debe poder pedir la caja por aquí: el menú lo esconde, el reporte no lo
  // escondía.
  const { can } = usePermissions();
  const permitidas = useMemo(
    () => fuentesPermitidas(m => can(m, 'ver')),
    [can],
  );

  const [fuentes, setFuentes] = useState<Fuente[]>(permitidas);

  // Los permisos llegan un instante DESPUÉS del primer render, así que
  // `permitidas` empieza vacía y el estado inicial no sirve: hay que marcar las
  // fuentes cuando llega la lista de verdad, o el reporte se queda con el botón
  // apagado y nada que cruzar. `can` es estable (useCallback), así que esto no
  // se dispara en cada render.
  useEffect(() => {
    setFuentes(prev => {
      const validas = prev.filter(f => permitidas.includes(f));
      return validas.length > 0 ? validas : permitidas;
    });
  }, [permitidas]);

  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [dimension, setDimension] = useState<Dimension>('proyecto');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buscado, setBuscado] = useState(false);

  const buscar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const pedidas = fuentes.filter(f => permitidas.includes(f));
      const data = await fetchMovimientos({ desde, hasta, proyectoId, centroCostoId, fuentes: pedidas });
      setMovs(data);
      setBuscado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar');
      setMovs([]);
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, proyectoId, centroCostoId, fuentes, permitidas]);

  const verIngresos = permitidas.includes('ingreso_caja');

  const t = useMemo(() => totales(movs), [movs]);
  const filas = useMemo(() => agrupar(movs, dimension), [movs, dimension]);
  const detalle = useMemo(() => movs.slice(0, 100), [movs]);
  const exportables = useMemo(() => paraExportar(movs), [movs]);

  const alternarFuente = (id: Fuente) =>
    setFuentes(prev => (prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]));

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <BarChart3 className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reporte Cruzado</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {permitidas.length > 1
                ? 'Órdenes de compra y caja chica, cruzadas por proyecto y centro de costo'
                : `${FUENTES.find(f => f.id === permitidas[0])?.label ?? 'Sin orígenes disponibles'}, por proyecto y centro de costo`}
            </p>
          </div>
        </div>
        {buscado && (
          <BotonExportar
            modulo="compras"
            nombre="reporte-cruzado"
            hoja="Movimientos"
            datos={exportables}
            headers={CABECERAS_EXPORT}
            etiqueta={`Exportar ${movs.length}`}
          />
        )}
      </div>

      {/* FILTROS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Qué quieres mirar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="desde">Desde</Label>
              <Input id="desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hasta">Hasta</Label>
              <Input id="hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Proyecto</Label>
              <ProyectoSelector value={proyectoId} onChange={setProyectoId} />
            </div>
            <div className="space-y-1.5">
              <Label>Centro de costo</Label>
              <CentroCostoSelector value={centroCostoId} onChange={setCentroCostoId} />
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <Label>Origen del movimiento</Label>
              <div className="flex flex-wrap gap-4">
                {permitidas.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    Tu rol no incluye ninguno de los orígenes de este reporte.
                  </span>
                )}
                {FUENTES.filter(f => permitidas.includes(f.id)).map(f => (
                  <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={fuentes.includes(f.id)}
                      onCheckedChange={() => alternarFuente(f.id)}
                    />
                    <span>
                      {f.label}
                      <span className="text-muted-foreground"> · {f.detalle}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={buscar} disabled={cargando || fuentes.length === 0}>
              {cargando ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Generar
            </Button>
          </div>

          <p className="text-xs text-muted-foreground border-t pt-3">
            No entran aquí las facturas de proveedores (el módulo de cuentas por pagar todavía no
            está alimentado) ni las órdenes de trabajo de flota, que hoy no guardan proyecto ni
            centro de costo, así que no se pueden cruzar sin inventar la imputación.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">
            No se pudo generar el reporte: {error}
          </CardContent>
        </Card>
      )}

      {buscado && !cargando && movs.length === 0 && !error && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No hay movimientos con estos filtros. Prueba ampliando el rango de fechas.
          </CardContent>
        </Card>
      )}

      {movs.length > 0 && (
        <>
          {/* RESUMEN */}
          <div className={`grid gap-3 ${verIngresos ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowDownRight className="size-3.5 text-red-500" /> Egresos
                </div>
                <Plata importe={t.egreso} className="text-xl font-bold mt-1" />
              </CardContent>
            </Card>
            {/* Sin acceso a la caja el ingreso es siempre cero: la tarjeta solo
                aportaría un guion y la duda de qué se está escondiendo. */}
            {verIngresos && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowUpRight className="size-3.5 text-emerald-500" /> Ingresos de caja
                  </div>
                  <Plata importe={t.ingreso} className="text-xl font-bold mt-1" />
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Movimientos</p>
                <p className="text-xl font-bold mt-1">{t.movimientos.toLocaleString('es-PE')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fecha(desde)} — {fecha(hasta)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Egresos sin proyecto</p>
                <p className="text-xl font-bold mt-1">{t.sinProyecto.toLocaleString('es-PE')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.movimientos > 0
                    ? `${Math.round((t.sinProyecto / t.movimientos) * 100)}% de lo listado`
                    : '—'}
                </p>
              </CardContent>
            </Card>
          </div>

          {t.fueraDeCatalogo > 0 && (
            <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="p-4 flex gap-3 text-sm">
                <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>{t.fueraDeCatalogo.toLocaleString('es-PE')} movimientos</strong> traen un
                  centro de costo escrito a mano que no está en el catálogo — vienen de la caja
                  chica. Aparecen con su texto tal cual, sin sumarse al centro del catálogo que les
                  correspondería.
                </p>
              </CardContent>
            </Card>
          )}

          {/* AGRUPADO */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">Cómo se reparte</CardTitle>
                <div className="flex flex-wrap gap-1.5">
                  {DIMENSIONES.map(d => (
                    <Button
                      key={d.id}
                      size="sm"
                      variant={dimension === d.id ? 'default' : 'outline'}
                      onClick={() => setDimension(d.id)}
                    >
                      <d.icon className="size-3.5" />
                      {d.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{DIMENSIONES.find(d => d.id === dimension)?.label.replace('Por ', '')}</TableHead>
                      <TableHead className="text-right">Movimientos</TableHead>
                      <TableHead className="text-right">Egresos</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filas.map(f => (
                      <TableRow key={f.clave}>
                        <TableCell className="font-medium">
                          {f.etiqueta}
                          {!f.enCatalogo && (
                            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-500/50">
                              fuera de catálogo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{f.movimientos}</TableCell>
                        <TableCell className="text-right"><Plata importe={f.egreso} /></TableCell>
                        <TableCell className="text-right"><Plata importe={f.ingreso} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* DETALLE */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Detalle
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {movs.length > detalle.length
                    ? `primeros ${detalle.length} de ${movs.length.toLocaleString('es-PE')} — el Excel los trae todos`
                    : `${movs.length} movimiento(s)`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Proveedor / beneficiario</TableHead>
                      <TableHead>Proyecto</TableHead>
                      <TableHead>Centro de costo</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalle.map(m => (
                      <TableRow key={`${m.fuente}-${m.id}`}>
                        <TableCell className="whitespace-nowrap">{fecha(m.fecha)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="font-medium">{m.numero ?? '—'}</span>
                          <span className="block text-xs text-muted-foreground">
                            {FUENTES.find(f => f.id === m.fuente)?.label}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate" title={m.contraparte ?? ''}>
                          {m.contraparte ?? '—'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={m.proyecto ?? ''}>
                          {m.proyecto ?? <span className="text-muted-foreground">Sin proyecto</span>}
                        </TableCell>
                        <TableCell>{m.centroCosto ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className={`text-right whitespace-nowrap tabular-nums ${m.flujo === 'ingreso' ? 'text-emerald-600' : ''}`}>
                          {m.flujo === 'ingreso' ? '+' : ''}
                          {m.moneda === 'USD' ? dolares(m.monto) : soles(m.monto)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

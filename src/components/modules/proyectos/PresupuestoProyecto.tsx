/**
 * PRESUPUESTO DEL PROYECTO — el plan de Antonio contra lo que de verdad se gasta.
 *
 * Muestra, por proyecto: el árbol de partidas presupuestadas (lo que se cargó de
 * la plantilla), lo COMPROMETIDO en órdenes —que ya cuadra al céntimo tras la
 * revisión de Operaciones— y el margen, con las reglas de Antonio. Amazonas no
 * se torció de un día para otro: se fue torciendo compra a compra, y esto lo
 * enseña.
 *
 * El margen se muestra en dos columnas: PLANIFICADO (costo = lo presupuestado) y
 * RESULTANTE (costo = lo comprometido). La diferencia entre ambos es dónde se
 * está yendo el proyecto respecto al plan.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, ChevronRight, ChevronDown, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { ImportarPresupuestoDialog } from './ImportarPresupuestoDialog';
import { supabase } from '../../../lib/supabase/client';
import {
  calcularMargen, aSoles, margenLegible, PARAMETROS_DEFECTO,
} from '../../../lib/proyectos/rendimiento';

interface PresupuestoCab {
  id: string;
  proyectoId: string;
  codigo: string;
  nombreProyecto: string;
  convenio: number;
  tipoCambio: number;
  cui: string | null;
}

interface LineaPresu {
  item: string;
  nivel: number;
  esHoja: boolean;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  moneda: string | null;
  totalSinIgv: number | null;
  totalConIgv: number | null;
  proveedorNota: string | null;
  orden: number;
}

const soles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PresupuestoProyecto() {
  const [cabs, setCabs] = useState<PresupuestoCab[]>([]);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaPresu[]>([]);
  const [comprometido, setComprometido] = useState<number>(0);
  const [cargando, setCargando] = useState(true);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  // Presupuestos existentes (uno por proyecto). `preferirProyecto` deja
  // seleccionado el proyecto recién importado.
  const cargarPresupuestos = useCallback(async (preferirProyecto?: string) => {
    const { data } = await supabase
      .from('proyecto_presupuestos')
      .select('id, proyecto_id, tipo_cambio, cui, proyecto:proyectos(codigo, nombre, monto_contrato, monto_adenda)')
      .order('actualizado_en', { ascending: false });
    const filas = (data ?? []).map((r: Record<string, unknown>): PresupuestoCab => {
      const p = r.proyecto as Record<string, unknown> | null;
      return {
        id: r.id as string,
        proyectoId: r.proyecto_id as string,
        codigo: (p?.codigo as string) ?? '',
        nombreProyecto: (p?.nombre as string) ?? '',
        convenio: Number(p?.monto_contrato ?? 0) + Number(p?.monto_adenda ?? 0),
        tipoCambio: Number(r.tipo_cambio ?? 3.4),
        cui: (r.cui as string) ?? null,
      };
    });
    setCabs(filas);
    const preferida = preferirProyecto ? filas.find(f => f.proyectoId === preferirProyecto)?.id : undefined;
    setSeleccion(s => preferida ?? s ?? filas[0]?.id ?? null);
    setCargando(false);
  }, []);

  useEffect(() => { void cargarPresupuestos(); }, [cargarPresupuestos]);

  const cab = useMemo(() => cabs.find(c => c.id === seleccion) ?? null, [cabs, seleccion]);

  // Líneas del presupuesto + comprometido en órdenes del proyecto.
  const cargarDetalle = useCallback(async (c: PresupuestoCab) => {
    setCargando(true);
    const [{ data: ls }, { data: ocs }] = await Promise.all([
      supabase.from('proyecto_presupuesto_lineas')
        .select('item, nivel, es_hoja, descripcion, unidad, cantidad, moneda, total_sin_igv, total_con_igv, proveedor_nota, orden')
        .eq('presupuesto_id', c.id).order('orden'),
      supabase.from('ordenes_compra')
        .select('total, moneda, estado')
        .eq('proyecto_id', c.proyectoId),
    ]);
    setLineas((ls ?? []).map((r: Record<string, unknown>): LineaPresu => ({
      item: r.item as string,
      nivel: r.nivel as number,
      esHoja: r.es_hoja as boolean,
      descripcion: (r.descripcion as string) ?? '',
      unidad: (r.unidad as string) ?? null,
      cantidad: r.cantidad as number | null,
      moneda: (r.moneda as string) ?? null,
      totalSinIgv: r.total_sin_igv as number | null,
      totalConIgv: r.total_con_igv as number | null,
      proveedorNota: (r.proveedor_nota as string) ?? null,
      orden: r.orden as number,
    })));
    // Comprometido: órdenes no anuladas, en soles al TC del presupuesto.
    const comp = (ocs ?? [])
      .filter((o: Record<string, unknown>) => o.estado !== 'anulada')
      .reduce((s: number, o: Record<string, unknown>) =>
        s + aSoles(Number(o.total ?? 0), String(o.moneda ?? 'PEN'), c.tipoCambio), 0);
    setComprometido(Math.round(comp * 100) / 100);
    setCargando(false);
  }, []);

  useEffect(() => { if (cab) cargarDetalle(cab); }, [cab, cargarDetalle]);

  const presupuestado = useMemo(
    () => lineas.filter(l => l.esHoja).reduce((s, l) => s + (l.totalSinIgv ?? 0), 0),
    [lineas],
  );

  // Margen planificado (costo = presupuestado) y resultante (costo = comprometido).
  const planificado = cab ? calcularMargen({ convenio: cab.convenio, costo: presupuestado }) : null;
  const resultante = cab ? calcularMargen({ convenio: cab.convenio, costo: comprometido }) : null;

  // Cuánto del presupuesto se lleva comprometido. Mientras esto sea < 100 %, el
  // margen "resultante" está inflado (falta gasto por venir): la señal real de
  // alarma es que lo comprometido SUPERE lo presupuestado.
  const avance = presupuestado > 0 ? comprometido / presupuestado : 0;
  const sobregasto = comprometido > presupuestado;

  // Árbol: las partidas de nivel 1 con sus hijos colapsables.
  const conHijos = useMemo(() => {
    // Total presupuestado por prefijo (suma de hojas cuyo item empieza por el prefijo).
    const totalDe = (prefijo: string) => lineas
      .filter(l => l.esHoja && (l.item === prefijo || l.item.startsWith(prefijo + '.')))
      .reduce((s, l) => s + (l.totalSinIgv ?? 0), 0);
    return { totalDe };
  }, [lineas]);

  const alternar = (item: string) => setAbiertas(prev => {
    const s = new Set(prev);
    s.has(item) ? s.delete(item) : s.add(item);
    return s;
  });

  // Se muestra una línea si es de nivel 1, o si todos sus ancestros están abiertos.
  const visible = (l: LineaPresu): boolean => {
    if (l.nivel === 1) return true;
    const partes = l.item.split('.');
    for (let i = 1; i < partes.length; i++) {
      if (!abiertas.has(partes.slice(0, i).join('.'))) return false;
    }
    return true;
  };

  const tieneHijos = (l: LineaPresu) =>
    !l.esHoja || lineas.some(x => x.item.startsWith(l.item + '.'));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Wallet className="size-6" />
            Presupuesto del proyecto
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Lo presupuestado en la plantilla contra lo comprometido en órdenes.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full max-w-xl justify-end flex-wrap">
          <div className="w-full max-w-sm">
            <SearchableSelect
              value={seleccion}
              onChange={setSeleccion}
              options={cabs.map(c => ({ value: c.id, label: `${c.codigo} — ${c.nombreProyecto}` }))}
              placeholder="Elegir proyecto"
              emptyText="No hay proyectos con presupuesto cargado"
              nullable={false}
            />
          </div>
          <ImportarPresupuestoDialog
            proyectoIdInicial={cab?.proyectoId ?? null}
            onImportado={(proyectoId) => cargarPresupuestos(proyectoId)}
          />
        </div>
      </div>

      {!cab ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          {cargando ? 'Cargando…' : 'Todavía no hay ningún presupuesto cargado. Se cargan desde la plantilla de Excel del proyecto.'}
        </CardContent></Card>
      ) : (
        <>
          {/* Cifras de cabecera */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Convenio (contrato + adenda)</p>
              <p className="text-xl font-bold">{soles(cab.convenio)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Presupuestado (sin IGV)</p>
              <p className="text-xl font-bold">{soles(presupuestado)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Comprometido en órdenes</p>
              <p className="text-xl font-bold">{soles(comprometido)}</p>
              <p className="text-[11px] text-muted-foreground">dólares al TC {cab.tipoCambio}</p>
            </CardContent></Card>
            <Card className={sobregasto ? 'border-red-400 dark:border-red-800' : ''}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Comprometido del plan
                  {sobregasto
                    ? <TrendingDown className="size-3.5 text-red-500" />
                    : <TrendingUp className="size-3.5 text-green-600" />}
                </p>
                <p className={`text-xl font-bold ${sobregasto ? 'text-red-600' : ''}`}>
                  {margenLegible(avance)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {sobregasto ? 'ya pasó lo presupuestado' : 'del presupuesto'}
                </p>
              </CardContent>
            </Card>
          </div>

          {sobregasto && (
            <Card className="border-red-300 dark:border-red-900">
              <CardContent className="p-4 flex items-start gap-3 text-sm">
                <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Este proyecto ya gastó más de lo presupuestado.</p>
                  <p className="text-muted-foreground mt-0.5">
                    Lo comprometido en órdenes ({soles(comprometido)}) supera el presupuesto
                    ({soles(presupuestado)}). El margen cae de {planificado && margenLegible(planificado.margen)} planificado
                    a {resultante && margenLegible(resultante.margen)}.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Desglose del margen */}
          {planificado && resultante && (
            <Card>
              <CardHeader><CardTitle className="text-base">Cómo sale el margen</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left font-medium px-4 py-2">Concepto</th>
                      <th className="text-right font-medium px-4 py-2">Con el plan</th>
                      <th className="text-right font-medium px-4 py-2">Con lo comprometido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr><td className="px-4 py-1.5">Ingresos del convenio (sin IGV)</td>
                      <td className="text-right px-4 tabular-nums">{soles(planificado.ingresosSinIgv)}</td>
                      <td className="text-right px-4 tabular-nums">{soles(resultante.ingresosSinIgv)}</td></tr>
                    <tr><td className="px-4 py-1.5">− Costo del proyecto</td>
                      <td className="text-right px-4 tabular-nums text-red-600">−{soles(planificado.costo)}</td>
                      <td className="text-right px-4 tabular-nums text-red-600">−{soles(resultante.costo)}</td></tr>
                    <tr><td className="px-4 py-1.5">− Consultoría OxI (10 %)</td>
                      <td className="text-right px-4 tabular-nums text-red-600">−{soles(planificado.consultoria)}</td>
                      <td className="text-right px-4 tabular-nums text-red-600">−{soles(resultante.consultoria)}</td></tr>
                    <tr><td className="px-4 py-1.5">− Contraprestación privada (5 %)</td>
                      <td className="text-right px-4 tabular-nums text-red-600">−{soles(planificado.contraprestacion)}</td>
                      <td className="text-right px-4 tabular-nums text-red-600">−{soles(resultante.contraprestacion)}</td></tr>
                    <tr><td className="px-4 py-1.5">− Venta del CIPRL (4 %)</td>
                      <td className="text-right px-4 tabular-nums text-red-600">−{soles(planificado.ventaCiprl)}</td>
                      <td className="text-right px-4 tabular-nums text-red-600">−{soles(resultante.ventaCiprl)}</td></tr>
                    <tr className="font-semibold border-t-2">
                      <td className="px-4 py-2">Ganancia neta</td>
                      <td className={`text-right px-4 tabular-nums ${planificado.gananciaNeta < 0 ? 'text-red-600' : 'text-green-700'}`}>{soles(planificado.gananciaNeta)}</td>
                      <td className={`text-right px-4 tabular-nums ${resultante.gananciaNeta < 0 ? 'text-red-600' : 'text-green-700'}`}>{soles(resultante.gananciaNeta)}</td></tr>
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground px-4 py-2">
                  Base: importe del convenio. Sin ganancia por integración. Tipo de cambio fijo {cab.tipoCambio}.
                  Reglas confirmadas con Antonio (16/09/2026). La columna «con lo comprometido» va subiendo a
                  medida que se emiten órdenes ({margenLegible(avance)} del presupuesto hasta hoy); solo iguala al
                  plan cuando el proyecto termina de comprarse.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Árbol de partidas */}
          <Card>
            <CardHeader><CardTitle className="text-base">Partidas del presupuesto</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {lineas.filter(visible).map(l => (
                  <div
                    key={l.item}
                    className={`flex items-center gap-2 px-4 py-2 ${l.nivel === 1 ? 'bg-muted/30 font-medium' : ''}`}
                    style={{ paddingLeft: `${12 + (l.nivel - 1) * 20}px` }}
                  >
                    {tieneHijos(l) ? (
                      <button onClick={() => alternar(l.item)} className="shrink-0 text-muted-foreground">
                        {abiertas.has(l.item) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                    ) : <span className="w-4 shrink-0" />}
                    <span className="text-xs text-muted-foreground shrink-0 w-14 tabular-nums">{l.item}</span>
                    <span className="flex-1 min-w-0 text-sm truncate" title={l.descripcion}>
                      {l.descripcion}
                      {l.esHoja && l.cantidad != null && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {l.cantidad} {l.unidad} {l.moneda === 'USD' ? '· US$' : ''}
                          {l.proveedorNota ? ` · ${l.proveedorNota}` : ''}
                        </span>
                      )}
                    </span>
                    <span className="text-sm tabular-nums shrink-0">
                      {soles(conHijos.totalDe(l.item))}
                    </span>
                  </div>
                ))}
                {lineas.length === 0 && !cargando && (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin partidas.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

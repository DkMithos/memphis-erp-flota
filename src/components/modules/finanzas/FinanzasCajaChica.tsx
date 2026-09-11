import { useState, useMemo, useEffect } from 'react';
import { Plus, Wallet, X, Download, FileText, ChevronDown, Coins, FolderOpen, Layers, Pencil, ArrowDownCircle } from 'lucide-react';
import { PageNav } from '@/components/shared/PageNav';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useFinanzas, type CajaChica, type GastoCajaChica } from '@/lib/finanzas/finanzas-store';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { CentroCostoSelector } from '../../shared/CentroCostoSelector';
import { useCentrosCosto } from '../../../lib/centros-costo/centros-costo-store';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { useAuth } from '@/auth/AuthProvider';
import { useProyectos } from '@/lib/proyectos/proyectos-store';
import { useCatalogos } from '@/lib/shared/catalogos-store';
import { exportToExcel, exportToExcelMultiHoja, exportToPDF, exportCajaModeloExcel, type MovimientoCajaModelo } from '@/lib/shared/export-utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase/client';
import { usePagination } from '@/lib/shared/usePagination';
import { cajasParaMostrar } from '@/lib/finanzas/cajas-orden';

interface Props {
  onNavigate: (route: string) => void;
}

/**
 * La moneda es OBLIGATORIA a propósito. Antes tenía 'PEN' por defecto y tres
 * llamadas se olvidaron de pasarla: una caja en dólares mostraba sus gastos
 * rotulados en soles, que es peor que no mostrar el símbolo.
 */
/** `2026-09-09` → `09/09`. Para no repetir el año en cada línea. */
const fechaCorta = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-');
  return d && m ? `${d}/${m}` : iso;
};

function fmt(n: number, moneda: string) {
  const sym = moneda === 'USD' ? '$' : 'S/';
  return `${sym} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

const ESTADO_CAJA_COLORS = {
  activo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  en_reposicion: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  cerrada: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
};

interface NuevaCajaForm {
  nombre: string;
  responsable: string;
  /** Depósito con el que se refuerza la caja, aparte del saldo que arrastra. */
  montoAdicional: string;
  moneda: 'PEN' | 'USD';
  /** Caja abierta de la que hereda el saldo; '' = caja desde cero. */
  cajaOrigenId: string;
}

/** Un ingreso de caja, tal como lo devuelve la tabla. */
interface IngresoCaja {
  _dbId: string;
  numero: string | null;
  descripcion: string;
  tipo: string | null;
  monto: number;
  moneda: string;
  fecha: string | null;
  origen: string | null;
}

interface NuevoIngresoForm {
  descripcion: string;
  monto: string;
  fecha: string;
  origen: string;
}

interface NuevoGastoForm {
  descripcion: string;
  categoria: string;
  monto: string;
  fecha: string;
  beneficiario: string;
  comprobanteNumero: string;
  comprobanteTipo: string;
  notas: string;
}

const defaultGastoForm: NuevoGastoForm = {
  descripcion: '',
  categoria: '',
  monto: '',
  fecha: new Date().toISOString().split('T')[0],
  beneficiario: '',
  comprobanteNumero: '',
  comprobanteTipo: '',
  notas: '',
};

export function FinanzasCajaChica({ onNavigate: _onNavigate }: Props) {
  const { cajasChicas, gastos, addGasto, updateGasto, updateCajaChica, loading, reload } = useFinanzas();
  const { can } = usePermissions();
  // Cada usuario descarga su propia data: se exige <modulo>.exportar
  const puedeExportar = can('finanzas', 'exportar');
  // Ver no es poder escribir. El módulo se abría a quien tuviera `finanzas.ver`
  // y a partir de ahí los botones no preguntaban nada más: Miguelangel, que
  // tiene la caja solo en lectura, podía abrir una caja, registrar gastos y
  // cerrarla. Los permisos `crear` y `editar` ya existían; nadie los miraba.
  const puedeRegistrar = can('finanzas', 'crear');
  const puedeCerrar = can('finanzas', 'editar');
  const { tenantId, user } = useAuth();
  const { proyectos } = useProyectos();
  const { getByTipo } = useCatalogos();
  const { centrosCosto } = useCentrosCosto();
  const tiposDocCaja = getByTipo('tipo_doc_caja');

  const [selectedCajaId, setSelectedCajaId] = useState<string | null>(null);
  // Filtros de navegación de cajas (para no scrollear entre muchas)
  const [cajaSearch, setCajaSearch] = useState('');
  const [cajaMoneda, setCajaMoneda] = useState<'todos' | 'PEN' | 'USD'>('todos');
  const [cajaEstado, setCajaEstado] = useState<'todos' | 'activo' | 'en_reposicion' | 'cerrada'>('todos');
  const [filtroProyecto, setFiltroProyecto] = useState<string>('todos');

  // Gastos del proyecto seleccionado (cruza todas las cajas) — para "datos por proyecto"
  const gastosDelProyecto = useMemo(() => {
    if (filtroProyecto === 'todos') return [];
    return gastos.filter(g => g.proyectoId === filtroProyecto);
  }, [gastos, filtroProyecto]);

  const proyectoNombre = (id: string) => proyectos.find(p => p._dbId === id)?.nombre ?? id;


  /** Exporta la caja seleccionada en el MISMO formato del Excel de Administración (modelo). */
  const exportarModeloCaja = async (caja: CajaChica) => {
    if (!puedeExportar) return;
    try {
      const [egr, ing] = await Promise.all([
        supabase.from('gastos_caja_chica')
          .select('numero, centro_costo, categoria, comprobante_numero, beneficiario, descripcion, monto, fecha')
          .eq('caja_id', caja._dbId),
        supabase.from('ingresos_caja_chica')
          .select('numero, centro_costo, comprobante_tipo, comprobante_numero, origen, descripcion, monto, fecha, tipo')
          .eq('caja_id', caja._dbId),
      ]);
      if (egr.error) throw egr.error;
      if (ing.error) throw ing.error;
      const movs: MovimientoCajaModelo[] = [
        ...(ing.data ?? []).map((r: any) => ({
          item: r.numero, centroCosto: r.centro_costo, tipoDoc: r.comprobante_tipo,
          comprobante: r.comprobante_numero, razonSocial: r.origen,
          descripcion: r.descripcion, ingreso: Number(r.monto), egreso: null, fecha: r.fecha,
        })),
        ...(egr.data ?? []).map((r: any) => ({
          item: r.numero, centroCosto: r.centro_costo, tipoDoc: r.categoria,
          comprobante: r.comprobante_numero, razonSocial: r.beneficiario,
          descripcion: r.descripcion, ingreso: null, egreso: Number(r.monto), fecha: r.fecha,
        })),
      ];
      // Orden del modelo: por ITEM numérico (correlativo original); fallback por fecha
      movs.sort((a, b) => {
        const na = Number(a.item), nb = Number(b.item);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a.fecha ?? '').localeCompare(String(b.fecha ?? ''));
      });
      await exportCajaModeloExcel(
        { nombre: caja.nombre, codigo: caja.id, responsable: caja.responsable, moneda: caja.moneda },
        movs,
      );
    } catch (e) {
      toast.error('No se pudo exportar la caja: ' + (e instanceof Error ? e.message : 'error'));
    }
  };

  const exportarGastosProyecto = (formato: 'excel' | 'pdf') => {

    if (!puedeExportar) return;
    const datos = gastosDelProyecto.map(g => ({
      fecha: g.fecha ? new Date(g.fecha).toLocaleDateString('es-PE') : '',
      caja: g.cajaNombre,
      descripcion: g.descripcion,
      categoria: g.categoria,
      beneficiario: g.beneficiario ?? '',
      comprobante: g.comprobanteNumero ?? '',
      monto: Number(g.monto ?? 0).toFixed(2),
      moneda: g.moneda,
    }));
    const headers = { fecha: 'Fecha', caja: 'Caja', descripcion: 'Descripción', categoria: 'Categoría', beneficiario: 'Beneficiario', comprobante: 'Comprobante', monto: 'Monto', moneda: 'Moneda' };
    const nombre = `caja-chica-${proyectoNombre(filtroProyecto).replace(/\s+/g, '_')}-${new Date().toISOString().slice(0,10)}`;
    if (formato === 'excel') exportToExcel(nombre, datos, headers);
    else exportToPDF(nombre, `Caja Chica — ${proyectoNombre(filtroProyecto)}`, datos, headers);
  };
  const [showNuevaCaja, setShowNuevaCaja] = useState(false);
  /** Nombres de cajas cuyo saldo ya viajó a otra: no se arrastra dos veces. */
  const [saldosYaArrastrados, setSaldosYaArrastrados] = useState<Set<string>>(new Set());
  const [showNuevoGasto, setShowNuevoGasto] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nuevaCajaForm, setNuevaCajaForm] = useState<NuevaCajaForm>({
    nombre: '',
    responsable: '',
    montoAdicional: '',
    moneda: 'PEN',
    cajaOrigenId: '',
  });

  const [showNuevoIngreso, setShowNuevoIngreso] = useState(false);
  /** Movimiento que se está corrigiendo; null = se está creando uno nuevo. */
  const [gastoEditando, setGastoEditando] = useState<GastoCajaChica | null>(null);
  const [ingresoEditando, setIngresoEditando] = useState<IngresoCaja | null>(null);
  /** Ingresos de la caja abierta. Los gastos ya vienen del store; estos no. */
  const [ingresosDeCaja, setIngresosDeCaja] = useState<IngresoCaja[]>([]);
  /** Caja que se llevó el saldo de esta, si esta ya se cerró. */
  const [cajaSucesora, setCajaSucesora] = useState<string | null>(null);
  const [refrescoIngresos, setRefrescoIngresos] = useState(0);
  const [ingresoForm, setIngresoForm] = useState<NuevoIngresoForm>({
    descripcion: '', monto: '', fecha: new Date().toISOString().slice(0, 10), origen: '',
  });

  const [gastoForm, setGastoForm] = useState<NuevoGastoForm>(defaultGastoForm);
  const [gastoProyectoId, setGastoProyectoId] = useState<string | null>(null);
  const [gastoCentroCostoId, setGastoCentroCostoId] = useState<string | null>(null);

  const selectedCaja = cajasChicas.find(c => c._dbId === selectedCajaId) ?? null;

  /** El gasto que se está tecleando no cabe en lo que queda en la caja. */
  const excedeSaldo = (() => {
    const m = parseFloat(gastoForm.monto);
    return !!selectedCaja && !isNaN(m) && m > selectedCaja.montoDisponible;
  })();

  // Filtrado y orden viven en cajas-orden.ts para poder probarlos: abiertas
  // primero y orden natural, para que CAJA 2 no quede detrás de CAJA 10.
  const cajasFiltradas = useMemo(
    () => cajasParaMostrar(cajasChicas, {
      busqueda: cajaSearch, moneda: cajaMoneda, estado: cajaEstado,
    }),
    [cajasChicas, cajaSearch, cajaMoneda, cajaEstado],
  );

  /**
   * Totales de lo que está en pantalla, SIEMPRE separados por moneda.
   * Sumar PEN y USD sin tipo de cambio por fecha daría una cifra que no se
   * puede defender (ver PLAN-Dashboard-Gerencia.md §6).
   */
  const totalesPorMoneda = useMemo(() => {
    const acc: Record<string, { cajas: number; abiertas: number; asignado: number; disponible: number }> = {};
    for (const c of cajasFiltradas) {
      const m = c.moneda ?? 'PEN';
      acc[m] ??= { cajas: 0, abiertas: 0, asignado: 0, disponible: 0 };
      acc[m].cajas++;
      if (c.estado !== 'cerrada') acc[m].abiertas++;
      acc[m].asignado += Number(c.montoAsignado ?? 0);
      acc[m].disponible += Number(c.montoDisponible ?? 0);
    }
    return acc;
  }, [cajasFiltradas]);

  /** Descripción de los filtros activos, para nombrar el archivo y avisar qué salió. */
  const alcanceActual = useMemo(() => {
    const partes: string[] = [];
    if (cajaMoneda !== 'todos') partes.push(cajaMoneda);
    if (cajaEstado !== 'todos') partes.push(cajaEstado.replace('_', ' '));
    if (cajaSearch.trim()) partes.push(`"${cajaSearch.trim()}"`);
    return partes.length ? partes.join(' · ') : 'todas las cajas';
  }, [cajaMoneda, cajaEstado, cajaSearch]);

  const CAB_CAJAS = {
    codigo: 'Código', nombre: 'Caja', responsable: 'Responsable', moneda: 'Moneda',
    asignado: 'Monto asignado', gastado: 'Gastado', disponible: 'Disponible',
    usado: '% usado', estado: 'Estado',
  };
  const filasCajas = () => cajasFiltradas.map(c => ({
    codigo: c.id, nombre: c.nombre, responsable: c.responsable, moneda: c.moneda,
    asignado: Number(c.montoAsignado ?? 0),
    gastado: Number(c.montoAsignado ?? 0) - Number(c.montoDisponible ?? 0),
    disponible: Number(c.montoDisponible ?? 0),
    usado: Number(c.porcentajeUsado ?? 0),
    estado: c.estado.replace('_', ' '),
  }));

  /** Trae los movimientos (gastos + ingresos) de las cajas que están en pantalla. */
  const movimientosDeLasCajas = async () => {
    const ids = cajasFiltradas.map(c => c._dbId);
    if (ids.length === 0) return [];
    const nombrePorId = new Map(cajasFiltradas.map(c => [c._dbId, `${c.nombre} (${c.moneda})`]));
    const [egr, ing] = await Promise.all([
      supabase.from('gastos_caja_chica')
        .select('caja_id, numero, fecha, centro_costo, categoria, comprobante_numero, beneficiario, descripcion, monto, moneda, estado')
        .in('caja_id', ids),
      supabase.from('ingresos_caja_chica')
        .select('caja_id, numero, fecha, descripcion, origen, monto, moneda')
        .in('caja_id', ids),
    ]);
    const filas = [
      ...(ing.data ?? []).map((r: any) => ({
        caja: nombrePorId.get(r.caja_id) ?? '', fecha: r.fecha, item: r.numero,
        centroCosto: '', tipoDoc: 'INGRESO', comprobante: '', razonSocial: r.origen ?? '',
        descripcion: r.descripcion, ingreso: Number(r.monto), egreso: null,
        moneda: r.moneda, estado: '',
      })),
      ...(egr.data ?? []).map((r: any) => ({
        caja: nombrePorId.get(r.caja_id) ?? '', fecha: r.fecha, item: r.numero,
        centroCosto: r.centro_costo, tipoDoc: r.categoria, comprobante: r.comprobante_numero,
        razonSocial: r.beneficiario, descripcion: r.descripcion,
        ingreso: null, egreso: Number(r.monto), moneda: r.moneda, estado: r.estado,
      })),
    ];
    return filas.sort((a, b) =>
      String(a.caja).localeCompare(String(b.caja)) ||
      String(a.fecha ?? '').localeCompare(String(b.fecha ?? '')));
  };

  const CAB_MOVS = {
    caja: 'Caja', fecha: 'Fecha', item: 'Item', centroCosto: 'Centro de costo',
    tipoDoc: 'Tipo doc', comprobante: 'Comprobante', razonSocial: 'Razón social',
    descripcion: 'Descripción', ingreso: 'Ingreso', egreso: 'Egreso',
    moneda: 'Moneda', estado: 'Estado',
  };

  const fechaHoy = () => new Date().toISOString().slice(0, 10);

  /** 1 · Resumen: una fila por caja, tal como se ve en pantalla. */
  const exportarResumenCajas = async () => {
    if (!puedeExportar) return;
    await exportToExcel(`cajas-chicas-resumen-${fechaHoy()}`, filasCajas(), CAB_CAJAS, 'Cajas');
    toast.success(`${cajasFiltradas.length} caja(s) exportadas — ${alcanceActual}`);
  };

  /** 2 · Resumen + todos los movimientos, en un solo archivo de dos hojas. */
  const exportarConMovimientos = async () => {
    if (!puedeExportar) return;
    try {
      const movs = await movimientosDeLasCajas();
      await exportToExcelMultiHoja(`cajas-chicas-detalle-${fechaHoy()}`, [
        { nombre: 'Cajas', data: filasCajas(), headersMap: CAB_CAJAS },
        { nombre: 'Movimientos', data: movs, headersMap: CAB_MOVS },
      ]);
      toast.success(`${cajasFiltradas.length} caja(s) y ${movs.length} movimiento(s) — ${alcanceActual}`);
    } catch (e) {
      toast.error('No se pudieron exportar los movimientos: ' + (e instanceof Error ? e.message : 'error'));
    }
  };

  /** 3 · Consolidado por moneda: una fila por moneda. */
  const exportarPorMoneda = async () => {
    if (!puedeExportar) return;
    const filas = Object.entries(totalesPorMoneda).map(([moneda, t]) => ({
      moneda,
      cajas: t.cajas,
      abiertas: t.abiertas,
      cerradas: t.cajas - t.abiertas,
      asignado: Math.round(t.asignado * 100) / 100,
      gastado: Math.round((t.asignado - t.disponible) * 100) / 100,
      disponible: Math.round(t.disponible * 100) / 100,
    }));
    await exportToExcel(`cajas-chicas-por-moneda-${fechaHoy()}`, filas, {
      moneda: 'Moneda', cajas: 'Cajas', abiertas: 'Abiertas', cerradas: 'Cerradas',
      asignado: 'Asignado', gastado: 'Gastado', disponible: 'Disponible',
    }, 'Por moneda');
    toast.success(`Consolidado por moneda — ${alcanceActual}`);
  };

  /**
   * Ingresos de la caja abierta y de dónde viene / a dónde fue su saldo.
   *
   * Carolina necesita ver con cuánto se abrió la caja y desde cuál venía: el
   * arrastre es el ingreso de tipo `saldo_anterior`, y quien se llevó su saldo
   * es la caja cuyo arrastre la menciona como origen.
   */
  useEffect(() => {
    if (!selectedCaja) { setIngresosDeCaja([]); setCajaSucesora(null); return; }
    let vivo = true;
    (async () => {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const t = () => (supabase as any).from('ingresos_caja_chica');
      const [propios, sucesora] = await Promise.all([
        t().select('id, numero, descripcion, tipo, monto, moneda, fecha, origen')
           .eq('caja_id', selectedCaja._dbId)
           .order('fecha', { ascending: true }),
        t().select('caja_id, cajas_chicas!inner(nombre)')
           .eq('tipo', 'saldo_anterior')
           .eq('origen', selectedCaja.nombre)
           .limit(1),
      ]);
      if (!vivo) return;
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      setIngresosDeCaja(((propios.data ?? []) as any[]).map((r): IngresoCaja => ({
        _dbId: r.id, numero: r.numero, descripcion: r.descripcion ?? '', tipo: r.tipo,
        monto: Number(r.monto ?? 0), moneda: r.moneda, fecha: r.fecha, origen: r.origen,
      })));
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const suc = (sucesora.data ?? [])[0] as any;
      setCajaSucesora(suc?.cajas_chicas?.nombre ?? null);
    })();
    return () => { vivo = false; };
  }, [selectedCaja, refrescoIngresos]);

  /**
   * Solo se corrige en una caja abierta. Si el error está en una cerrada hay que
   * reabrirla primero: es el mismo criterio con el que la base impide registrar
   * movimientos en una caja cerrada.
   */
  const puedeCorregir = can('finanzas', 'editar') && selectedCaja?.estado !== 'cerrada';

  const abrirEdicionGasto = (g: GastoCajaChica) => {
    setGastoEditando(g);
    setGastoForm({
      descripcion: g.descripcion ?? '',
      categoria: g.categoria ?? '',
      monto: String(g.monto ?? ''),
      fecha: g.fecha ?? new Date().toISOString().slice(0, 10),
      beneficiario: g.beneficiario ?? '',
      comprobanteNumero: g.comprobanteNumero ?? '',
      comprobanteTipo: g.comprobanteTipo ?? '',
      notas: g.notas ?? '',
    });
    setGastoCentroCostoId(centrosCosto.find(c => c.codigo === g.centroCosto)?._dbId ?? null);
    setGastoProyectoId(g.proyectoId ?? null);
    setShowNuevoGasto(true);
  };

  const abrirEdicionIngreso = (i: IngresoCaja) => {
    setIngresoEditando(i);
    setIngresoForm({
      descripcion: i.descripcion ?? '',
      monto: String(i.monto ?? ''),
      fecha: i.fecha ?? new Date().toISOString().slice(0, 10),
      origen: i.origen ?? '',
    });
    setShowNuevoIngreso(true);
  };

  /** El desglose de la apertura, tal como lo pide Carolina. */
  const origenCaja = useMemo(() => {
    const arrastre = ingresosDeCaja.find(i => i.tipo === 'saldo_anterior') ?? null;
    const depositos = ingresosDeCaja.filter(i => i.tipo !== 'saldo_anterior');
    return {
      arrastre,
      cajaAnterior: arrastre?.origen ?? null,
      montoArrastrado: arrastre?.monto ?? 0,
      depositos,
      totalDepositos: depositos.reduce((s, i) => s + i.monto, 0),
    };
  }, [ingresosDeCaja]);

  // Gastos de la caja: del más reciente al más antiguo (fecha desc, luego creación desc)
  const gastosDeCaja = useMemo(() =>
    gastos
      .filter(g => g.cajaDbId === selectedCajaId)
      .sort((a, b) =>
        String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')) ||
        String(b.creadoEn ?? '').localeCompare(String(a.creadoEn ?? ''))
      ),
    [gastos, selectedCajaId]
  );
  const {
    paged: gastosPaged, page: gastosPage, totalPages: gastosTotalPages,
    totalItems: gastosTotal, setPage: setGastosPage,
  } = usePagination(gastosDeCaja);

  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const anioActual = hoy.getFullYear();

  const kpisGastos = useMemo(() => {
    const mes = gastosDeCaja.filter(g => {
      const d = new Date(g.fecha);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual && g.estado !== 'rechazado';
    });
    const total = mes.reduce((s, g) => s + g.monto, 0);
    return { total };
  }, [gastosDeCaja, mesActual, anioActual]);

  // Qué saldos ya viajaron a otra caja. Se relee cuando cambia el conjunto.
  useEffect(() => {
    let vivo = true;
    (async () => {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const { data } = await (supabase as any)
        .from('ingresos_caja_chica')
        .select('origen')
        .eq('tipo', 'saldo_anterior');
      if (!vivo) return;
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      setSaldosYaArrastrados(new Set(((data ?? []) as any[]).map(r => r.origen).filter(Boolean)));
    })();
    return () => { vivo = false; };
  }, [refrescoIngresos, cajasChicas.length]);

  /**
   * Cajas que pueden ceder su saldo a una nueva, por moneda.
   *
   * Incluye las **cerradas** que todavía no lo cedieron: cerrar la caja y
   * abrir la siguiente después es la secuencia natural de quien la lleva, y
   * antes eso dejaba el saldo —o la deuda— sin a dónde ir. Un saldo se arrastra
   * una sola vez, así que las ya cedidas quedan fuera.
   */
  const cajasQueCedenSaldo = useMemo(() => {
    const correlativo = (nombre: string) =>
      Number((nombre.match(/CAJA\s+(\d+)/i) ?? [])[1] ?? 0);

    const deLaMoneda = cajasChicas.filter(c =>
      c.moneda === nuevaCajaForm.moneda && !saldosYaArrastrados.has(c.nombre));

    const abiertas = deLaMoneda.filter(c => c.estado !== 'cerrada');

    // De las cerradas solo se ofrece la ÚLTIMA con saldo pendiente de arrastrar.
    // Las demás son del histórico migrado —23 cajas de la época del Excel, con
    // saldos ya liquidados fuera del sistema— y ofrecerlas invita a arrastrar
    // por error una deuda de hace meses.
    const ultimaCerrada = deLaMoneda
      .filter(c => c.estado === 'cerrada' && Number(c.montoDisponible ?? 0) !== 0)
      .sort((a, b) => correlativo(b.nombre) - correlativo(a.nombre))[0];

    return ultimaCerrada ? [...abiertas, ultimaCerrada] : abiertas;
  }, [cajasChicas, nuevaCajaForm.moneda, saldosYaArrastrados]);
  const cajaOrigen = cajasQueCedenSaldo.find(c => c._dbId === nuevaCajaForm.cajaOrigenId);
  const saldoQueArrastra = cajaOrigen?.montoDisponible ?? 0;
  const aperturaTotal = saldoQueArrastra + (parseFloat(nuevaCajaForm.montoAdicional) || 0);

  /**
   * La apertura la resuelve la base en una sola transacción
   * (`fn_abrir_caja_chica`): crea la caja, arrastra el saldo de la anterior,
   * suma el depósito y cierra la de origen. Hacerlo en cuatro pasos desde aquí
   * dejaría cajas a medio abrir si se corta la conexión en medio.
   */
  const handleCrearCaja = async () => {
    if (!nuevaCajaForm.responsable.trim()) {
      toast.error('Indica el responsable de la caja');
      return;
    }
    const adicional = parseFloat(nuevaCajaForm.montoAdicional) || 0;
    if (adicional < 0) { toast.error('El monto adicional no puede ser negativo'); return; }
    // Abrir arrastrando solo una deuda es válido: es justo lo que hay que
    // reflejar. Solo se rechaza si no hay NADA que mover.
    if (saldoQueArrastra === 0 && adicional === 0) {
      toast.error('No hay nada que abrir: elige una caja de origen con saldo o indica un monto');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc('fn_abrir_caja_chica', {
        p_responsable: nuevaCajaForm.responsable.trim(),
        p_moneda: nuevaCajaForm.moneda,
        p_monto_adicional: adicional,
        p_caja_origen: nuevaCajaForm.cajaOrigenId || null,
        p_nombre: nuevaCajaForm.nombre.trim() || null,
      });
      if (error) throw error;
      const creada = (Array.isArray(data) ? data[0] : data) as { nombre?: string } | null;
      toast.success(`${creada?.nombre ?? 'Caja'} abierta`, {
        description: cajaOrigen
          ? `Arrastra ${fmt(saldoQueArrastra, nuevaCajaForm.moneda)} de ${cajaOrigen.nombre}, que queda cerrada`
          : `Saldo inicial ${fmt(adicional, nuevaCajaForm.moneda)}`,
      });
      setShowNuevaCaja(false);
      setNuevaCajaForm({ nombre: '', responsable: '', montoAdicional: '', moneda: 'PEN', cajaOrigenId: '' });
      await reload?.();
    } catch (e) {
      toast.error('No se pudo abrir la caja', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally { setSaving(false); }
  };

  /** Reposición: dinero que entra a una caja ya abierta. */
  const handleCrearIngreso = async () => {
    if (!tenantId || !selectedCaja) return;
    if (!ingresoForm.descripcion.trim() || !ingresoForm.monto || !ingresoForm.fecha) {
      toast.error('Completa descripción, monto y fecha');
      return;
    }
    const monto = parseFloat(ingresoForm.monto);
    if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return; }

    setSaving(true);
    try {
      const tablaIngresos = () => (supabase as any).from('ingresos_caja_chica');

      // Corrección de un ingreso ya registrado: se actualiza, no se duplica.
      if (ingresoEditando) {
        const { error } = await tablaIngresos().update({
          descripcion: ingresoForm.descripcion.trim(),
          monto,
          fecha: ingresoForm.fecha,
          origen: ingresoForm.origen.trim() || null,
        }).eq('id', ingresoEditando._dbId);
        if (error) throw error;
        toast.success('Ingreso corregido');
        setShowNuevoIngreso(false);
        setIngresoEditando(null);
        setIngresoForm({ descripcion: '', monto: '', fecha: new Date().toISOString().slice(0, 10), origen: '' });
        setRefrescoIngresos(n => n + 1);
        await reload?.();
        return;
      }

      // Igual que en los gastos: numera la base, no el navegador.
      const { error } = await tablaIngresos().insert({
        tenant_id: tenantId,
        caja_id: selectedCaja._dbId,
        numero: '',
        descripcion: ingresoForm.descripcion.trim(),
        tipo: 'reposicion',
        monto,
        moneda: selectedCaja.moneda,
        fecha: ingresoForm.fecha,
        origen: ingresoForm.origen.trim() || null,
        estado: 'confirmado',
      });
      if (error) throw error;
      toast.success(`Ingreso de ${fmt(monto, selectedCaja.moneda)} registrado`);
      setRefrescoIngresos(n => n + 1);
      setShowNuevoIngreso(false);
      setIngresoForm({ descripcion: '', monto: '', fecha: new Date().toISOString().slice(0, 10), origen: '' });
      await reload?.();
    } catch (e) {
      toast.error('No se pudo registrar el ingreso', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally { setSaving(false); }
  };

  const handleCrearGasto = async () => {
    if (!tenantId || !selectedCajaId || !selectedCaja) return;
    if (!gastoForm.descripcion.trim() || !gastoForm.categoria.trim() || !gastoForm.monto || !gastoForm.fecha) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    // Todo gasto va contra un centro de costo: es lo que lo lleva al proyecto.
    if (!gastoCentroCostoId) {
      toast.error('Indica el centro de costo: sin él el gasto no llega a ningún proyecto');
      return;
    }
    const monto = parseFloat(gastoForm.monto);
    if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return; }

    // El gasto puede superar el saldo —el dinero se gasta antes de que llegue
    // la reposición— pero no en silencio: se dice con cuánto queda la caja y
    // hay que aceptarlo. Quien registra decide, con el dato delante.
    let permitirDescubierto = false;
    if (!gastoEditando && selectedCaja && monto > selectedCaja.montoDisponible) {
      const restante = selectedCaja.montoDisponible - monto;
      const ok = window.confirm(
        `El gasto supera el saldo de "${selectedCaja.nombre}".

`
        + `Disponible: ${fmt(selectedCaja.montoDisponible, selectedCaja.moneda)}
`
        + `Gasto: ${fmt(monto, selectedCaja.moneda)}
`
        + `La caja quedará en: ${fmt(restante, selectedCaja.moneda)}

`
        + `¿Registrarlo igualmente?`,
      );
      if (!ok) return;
      permitirDescubierto = true;
    }

    setSaving(true);
    try {
      // Corrección de un gasto ya registrado: se actualiza, no se duplica. El
      // saldo de la caja lo recalcula solo el disparador de la base.
      if (gastoEditando) {
        await updateGasto(gastoEditando._dbId, {
          descripcion: gastoForm.descripcion,
          categoria: gastoForm.categoria,
          monto,
          fecha: gastoForm.fecha,
          beneficiario: gastoForm.beneficiario || null,
          comprobante_numero: gastoForm.comprobanteNumero || null,
          comprobante_tipo: (gastoForm.comprobanteTipo as GastoCajaChica['comprobanteTipo']) || null,
          notas: gastoForm.notas || null,
          centro_costo: centrosCosto.find(c => c._dbId === gastoCentroCostoId)?.codigo ?? null,
          proyecto_id: gastoProyectoId,
        });
        toast.success(`Gasto ${gastoEditando.id} corregido`);
        setShowNuevoGasto(false);
        setGastoEditando(null);
        setGastoForm(defaultGastoForm);
        setGastoProyectoId(null);
        setGastoCentroCostoId(null);
        return;
      }

      // El número lo asigna la BASE (`trg_numerar_gasto`). Antes se calculaba
      // aquí contando los gastos en memoria, y con la lista desactualizada o
      // dos personas registrando a la vez salía repetido: en CAJA 25 SOLES
      // acabaron dos gastos con el mismo GCC-2026-004.
      await addGasto({
        tenant_id: tenantId,
        caja_id: selectedCajaId,
        numero: '',
        descripcion: gastoForm.descripcion,
        categoria: gastoForm.categoria,
        monto,
        // La moneda es la de la caja, no siempre soles: un gasto de CAJA 17
        // DÓLARES se estaba GUARDANDO como PEN, no solo mostrándose así.
        moneda: selectedCaja.moneda,
        fecha: gastoForm.fecha,
        beneficiario: gastoForm.beneficiario || null,
        comprobante_numero: gastoForm.comprobanteNumero || null,
        comprobante_tipo: (gastoForm.comprobanteTipo as GastoCajaChica['comprobanteTipo']) || null,
        // Sin paso de aprobación (decisión de Kevin, 08/09): quien registra el
        // gasto es quien lo aprueba, así que nace aprobado y firmado por ella.
        estado: 'aprobado',
        aprobado_por: user?.email ?? null,
        notas: gastoForm.notas || null,
        realizado_por: user?.email ?? null,
        // La pantalla tenía los selectores de proyecto y centro de costo desde
        // siempre, pero no se guardaban: cada gasto nacía sin imputar y no
        // llegaba al proyecto. `centro_costo` va por CÓDIGO porque es lo que
        // lee el disparador `trg_gasto_proyecto` para derivar el proyecto solo.
        centro_costo: centrosCosto.find(c => c._dbId === gastoCentroCostoId)?.codigo ?? null,
        proyecto_id: gastoProyectoId,
      }, { permitirDescubierto });
      // Si la caja quedó en descubierto se dice al terminar, no solo al
      // preguntar: es el dato que hay que arrastrar hasta la reposición.
      if (permitirDescubierto && selectedCaja) {
        toast.success('Gasto registrado', {
          description: `"${selectedCaja.nombre}" queda en `
            + `${fmt(selectedCaja.montoDisponible - monto, selectedCaja.moneda)}. `
            + `Pendiente de reposición.`,
        });
      } else {
        toast.success('Gasto registrado');
      }
      setShowNuevoGasto(false);
      setGastoForm(defaultGastoForm);
      setGastoProyectoId(null);
      setGastoCentroCostoId(null);
    } catch (e) {
      // El motivo importa: el más frecuente es que el gasto supera el saldo, y
      // "Error al registrar gasto" a secas obliga a adivinarlo.
      toast.error('No se pudo registrar el gasto', {
        description: e instanceof Error ? e.message : undefined,
      });
    }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {/* Abrir una caja no cambia la URL: es estado interno. Sin este override,
          "Volver" hacía history.back() y saltaba al módulo anterior en vez de
          regresar a la lista de cajas. */}
      <PageNav onBack={selectedCajaId ? () => setSelectedCajaId(null) : undefined} />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <Wallet className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Caja Chica</h2>
            <p className="text-muted-foreground mt-1">Gestión de fondos y gastos de caja chica</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Un solo menú con todo lo descargable: qué sale depende de los
              filtros de abajo, así que "exporto lo que veo". */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!puedeExportar || cajasChicas.length === 0}>
                <Download className="size-4" />
                Exportar
                <ChevronDown className="size-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                Alcance actual: {alcanceActual} ({cajasFiltradas.length} de {cajasChicas.length})
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportarResumenCajas}>
                <Wallet className="size-4" />
                <div>
                  <div>Resumen de cajas</div>
                  <div className="text-xs text-muted-foreground">Una fila por caja</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportarConMovimientos}>
                <Layers className="size-4" />
                <div>
                  <div>Cajas + movimientos</div>
                  <div className="text-xs text-muted-foreground">Dos hojas: cajas y todo el detalle</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportarPorMoneda}>
                <Coins className="size-4" />
                <div>
                  <div>Consolidado por moneda</div>
                  <div className="text-xs text-muted-foreground">Totales de soles y dólares por separado</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={filtroProyecto === 'todos' || gastosDelProyecto.length === 0}
                onClick={() => exportarGastosProyecto('excel')}
              >
                <FolderOpen className="size-4" />
                <div>
                  <div>Gastos del proyecto</div>
                  <div className="text-xs text-muted-foreground">
                    {filtroProyecto === 'todos'
                      ? 'Elige un proyecto abajo'
                      : `${gastosDelProyecto.length} gasto(s) de ${proyectoNombre(filtroProyecto)}`}
                  </div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {puedeRegistrar && (
            <Button onClick={() => setShowNuevaCaja(true)}>
              <Plus className="size-4" />
              Nueva Caja Chica
            </Button>
          )}
        </div>
      </div>

      {/* Totales de lo filtrado, separados por moneda */}
      {!loading && cajasFiltradas.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(totalesPorMoneda).map(([moneda, t]) => (
            <Card key={moneda} className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {moneda === 'USD' ? 'Dólares' : 'Soles'}
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    {t.abiertas} abierta{t.abiertas === 1 ? '' : 's'} de {t.cajas}
                  </Badge>
                </div>
                <p className="text-2xl font-semibold mt-2 tabular-nums">{fmt(t.disponible, moneda)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  disponible de {fmt(t.asignado, moneda)} asignado
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Vista por Proyecto — datos de caja chica filtrados/exportables por proyecto */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Label className="shrink-0">Ver caja chica por proyecto:</Label>
            <Select value={filtroProyecto} onValueChange={setFiltroProyecto}>
              <SelectTrigger className="sm:w-72"><SelectValue placeholder="Todos los proyectos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los proyectos</SelectItem>
                {proyectos.map(p => (
                  <SelectItem key={p._dbId} value={p._dbId}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtroProyecto !== 'todos' && (
              <div className="flex gap-2 sm:ml-auto">
                <Button variant="outline" size="sm" disabled={gastosDelProyecto.length === 0} onClick={() => exportarGastosProyecto('excel')}>
                  <Download className="size-4" /> Excel
                </Button>
                <Button variant="outline" size="sm" disabled={gastosDelProyecto.length === 0} onClick={() => exportarGastosProyecto('pdf')}>
                  <FileText className="size-4" /> PDF
                </Button>
              </div>
            )}
          </div>

          {filtroProyecto !== 'todos' && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                {gastosDelProyecto.length} gasto(s) de caja chica para <strong>{proyectoNombre(filtroProyecto)}</strong>
                {(() => {
                  // Totales por moneda — NUNCA sumar USD+PEN sin convertir
                  const totPEN = gastosDelProyecto.filter(g => g.moneda !== 'USD').reduce((s, g) => s + (g.monto || 0), 0);
                  const totUSD = gastosDelProyecto.filter(g => g.moneda === 'USD').reduce((s, g) => s + (g.monto || 0), 0);
                  const combinado = Math.round((totPEN + totUSD * 3.40) * 100) / 100;
                  return (
                    <>
                      {' '}· Total: {totPEN > 0 && fmt(totPEN, 'PEN')}
                      {totPEN > 0 && totUSD > 0 && ' + '}
                      {totUSD > 0 && fmt(totUSD, 'USD')}
                      {totUSD > 0 && <span className="ml-1">(≈ {fmt(combinado, 'PEN')} al TC 3.40)</span>}
                    </>
                  );
                })()}
              </p>
              {gastosDelProyecto.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Caja</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Beneficiario</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gastosDelProyecto.map(g => (
                        <TableRow key={g._dbId}>
                          <TableCell className="text-sm whitespace-nowrap">{g.fecha ? new Date(g.fecha).toLocaleDateString('es-PE') : '—'}</TableCell>
                          <TableCell className="text-sm">{g.cajaNombre}</TableCell>
                          <TableCell className="text-sm">{g.descripcion}</TableCell>
                          <TableCell className="text-sm">{g.beneficiario ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm whitespace-nowrap">{fmt(g.monto, g.moneda)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards de Cajas — se ocultan cuando hay una caja abierta (el detalle toma el lugar) */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : cajasChicas.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center min-h-[200px] text-sm text-muted-foreground">
            Sin cajas chicas. Crea la primera.
          </CardContent>
        </Card>
      ) : selectedCaja ? null : (
        <>
          {/* Barra de navegación de cajas — evita scrollear entre muchas */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <Input
              placeholder="Buscar por nombre, código o responsable…"
              value={cajaSearch}
              onChange={(e) => setCajaSearch(e.target.value)}
              className="sm:max-w-xs"
            />
            <Select value={cajaMoneda} onValueChange={(v) => setCajaMoneda(v as 'todos' | 'PEN' | 'USD')}>
              <SelectTrigger className="sm:w-36"><SelectValue placeholder="Moneda" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Toda moneda</SelectItem>
                <SelectItem value="PEN">Soles (PEN)</SelectItem>
                <SelectItem value="USD">Dólares (USD)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={cajaEstado} onValueChange={(v) => setCajaEstado(v as 'todos' | 'activo' | 'en_reposicion' | 'cerrada')}>
              <SelectTrigger className="sm:w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo estado</SelectItem>
                <SelectItem value="activo">Activa</SelectItem>
                <SelectItem value="en_reposicion">En reposición</SelectItem>
                <SelectItem value="cerrada">Cerrada</SelectItem>
              </SelectContent>
            </Select>
            <SearchableSelect
              value={selectedCajaId}
              onChange={(v) => setSelectedCajaId(v)}
              options={cajasFiltradas.map(c => ({
                value: c._dbId,
                label: `${c.nombre} · ${c.moneda}`,
                keywords: `${c.id} ${c.responsable}`,
              }))}
              placeholder="Ir directo a una caja…"
              searchPlaceholder="Buscar caja…"
              className="sm:w-64"
            />
          </div>
          <p className="text-xs text-muted-foreground mb-2">{cajasFiltradas.length} de {cajasChicas.length} cajas</p>
          {cajasFiltradas.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center min-h-[120px] text-sm text-muted-foreground">
                Ninguna caja coincide con el filtro.
              </CardContent>
            </Card>
          ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Caja</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Mon.</TableHead>
                    <TableHead className="text-right">Asignado</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead className="w-40">% Usado</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cajasFiltradas.map(c => (
                    <TableRow
                      key={c._dbId}
                      className={`cursor-pointer ${selectedCajaId === c._dbId ? 'bg-primary/10 hover:bg-primary/10' : ''}`}
                      onClick={() => setSelectedCajaId(c._dbId)}
                    >
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Wallet className="size-4 text-primary shrink-0" />
                          <div>
                            <div className="font-medium text-sm leading-tight">{c.nombre}</div>
                            <div className="text-xs text-muted-foreground">{c.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{c.responsable}</TableCell>
                      <TableCell className="text-sm">{c.moneda}</TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">{fmt(c.montoAsignado, c.moneda)}</TableCell>
                      {/* Una caja en descubierto no es "gastada al 80%": es
                          otra cosa y se marca aparte. */}
                      <TableCell className={`text-right text-sm font-medium whitespace-nowrap ${
                        c.montoDisponible < 0
                          ? 'text-red-600 font-semibold'
                          : c.porcentajeUsado > 80 ? 'text-red-500' : 'text-green-600'
                      }`}>
                        {fmt(c.montoDisponible, c.moneda)}
                        {c.montoDisponible < 0 && (
                          <span className="block text-[10px] font-normal">en descubierto</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(c.porcentajeUsado, 100)}
                            className={`h-2 flex-1 ${c.porcentajeUsado > 80 ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`}
                          />
                          <span className="text-xs text-muted-foreground w-9 text-right">{c.porcentajeUsado.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${ESTADO_CAJA_COLORS[c.estado]}`}>{c.estado.replace('_', ' ')}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          )}
        </>
      )}

      {/* Panel de gastos de la caja seleccionada (reemplaza la lista; sin scroll tedioso) */}
      {selectedCaja && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="px-2 -ml-2 mb-1 text-muted-foreground"
                onClick={() => setSelectedCajaId(null)}
              >
                ← Volver a las cajas
              </Button>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{selectedCaja.nombre}</CardTitle>
                <Badge className={`text-xs ${ESTADO_CAJA_COLORS[selectedCaja.estado] ?? ''}`}>
                  {selectedCaja.estado.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                <span>Responsable: <strong className="text-foreground">{selectedCaja.responsable}</strong></span>
                <span>Asignado: <strong className="text-foreground">{fmt(selectedCaja.montoAsignado, selectedCaja.moneda)}</strong></span>
                <span>Disponible: <strong className={selectedCaja.montoDisponible < 0 ? 'text-red-600' : 'text-green-600'}>{fmt(selectedCaja.montoDisponible, selectedCaja.moneda)}</strong></span>
                <span>Total mes: <strong className="text-foreground">{fmt(kpisGastos.total, selectedCaja.moneda)}</strong></span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => exportarModeloCaja(selectedCaja)}>
                <Download className="size-4" />
                Exportar modelo
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={gastosDeCaja.length === 0}
                onClick={() => exportToExcel(
                  `gastos-${selectedCaja.id}`,
                  gastosDeCaja.map(g => ({
                    numero: g.id,
                    fecha: g.fecha ? new Date(g.fecha).toLocaleDateString('es-PE') : '',
                    descripcion: g.descripcion,
                    categoria: g.categoria,
                    beneficiario: g.beneficiario ?? '',
                    comprobante: g.comprobanteNumero ?? '',
                    monto: Number(g.monto ?? 0).toFixed(2),
                    moneda: g.moneda,
                    estado: g.estado,
                  })),
                  { numero: 'Número', fecha: 'Fecha', descripcion: 'Descripción', categoria: 'Categoría', beneficiario: 'Beneficiario', comprobante: 'Comprobante', monto: 'Monto', moneda: 'Moneda', estado: 'Estado' },
                )}
              >
                <FileText className="size-4" />
                Excel
              </Button>
              {puedeCerrar && (selectedCaja.estado === 'cerrada' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await updateCajaChica(selectedCaja._dbId, { estado: 'activo' });
                      toast.success(`${selectedCaja.nombre} reabierta`);
                    } catch (e) {
                      toast.error('No se pudo reabrir: ' + (e instanceof Error ? e.message : 'error'));
                    }
                  }}
                >
                  Reabrir Caja
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={async () => {
                    if (!window.confirm(`¿Cerrar ${selectedCaja.nombre}? No se podrán registrar más gastos ni ingresos en esta caja.`)) return;
                    try {
                      await updateCajaChica(selectedCaja._dbId, { estado: 'cerrada' });
                      toast.success(`${selectedCaja.nombre} cerrada — saldo final ${fmt(selectedCaja.montoDisponible, selectedCaja.moneda)}`);
                    } catch (e) {
                      toast.error('No se pudo cerrar: ' + (e instanceof Error ? e.message : 'error'));
                    }
                  }}
                >
                  <X className="size-4" />
                  Cerrar Caja
                </Button>
              ))}
              {selectedCaja.estado !== 'cerrada' && puedeRegistrar && (
                <Button size="sm" variant="outline" onClick={() => setShowNuevoIngreso(true)}>
                  <Plus className="size-4" />
                  Registrar Ingreso
                </Button>
              )}
              {selectedCaja.estado !== 'cerrada' && puedeRegistrar && (
                <Button size="sm" onClick={() => setShowNuevoGasto(true)}>
                  <Plus className="size-4" />
                  Registrar Gasto
                </Button>
              )}
            </div>
          </CardHeader>

          {/* De dónde salió el dinero de esta caja y a dónde fue su saldo.
              Es la lectura que Carolina hace en el Excel: la caja nueva abre con
              el saldo de la anterior más lo que se deposite. */}
          <CardContent className="pt-0 pb-4">
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Cómo se abrió esta caja
              </p>

              {origenCaja.arrastre ? (
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    Saldo que trajo de{' '}
                    <strong className="text-foreground">{origenCaja.cajaAnterior ?? 'la caja anterior'}</strong>
                  </span>
                  <span className="tabular-nums">{fmt(origenCaja.montoArrastrado, selectedCaja.moneda)}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Se abrió desde cero: no arrastra saldo de otra caja.
                </p>
              )}

              {origenCaja.depositos.map(d => (
                <div key={d._dbId} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {d.descripcion || 'Depósito'}
                    {d.fecha && <span className="text-xs ml-2">{fechaCorta(d.fecha)}</span>}
                  </span>
                  <span className="tabular-nums">{fmt(d.monto, selectedCaja.moneda)}</span>
                </div>
              ))}

              <div className="flex items-baseline justify-between gap-3 text-sm border-t pt-2">
                <span className="font-medium">Total con el que cuenta</span>
                <span className="font-semibold tabular-nums">{fmt(selectedCaja.montoAsignado, selectedCaja.moneda)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Gastado</span>
                <span className="tabular-nums">
                  {fmt(selectedCaja.montoAsignado - selectedCaja.montoDisponible, selectedCaja.moneda)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">Saldo actual</span>
                <span className={`font-semibold tabular-nums ${selectedCaja.montoDisponible < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fmt(selectedCaja.montoDisponible, selectedCaja.moneda)}
                </span>
              </div>

              {cajaSucesora && (
                <p className="text-xs text-muted-foreground border-t pt-2">
                  Su saldo pasó a <strong className="text-foreground">{cajaSucesora}</strong>.
                </p>
              )}
            </div>
          </CardContent>

          {/* Los ingresos también se corrigen: el arrastre de apertura o un
              depósito mal tecleado son tan editables como un gasto. */}
          {ingresosDeCaja.length > 0 && (
            <CardContent className="pt-0 pb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Ingresos de la caja ({ingresosDeCaja.length})
              </p>
              <div className="rounded-md border divide-y">
                {ingresosDeCaja.map(i => (
                  <div key={i._dbId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0 flex items-center gap-2">
                      <ArrowDownCircle className="size-4 text-green-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate">{i.descripcion || 'Ingreso'}</p>
                        <p className="text-xs text-muted-foreground">
                          {i.fecha ? fechaCorta(i.fecha) : 'sin fecha'}
                          {i.origen && ` · ${i.origen}`}
                          {i.tipo === 'saldo_anterior' && ' · apertura'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="tabular-nums font-medium">{fmt(i.monto, selectedCaja.moneda)}</span>
                      {puedeCorregir && (
                        <Button
                          variant="ghost" size="icon" className="size-7"
                          title="Corregir este ingreso"
                          onClick={() => abrirEdicionIngreso(i)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}

          <CardContent className="p-0">
            {gastosDeCaja.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">Sin gastos registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Beneficiario</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Comprobante</TableHead>
                      {puedeCorregir && <TableHead className="w-16"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gastosPaged.map(g => (
                      <TableRow key={g._dbId}>
                        <TableCell className="font-mono text-xs">{g.id}</TableCell>
                        <TableCell className="text-sm">{g.fecha}</TableCell>
                        <TableCell className="text-sm max-w-[160px] truncate">{g.descripcion}</TableCell>
                        <TableCell className="text-sm">{g.categoria}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{g.beneficiario ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium text-sm">{fmt(g.monto, g.moneda ?? selectedCaja.moneda)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {g.comprobanteNumero ?? '—'}
                          {g.comprobanteTipo && <span className="text-xs ml-1">({g.comprobanteTipo})</span>}
                        </TableCell>
                        {puedeCorregir && (
                          <TableCell>
                            <Button
                              variant="ghost" size="icon" className="size-7"
                              title="Corregir este gasto"
                              onClick={() => abrirEdicionGasto(g)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {gastosTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-sm text-muted-foreground">
                      Página {gastosPage} de {gastosTotalPages} · {gastosTotal} gasto(s)
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={gastosPage === 1} onClick={() => setGastosPage(gastosPage - 1)}>
                        Anterior
                      </Button>
                      <Button variant="outline" size="sm" disabled={gastosPage === gastosTotalPages} onClick={() => setGastosPage(gastosPage + 1)}>
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog Nuevo Ingreso — reposición de una caja ya abierta */}
      <Dialog open={showNuevoIngreso} onOpenChange={(v) => {
        setShowNuevoIngreso(v);
        if (!v) {
          setIngresoEditando(null);
          setIngresoForm({ descripcion: '', monto: '', fecha: new Date().toISOString().slice(0, 10), origen: '' });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {ingresoEditando ? 'Corregir ingreso' : 'Registrar Ingreso'} — {selectedCaja?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Descripción *</Label>
              <Input
                placeholder="Ej: DEPOSITADO PARA VIÁTICOS DE PERSONAL"
                value={ingresoForm.descripcion}
                onChange={e => setIngresoForm(f => ({ ...f, descripcion: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monto ({selectedCaja?.moneda === 'USD' ? '$' : 'S/'}) *</Label>
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={ingresoForm.monto}
                  onChange={e => setIngresoForm(f => ({ ...f, monto: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={ingresoForm.fecha}
                  onChange={e => setIngresoForm(f => ({ ...f, fecha: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Origen</Label>
              <Input
                placeholder="Ej: BBVA, CUENTA CORRIENTE"
                value={ingresoForm.origen}
                onChange={e => setIngresoForm(f => ({ ...f, origen: e.target.value }))}
                className="mt-1"
              />
            </div>
            {selectedCaja && (
              <p className="text-xs text-muted-foreground">
                Disponible ahora: {fmt(selectedCaja.montoDisponible, selectedCaja.moneda)} · quedará en{' '}
                {fmt(selectedCaja.montoDisponible + (parseFloat(ingresoForm.monto) || 0), selectedCaja.moneda)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevoIngreso(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button onClick={handleCrearIngreso} disabled={saving}>
              {saving ? 'Guardando…' : ingresoEditando ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nueva Caja */}
      <Dialog open={showNuevaCaja} onOpenChange={setShowNuevaCaja}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Caja Chica</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Moneda *</Label>
              <Select
                value={nuevaCajaForm.moneda}
                onValueChange={v => setNuevaCajaForm(f => ({ ...f, moneda: v as 'PEN' | 'USD', cajaOrigenId: '' }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PEN">Soles (PEN)</SelectItem>
                  <SelectItem value="USD">Dólares (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Viene de la caja</Label>
              <Select
                value={nuevaCajaForm.cajaOrigenId || 'ninguna'}
                onValueChange={v => setNuevaCajaForm(f => ({ ...f, cajaOrigenId: v === 'ninguna' ? '' : v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguna">Ninguna — empezar de cero</SelectItem>
                  {cajasQueCedenSaldo.map(c => (
                    <SelectItem key={c._dbId} value={c._dbId}>
                      {c.nombre}
                      {c.estado === 'cerrada' ? ' (cerrada)' : ''}
                      {' — '}
                      {Number(c.montoDisponible ?? 0) < 0 ? 'deuda ' : 'saldo '}
                      {fmt(c.montoDisponible, c.moneda)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {cajaOrigen
                  ? (saldoQueArrastra < 0
                      ? `La deuda de ${cajaOrigen.nombre} (${fmt(saldoQueArrastra, cajaOrigen.moneda)}) pasa como primer movimiento de la nueva.`
                      : `${cajaOrigen.estado === 'cerrada' ? 'El saldo de' : 'Se cerrará'} ${cajaOrigen.nombre} y su saldo pasa como primer movimiento de la nueva.`)
                  : 'Si eliges una, la caja nueva nace con su saldo —o con su deuda— y la anterior queda cerrada.'}
              </p>
            </div>

            <div>
              <Label>Depósito adicional ({nuevaCajaForm.moneda === 'USD' ? '$' : 'S/'})</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={nuevaCajaForm.montoAdicional}
                onChange={e => setNuevaCajaForm(f => ({ ...f, montoAdicional: e.target.value }))}
                className="mt-1"
              />
            </div>

            {/* Lo que va a quedar, para que nadie tenga que sumarlo de cabeza. */}
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              {cajaOrigen && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {saldoQueArrastra < 0 ? 'Deuda de ' : 'Saldo de '}{cajaOrigen.nombre}
                  </span>
                  <span className={`tabular-nums ${saldoQueArrastra < 0 ? 'text-red-600' : ''}`}>
                    {fmt(saldoQueArrastra, nuevaCajaForm.moneda)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Depósito adicional</span>
                <span className="tabular-nums">{fmt(parseFloat(nuevaCajaForm.montoAdicional) || 0, nuevaCajaForm.moneda)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Abre con</span>
                <span className={`tabular-nums ${aperturaTotal < 0 ? 'text-red-600' : ''}`}>
                  {fmt(aperturaTotal, nuevaCajaForm.moneda)}
                </span>
              </div>
              {aperturaTotal < 0 && (
                <p className="text-xs text-red-600 pt-1">
                  La caja nueva nace en descubierto: arrastra más deuda que depósito.
                </p>
              )}
            </div>

            <div>
              <Label>Responsable *</Label>
              <Input
                placeholder="Nombre del responsable"
                value={nuevaCajaForm.responsable}
                onChange={e => setNuevaCajaForm(f => ({ ...f, responsable: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Nombre</Label>
              <Input
                placeholder={`Se numera sola: CAJA N ${nuevaCajaForm.moneda === 'USD' ? 'DÓLARES' : 'SOLES'}`}
                value={nuevaCajaForm.nombre}
                onChange={e => setNuevaCajaForm(f => ({ ...f, nombre: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevaCaja(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button onClick={handleCrearCaja} disabled={saving || aperturaTotal <= 0}>
              {saving ? 'Abriendo…' : 'Abrir caja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nuevo Gasto */}
      <Dialog open={showNuevoGasto} onOpenChange={(v) => {
        setShowNuevoGasto(v);
        if (!v) {
          setGastoEditando(null);
          setGastoForm(defaultGastoForm);
          setGastoProyectoId(null);
          setGastoCentroCostoId(null);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {gastoEditando ? `Corregir ${gastoEditando.id}` : 'Registrar Gasto'} — {selectedCaja?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Descripción *</Label>
              <Input
                placeholder="Descripción del gasto..."
                value={gastoForm.descripcion}
                onChange={e => setGastoForm(f => ({ ...f, descripcion: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de documento *</Label>
                {/* Antes era texto libre: cada quien escribía "Factura",
                    "FACTURA" o "factura " y el dato se fragmentaba. Ahora sale
                    del catálogo `tipo_doc_caja`, editable en Administración. */}
                <div className="mt-1">
                  <SearchableSelect
                    value={gastoForm.categoria || null}
                    onChange={(v) => setGastoForm(f => ({ ...f, categoria: v ?? '' }))}
                    options={tiposDocCaja.map(t => ({ value: t.label, label: t.label }))}
                    placeholder="Seleccionar tipo de documento…"
                    searchPlaceholder="Buscar tipo…"
                    emptyText="Sin tipos configurados"
                  />
                </div>
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={gastoForm.fecha}
                  onChange={e => setGastoForm(f => ({ ...f, fecha: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Monto ({selectedCaja?.moneda === 'USD' ? '$' : 'S/'}) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={gastoForm.monto}
                onChange={e => setGastoForm(f => ({ ...f, monto: e.target.value }))}
                className="mt-1"
              />
              {/* El saldo, delante. No se puede gastar más de lo que hay en la
                  caja, y enterarse al pulsar Registrar es tarde. */}
              {selectedCaja && !gastoEditando && (
                <p className={`text-xs mt-1 ${excedeSaldo ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                  {excedeSaldo
                    ? `Supera el saldo (${fmt(selectedCaja.montoDisponible, selectedCaja.moneda)}): la caja quedará en descubierto. Se pedirá confirmación.`
                    : `Disponible en la caja: ${fmt(selectedCaja.montoDisponible, selectedCaja.moneda)}`}
                </p>
              )}
            </div>
            <div>
              <Label>Beneficiario</Label>
              <Input
                placeholder="Nombre del beneficiario o proveedor"
                value={gastoForm.beneficiario}
                onChange={e => setGastoForm(f => ({ ...f, beneficiario: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº Comprobante</Label>
                <Input
                  placeholder="Ej: B001-12345"
                  value={gastoForm.comprobanteNumero}
                  onChange={e => setGastoForm(f => ({ ...f, comprobanteNumero: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Tipo Comprobante</Label>
                <Select value={gastoForm.comprobanteTipo || '_none'} onValueChange={v => setGastoForm(f => ({ ...f, comprobanteTipo: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sin tipo</SelectItem>
                    <SelectItem value="boleta">Boleta</SelectItem>
                    <SelectItem value="factura">Factura</SelectItem>
                    <SelectItem value="recibo">Recibo</SelectItem>
                    <SelectItem value="sin_comprobante">Sin comprobante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Proyecto</Label>
                <ProyectoSelector
                  value={gastoProyectoId}
                  onChange={setGastoProyectoId}
                  nullable
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Centro de Costo *</Label>
                <CentroCostoSelector
                  value={gastoCentroCostoId}
                  onChange={setGastoCentroCostoId}
                  nullable
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={gastoForm.notas}
                onChange={e => setGastoForm(f => ({ ...f, notas: e.target.value }))}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevoGasto(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button onClick={handleCrearGasto} disabled={saving}>
              {saving ? 'Guardando…' : gastoEditando ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

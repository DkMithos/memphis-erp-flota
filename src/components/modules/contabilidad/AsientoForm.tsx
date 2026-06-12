/**
 * Memphis ERP — Asiento Contable Form
 * T-account editor: líneas debe/haber, validación de balance, selección de cuenta PCGE.
 */
import { useState, useMemo, useCallback } from 'react';
import { BookOpen, Plus, Trash2, AlertTriangle, CheckCircle2, ArrowLeft, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { usePeriodosStore } from '../../../lib/contabilidad/periodos-store';
import { usePlanCuentas } from '../../../lib/contabilidad/plan-cuentas-store';
import { useAsientosStore, type LineaAsientoInput, type TipoAsiento } from '../../../lib/contabilidad/asientos-store';

interface Props {
  onNavigate: (route: string) => void;
  editNumero?: string; // future edit mode
}

interface LineaUI {
  _key: string;
  cuentaId: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  debe: string;
  haber: string;
  glosa: string;
}

function newLinea(): LineaUI {
  return { _key: Math.random().toString(36).slice(2), cuentaId: '', cuentaCodigo: '', cuentaNombre: '', debe: '', haber: '', glosa: '' };
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function AsientoForm({ onNavigate }: Props) {
  const { periodos, periodoActual } = usePeriodosStore();
  const { cuentasHoja, buscar } = usePlanCuentas();
  const { crearAsiento } = useAsientosStore();

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [glosa, setGlosa] = useState('');
  const [tipo, setTipo] = useState<TipoAsiento>('manual');
  const [periodoId, setPeriodoId] = useState(periodoActual?.id ?? '');
  const [moneda, setMoneda] = useState('PEN');
  const [lineas, setLineas] = useState<LineaUI[]>([newLinea(), newLinea()]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selector de cuenta
  const [cuentaModal, setCuentaModal] = useState<string | null>(null); // _key de la línea
  const [cuentaQuery, setCuentaQuery] = useState('');
  const cuentasFiltradas = useMemo(() => {
    const lista = cuentaQuery ? buscar(cuentaQuery) : cuentasHoja.slice(0, 80);
    return lista.filter(c => c.aceptaMovimientos && c.activo).slice(0, 100);
  }, [cuentaQuery, cuentasHoja, buscar]);

  // Totals
  const totalDebe  = lineas.reduce((s, l) => s + (parseFloat(l.debe)  || 0), 0);
  const totalHaber = lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0);
  const diff = Math.abs(totalDebe - totalHaber);
  const balanceado = diff < 0.01;

  function updateLinea(key: string, field: keyof LineaUI, value: string) {
    setLineas(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l));
  }

  function addLinea() {
    setLineas(prev => [...prev, newLinea()]);
  }

  function removeLinea(key: string) {
    if (lineas.length <= 2) return;
    setLineas(prev => prev.filter(l => l._key !== key));
  }

  function selectCuenta(cuentaId: string, codigo: string, nombre: string) {
    if (!cuentaModal) return;
    setLineas(prev => prev.map(l => l._key === cuentaModal
      ? { ...l, cuentaId, cuentaCodigo: codigo, cuentaNombre: nombre } : l));
    setCuentaModal(null);
    setCuentaQuery('');
  }

  async function handleGuardar() {
    setError(null);
    if (!periodoId) { setError('Selecciona un período contable.'); return; }
    if (!glosa.trim()) { setError('La glosa es requerida.'); return; }
    if (!balanceado) { setError(`Asiento desbalanceado: Debe ${fmt(totalDebe)} / Haber ${fmt(totalHaber)}`); return; }
    const lineasValidas = lineas.filter(l => l.cuentaId && (parseFloat(l.debe) > 0 || parseFloat(l.haber) > 0));
    if (lineasValidas.length < 2) { setError('Se requieren al menos 2 líneas con cuenta y monto.'); return; }

    const input: LineaAsientoInput[] = lineasValidas.map(l => ({
      cuentaId: l.cuentaId,
      cuentaCodigo: l.cuentaCodigo,
      cuentaNombre: l.cuentaNombre,
      debe: parseFloat(l.debe) || 0,
      haber: parseFloat(l.haber) || 0,
      glosa: l.glosa || undefined,
    }));

    setGuardando(true);
    try {
      const asiento = await crearAsiento({ periodoId, fecha, glosa: glosa.trim(), tipo, moneda, lineas: input });
      onNavigate(`/contabilidad/asientos/${asiento.numero}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => onNavigate('/contabilidad/asientos')} className="gap-1">
          <ArrowLeft className="size-3.5" /> Asientos
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="size-5 text-primary" /> Nuevo Asiento Contable
        </h1>
      </div>

      {/* Cabecera */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Datos del Asiento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Período *</Label>
              <Select value={periodoId} onValueChange={setPeriodoId}>
                <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {periodos.filter(p => p.estado === 'abierto').map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha *</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="text-sm h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={v => setTipo(v as TipoAsiento)}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                  <SelectItem value="apertura">Apertura</SelectItem>
                  <SelectItem value="cierre">Cierre</SelectItem>
                  <SelectItem value="diferencia_cambio">Dif. Cambio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Moneda</Label>
              <Select value={moneda} onValueChange={setMoneda}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PEN">PEN — Soles</SelectItem>
                  <SelectItem value="USD">USD — Dólares</SelectItem>
                  <SelectItem value="EUR">EUR — Euros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <Label className="text-xs">Glosa *</Label>
            <Input value={glosa} onChange={e => setGlosa(e.target.value)}
              placeholder="Descripción del asiento contable" className="text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Líneas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Líneas del Asiento</CardTitle>
            <Button variant="outline" size="sm" onClick={addLinea} className="gap-1 h-7 text-xs">
              <Plus className="size-3" /> Agregar línea
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Header */}
          <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
            <div className="col-span-4">Cuenta</div>
            <div className="col-span-3">Glosa línea</div>
            <div className="col-span-2 text-right">Debe</div>
            <div className="col-span-2 text-right">Haber</div>
            <div className="col-span-1" />
          </div>
          {lineas.map((linea, idx) => (
            <div key={linea._key} className="grid grid-cols-12 gap-1 px-4 py-2 border-b border-border/50 items-center">
              {/* Cuenta selector */}
              <div className="col-span-4">
                {linea.cuentaCodigo ? (
                  <button onClick={() => { setCuentaModal(linea._key); setCuentaQuery(''); }}
                    className="w-full text-left px-2 py-1.5 text-xs rounded border border-border hover:border-primary/50 bg-background">
                    <span className="font-mono text-muted-foreground mr-1.5">{linea.cuentaCodigo}</span>
                    <span className="font-medium truncate">{linea.cuentaNombre}</span>
                  </button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => { setCuentaModal(linea._key); setCuentaQuery(''); }}
                    className="w-full h-8 text-xs justify-start text-muted-foreground gap-1">
                    <Search className="size-3" /> Buscar cuenta…
                  </Button>
                )}
              </div>
              {/* Glosa línea */}
              <div className="col-span-3">
                <Input value={linea.glosa} onChange={e => updateLinea(linea._key, 'glosa', e.target.value)}
                  placeholder="Referencia…" className="h-8 text-xs" />
              </div>
              {/* Debe */}
              <div className="col-span-2">
                <Input value={linea.debe} onChange={e => { updateLinea(linea._key, 'debe', e.target.value); if (e.target.value) updateLinea(linea._key, 'haber', ''); }}
                  placeholder="0.00" className="h-8 text-xs text-right font-mono" type="number" min="0" step="0.01" />
              </div>
              {/* Haber */}
              <div className="col-span-2">
                <Input value={linea.haber} onChange={e => { updateLinea(linea._key, 'haber', e.target.value); if (e.target.value) updateLinea(linea._key, 'debe', ''); }}
                  placeholder="0.00" className="h-8 text-xs text-right font-mono" type="number" min="0" step="0.01" />
              </div>
              {/* Delete */}
              <div className="col-span-1 flex justify-center">
                <button onClick={() => removeLinea(linea._key)} disabled={lineas.length <= 2}
                  className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 disabled:opacity-30">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Totales */}
          <div className="grid grid-cols-12 gap-1 px-4 py-3 bg-muted/30">
            <div className="col-span-7 flex items-center gap-2">
              {balanceado ? (
                <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                  <CheckCircle2 className="size-3.5" /> Asiento balanceado
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                  <AlertTriangle className="size-3.5" /> Diferencia: {fmt(diff)}
                </span>
              )}
            </div>
            <div className="col-span-2 text-right font-mono text-sm font-bold">{fmt(totalDebe)}</div>
            <div className="col-span-2 text-right font-mono text-sm font-bold">{fmt(totalHaber)}</div>
            <div className="col-span-1" />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => onNavigate('/contabilidad/asientos')} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
        <Button onClick={handleGuardar} disabled={guardando || !balanceado} className="gap-2">
          <BookOpen className="size-4" />{guardando ? 'Guardando…' : 'Guardar Asiento'}
        </Button>
      </div>

      {/* Modal selección de cuenta */}
      <Dialog open={!!cuentaModal} onOpenChange={open => { if (!open) { setCuentaModal(null); setCuentaQuery(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Seleccionar Cuenta Contable</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-[55%] size-4 text-muted-foreground" />
            <Input value={cuentaQuery} onChange={e => setCuentaQuery(e.target.value)}
              placeholder="Código o nombre de cuenta…" className="pl-9 text-sm" autoFocus />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-0.5 mt-1">
            {cuentasFiltradas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados</p>
            ) : cuentasFiltradas.map(c => (
              <button key={c.id} onClick={() => selectCuenta(c.id, c.codigo, c.nombre)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-muted/60 text-left text-sm">
                <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{c.codigo}</span>
                <span className="flex-1 truncate">{c.nombre}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

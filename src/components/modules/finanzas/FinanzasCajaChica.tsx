import { useState, useMemo } from 'react';
import { Plus, Wallet, Check, X, AlertCircle, Download, FileText } from 'lucide-react';
import { PageNav } from '@/components/shared/PageNav';
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
import { useAuth } from '@/auth/AuthProvider';
import { useProyectos } from '@/lib/proyectos/proyectos-store';
import { exportToExcel, exportToPDF, exportCajaModeloExcel, type MovimientoCajaModelo } from '@/lib/shared/export-utils';
import { supabase } from '@/lib/supabase/client';

interface Props {
  onNavigate: (route: string) => void;
}

function fmt(n: number, moneda: string = 'PEN') {
  const sym = moneda === 'USD' ? '$' : 'S/';
  return `${sym} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

const ESTADO_CAJA_COLORS = {
  activo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  en_reposicion: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  cerrada: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
};

const ESTADO_GASTO_COLORS = {
  pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  aprobado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rechazado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

interface NuevaCajaForm {
  nombre: string;
  responsable: string;
  montoAsignado: string;
  moneda: 'PEN' | 'USD';
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
  const { cajasChicas, gastos, addCajaChica, addGasto, updateGasto, updateCajaChica, loading } = useFinanzas();
  const { tenantId, user } = useAuth();
  const { proyectos } = useProyectos();

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
      exportCajaModeloExcel(
        { nombre: caja.nombre, codigo: caja.id, responsable: caja.responsable, moneda: caja.moneda },
        movs,
      );
    } catch (e) {
      toast.error('No se pudo exportar la caja: ' + (e instanceof Error ? e.message : 'error'));
    }
  };

  const exportarGastosProyecto = (formato: 'excel' | 'pdf') => {
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
  const [showNuevoGasto, setShowNuevoGasto] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nuevaCajaForm, setNuevaCajaForm] = useState<NuevaCajaForm>({
    nombre: '',
    responsable: '',
    montoAsignado: '',
    moneda: 'PEN',
  });

  const [gastoForm, setGastoForm] = useState<NuevoGastoForm>(defaultGastoForm);
  const [gastoProyectoId, setGastoProyectoId] = useState<string | null>(null);
  const [gastoCentroCostoId, setGastoCentroCostoId] = useState<string | null>(null);

  const selectedCaja = cajasChicas.find(c => c._dbId === selectedCajaId) ?? null;

  const cajasFiltradas = useMemo(() => {
    const q = cajaSearch.trim().toLowerCase();
    return cajasChicas.filter(c =>
      (cajaMoneda === 'todos' || c.moneda === cajaMoneda) &&
      (cajaEstado === 'todos' || c.estado === cajaEstado) &&
      (!q ||
        c.nombre.toLowerCase().includes(q) ||
        (c.id ?? '').toLowerCase().includes(q) ||
        (c.responsable ?? '').toLowerCase().includes(q))
    );
  }, [cajasChicas, cajaSearch, cajaMoneda, cajaEstado]);

  const gastosDeCaja = useMemo(() =>
    gastos.filter(g => g.cajaDbId === selectedCajaId),
    [gastos, selectedCajaId]
  );

  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const anioActual = hoy.getFullYear();

  const kpisGastos = useMemo(() => {
    const mes = gastosDeCaja.filter(g => {
      const d = new Date(g.fecha);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual && g.estado !== 'rechazado';
    });
    const total = mes.reduce((s, g) => s + g.monto, 0);
    const pendientes = gastosDeCaja.filter(g => g.estado === 'pendiente').length;
    return { total, pendientes };
  }, [gastosDeCaja, mesActual, anioActual]);

  const handleCrearCaja = async () => {
    if (!tenantId) return;
    if (!nuevaCajaForm.nombre.trim() || !nuevaCajaForm.responsable.trim() || !nuevaCajaForm.montoAsignado) {
      toast.error('Todos los campos son obligatorios');
      return;
    }
    const monto = parseFloat(nuevaCajaForm.montoAsignado);
    if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return; }

    setSaving(true);
    try {
      const seq = String(cajasChicas.length + 1).padStart(3, '0');
      await addCajaChica({
        tenant_id: tenantId,
        nombre: nuevaCajaForm.nombre,
        codigo: `CC-${seq}`,
        responsable: nuevaCajaForm.responsable,
        monto_asignado: monto,
        monto_disponible: monto,
        moneda: nuevaCajaForm.moneda,
        estado: 'activo',
      });
      toast.success('Caja chica creada');
      setShowNuevaCaja(false);
      setNuevaCajaForm({ nombre: '', responsable: '', montoAsignado: '', moneda: 'PEN' });
    } catch { toast.error('Error al crear caja'); }
    finally { setSaving(false); }
  };

  const handleCrearGasto = async () => {
    if (!tenantId || !selectedCajaId || !selectedCaja) return;
    if (!gastoForm.descripcion.trim() || !gastoForm.categoria.trim() || !gastoForm.monto || !gastoForm.fecha) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    const monto = parseFloat(gastoForm.monto);
    if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return; }

    setSaving(true);
    try {
      const now = new Date();
      const seq = String(gastos.filter(g => g.cajaDbId === selectedCajaId).length + 1).padStart(3, '0');
      const numero = `GCC-${now.getFullYear()}-${seq}`;

      await addGasto({
        tenant_id: tenantId,
        caja_id: selectedCajaId,
        numero,
        descripcion: gastoForm.descripcion,
        categoria: gastoForm.categoria,
        monto,
        moneda: 'PEN',
        fecha: gastoForm.fecha,
        beneficiario: gastoForm.beneficiario || null,
        comprobante_numero: gastoForm.comprobanteNumero || null,
        comprobante_tipo: (gastoForm.comprobanteTipo as GastoCajaChica['comprobanteTipo']) || null,
        estado: 'pendiente',
        aprobado_por: null,
        notas: gastoForm.notas || null,
        realizado_por: user?.email ?? null,
      });
      toast.success('Gasto registrado');
      setShowNuevoGasto(false);
      setGastoForm(defaultGastoForm);
    } catch { toast.error('Error al registrar gasto'); }
    finally { setSaving(false); }
  };

  const handleAprobarGasto = async (g: GastoCajaChica) => {
    try {
      await updateGasto(g._dbId, {
        estado: 'aprobado',
        aprobado_por: user?.email ?? 'Sistema',
      });
      toast.success('Gasto aprobado');
    } catch { toast.error('Error al aprobar'); }
  };

  const handleRechazarGasto = async (g: GastoCajaChica) => {
    try {
      await updateGasto(g._dbId, { estado: 'rechazado' });
      toast.success('Gasto rechazado');
    } catch { toast.error('Error al rechazar'); }
  };

  return (
    <div className="space-y-6">
      <PageNav />

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
        <Button onClick={() => setShowNuevaCaja(true)}>
          <Plus className="size-4" />
          Nueva Caja Chica
        </Button>
      </div>

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
            <Select value={selectedCajaId ?? ''} onValueChange={(v) => setSelectedCajaId(v)}>
              <SelectTrigger className="sm:w-56"><SelectValue placeholder="Ir directo a una caja…" /></SelectTrigger>
              <SelectContent>
                {cajasFiltradas.map(c => (
                  <SelectItem key={c._dbId} value={c._dbId}>{c.nombre} · {c.moneda}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                      <TableCell className={`text-right text-sm font-medium whitespace-nowrap ${c.porcentajeUsado > 80 ? 'text-red-500' : 'text-green-600'}`}>
                        {fmt(c.montoDisponible, c.moneda)}
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
                <span>Total mes: <strong className="text-foreground">{fmt(kpisGastos.total)}</strong></span>
                {kpisGastos.pendientes > 0 && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <AlertCircle className="size-3.5" />
                    {kpisGastos.pendientes} pendiente(s)
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportarModeloCaja(selectedCaja)}>
                <Download className="size-4" />
                Exportar modelo
              </Button>
              {selectedCaja.estado === 'cerrada' ? (
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
              )}
              {selectedCaja.estado !== 'cerrada' && (
                <Button size="sm" onClick={() => setShowNuevoGasto(true)}>
                  <Plus className="size-4" />
                  Registrar Gasto
                </Button>
              )}
            </div>
          </CardHeader>
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
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gastosDeCaja.map(g => (
                      <TableRow key={g._dbId}>
                        <TableCell className="font-mono text-xs">{g.id}</TableCell>
                        <TableCell className="text-sm">{g.fecha}</TableCell>
                        <TableCell className="text-sm max-w-[160px] truncate">{g.descripcion}</TableCell>
                        <TableCell className="text-sm">{g.categoria}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{g.beneficiario ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium text-sm">{fmt(g.monto)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {g.comprobanteNumero ?? '—'}
                          {g.comprobanteTipo && <span className="text-xs ml-1">({g.comprobanteTipo})</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${ESTADO_GASTO_COLORS[g.estado] ?? ''}`}>
                            {g.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {g.estado === 'pendiente' && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-green-600 hover:text-green-700"
                                title="Aprobar"
                                onClick={() => handleAprobarGasto(g)}
                              >
                                <Check className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-red-500 hover:text-red-600"
                                title="Rechazar"
                                onClick={() => handleRechazarGasto(g)}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog Nueva Caja */}
      <Dialog open={showNuevaCaja} onOpenChange={setShowNuevaCaja}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Caja Chica</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Nombre *</Label>
              <Input
                placeholder="Ej: Caja Chica Administración"
                value={nuevaCajaForm.nombre}
                onChange={e => setNuevaCajaForm(f => ({ ...f, nombre: e.target.value }))}
                className="mt-1"
              />
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
              <Label>Moneda *</Label>
              <Select
                value={nuevaCajaForm.moneda}
                onValueChange={v => setNuevaCajaForm(f => ({ ...f, moneda: v as 'PEN' | 'USD' }))}
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
              <Label>Monto Asignado ({nuevaCajaForm.moneda === 'USD' ? '$' : 'S/'}) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={nuevaCajaForm.montoAsignado}
                onChange={e => setNuevaCajaForm(f => ({ ...f, montoAsignado: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevaCaja(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Cancelar</Button>
            <Button onClick={handleCrearCaja} disabled={saving}>{saving ? 'Creando...' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nuevo Gasto */}
      <Dialog open={showNuevoGasto} onOpenChange={setShowNuevoGasto}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Gasto — {selectedCaja?.nombre}</DialogTitle>
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
                <Label>Categoría *</Label>
                <Input
                  placeholder="Ej: Limpieza, Útiles..."
                  value={gastoForm.categoria}
                  onChange={e => setGastoForm(f => ({ ...f, categoria: e.target.value }))}
                  className="mt-1"
                />
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
              <Label>Monto (S/) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={gastoForm.monto}
                onChange={e => setGastoForm(f => ({ ...f, monto: e.target.value }))}
                className="mt-1"
              />
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
                <Label>Centro de Costo</Label>
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
            <Button onClick={handleCrearGasto} disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

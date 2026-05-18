/**
 * Memphis ERP — Comprobante de Pago Form
 * Facturas/boletas recibidas y emitidas con líneas detalle y cálculo automático IGV.
 */
import { useState, useMemo, useCallback } from 'react';
import { Receipt, Plus, Trash2, ArrowLeft, AlertTriangle, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import { useComprobantesStore, type NuevoComprobanteInput, type DetalleInput, type DireccionComprobante } from '../../../lib/contabilidad/comprobantes-store';
import { TIPO_AFECTACION_IGV_LABELS, TASAS_DETRACCION } from '../../../lib/contabilidad/fiscal-peru';

interface Props { onNavigate: (route: string) => void; }

const TIPOS_COMPROBANTE = [
  { code: '01', label: 'Factura' },
  { code: '03', label: 'Boleta de Venta' },
  { code: '07', label: 'Nota de Crédito' },
  { code: '08', label: 'Nota de Débito' },
  { code: '09', label: 'Guía de Remisión' },
  { code: '31', label: 'Liquidación de Compra' },
  { code: '50', label: 'Declaración Única de Aduanas' },
];

interface LineaUI {
  _key: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  precioUnitario: string;
  descuento: string;
  tipoAfectacionIgv: string;
}

function newLinea(): LineaUI {
  return { _key: Math.random().toString(36).slice(2), descripcion: '', unidad: 'NIU', cantidad: '1', precioUnitario: '', descuento: '0', tipoAfectacionIgv: '10' };
}

const IGV_TASA = 0.18;

function calcLinea(l: LineaUI) {
  const cant = parseFloat(l.cantidad) || 0;
  const pu   = parseFloat(l.precioUnitario) || 0;
  const desc = parseFloat(l.descuento) || 0;
  const valorVenta = cant * pu - desc;
  const igv = l.tipoAfectacionIgv === '10' ? Math.round(valorVenta * IGV_TASA * 100) / 100 : 0;
  return { valorVenta: Math.max(0, valorVenta), igv, total: Math.max(0, valorVenta) + igv };
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(n);
}

export function ComprobantePagoForm({ onNavigate }: Props) {
  const { crearComprobante } = useComprobantesStore();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tipo, setTipo] = useState('01');
  const [serie, setSerie] = useState('');
  const [numero, setNumero] = useState('');
  const [direccion, setDireccion] = useState<DireccionComprobante>('recibido');
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [rucEmisor, setRucEmisor] = useState('');
  const [razonSocialEmisor, setRazonSocialEmisor] = useState('');
  const [rucReceptor, setRucReceptor] = useState('');
  const [razonSocialReceptor, setRazonSocialReceptor] = useState('');
  const [moneda, setMoneda] = useState('PEN');
  const [tipoCambio, setTipoCambio] = useState('1');
  const [tieneDetraccion, setTieneDetraccion] = useState(false);
  const [detraccionCodigo, setDetraccionCodigo] = useState('');
  const [detraccionTasa, setDetraccionTasa] = useState('');
  const [tieneRetencion, setTieneRetencion] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<LineaUI[]>([newLinea()]);

  const totales = useMemo(() => {
    let opGravada = 0, opExonerada = 0, opInafecta = 0, totalIgv = 0;
    lineas.forEach(l => {
      const { valorVenta, igv } = calcLinea(l);
      if (l.tipoAfectacionIgv === '10') opGravada += valorVenta;
      else if (l.tipoAfectacionIgv === '20') opExonerada += valorVenta;
      else if (l.tipoAfectacionIgv === '30') opInafecta += valorVenta;
      totalIgv += igv;
    });
    const subtotal = opGravada + opExonerada + opInafecta;
    const total = subtotal + totalIgv;
    const montoDetraccion = tieneDetraccion && detraccionTasa
      ? Math.round(total * parseFloat(detraccionTasa) * 100) / 100 : 0;
    return { opGravada, opExonerada, opInafecta, totalIgv, subtotal, total, montoDetraccion };
  }, [lineas, tieneDetraccion, detraccionTasa]);

  function updateLinea(key: string, field: keyof LineaUI, value: string) {
    setLineas(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l));
  }

  async function handleGuardar() {
    setError(null);
    if (!tipo || !serie || !numero) { setError('Tipo, serie y número son requeridos.'); return; }
    if (lineas.filter(l => l.descripcion && (parseFloat(l.precioUnitario) > 0)).length === 0) {
      setError('Agrega al menos una línea con descripción y precio.'); return;
    }

    const detallesInput: DetalleInput[] = lineas
      .filter(l => l.descripcion && parseFloat(l.precioUnitario) > 0)
      .map(l => ({
        descripcion: l.descripcion,
        unidad: l.unidad,
        cantidad: parseFloat(l.cantidad) || 1,
        precioUnitario: parseFloat(l.precioUnitario) || 0,
        descuento: parseFloat(l.descuento) || 0,
        tipoAfectacionIgv: l.tipoAfectacionIgv,
      }));

    const input: NuevoComprobanteInput = {
      tipo, serie, numero, direccion, fechaEmision,
      fechaVencimiento: fechaVencimiento || undefined,
      rucEmisor: rucEmisor || undefined,
      razonSocialEmisor: razonSocialEmisor || undefined,
      rucReceptor: rucReceptor || undefined,
      razonSocialReceptor: razonSocialReceptor || undefined,
      moneda, tipoCambio: parseFloat(tipoCambio) || 1,
      tieneDetraccion,
      detraccionCodigo: tieneDetraccion ? detraccionCodigo : undefined,
      detraccionTasa: tieneDetraccion && detraccionTasa ? parseFloat(detraccionTasa) : undefined,
      tieneRetencion,
      retencionTasa: tieneRetencion ? 0.03 : undefined,
      observaciones: observaciones || undefined,
      detalles: detallesInput,
    };

    setGuardando(true);
    try {
      const comp = await crearComprobante(input);
      onNavigate('/contabilidad/comprobantes');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  const tasaDetraccionSeleccionada = TASAS_DETRACCION.find(t => t.codigo === detraccionCodigo);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => onNavigate('/contabilidad/comprobantes')} className="gap-1">
          <ArrowLeft className="size-3.5" /> Comprobantes
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Receipt className="size-5 text-primary" /> Nuevo Comprobante de Pago
        </h1>
      </div>

      {/* Datos principales */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Datos del Comprobante</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dirección</Label>
              <Select value={direccion} onValueChange={v => setDireccion(v as DireccionComprobante)}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recibido">Recibido (Compra)</SelectItem>
                  <SelectItem value="emitido">Emitido (Venta)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_COMPROBANTE.map(t => <SelectItem key={t.code} value={t.code}>{t.code} — {t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Serie *</Label>
              <Input value={serie} onChange={e => setSerie(e.target.value.toUpperCase())}
                placeholder="F001" className="text-sm h-9 font-mono uppercase" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Número *</Label>
              <Input value={numero} onChange={e => setNumero(e.target.value)}
                placeholder="00000001" className="text-sm h-9 font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha Emisión *</Label>
              <Input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} className="text-sm h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha Vencimiento</Label>
              <Input type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} className="text-sm h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Moneda</Label>
              <Select value={moneda} onValueChange={setMoneda}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PEN">PEN — Soles</SelectItem>
                  <SelectItem value="USD">USD — Dólares</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proveedor/Cliente */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">{direccion === 'recibido' ? 'Proveedor (Emisor)' : 'Cliente (Receptor)'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">RUC {direccion === 'recibido' ? 'Emisor' : 'Receptor'}</Label>
              <Input value={direccion === 'recibido' ? rucEmisor : rucReceptor}
                onChange={e => direccion === 'recibido' ? setRucEmisor(e.target.value) : setRucReceptor(e.target.value)}
                placeholder="20XXXXXXXXX" className="text-sm h-9 font-mono" maxLength={11} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Razón Social</Label>
              <Input value={direccion === 'recibido' ? razonSocialEmisor : razonSocialReceptor}
                onChange={e => direccion === 'recibido' ? setRazonSocialEmisor(e.target.value) : setRazonSocialReceptor(e.target.value)}
                placeholder="Nombre o razón social" className="text-sm h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Líneas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Detalle del Comprobante</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setLineas(p=>[...p,newLinea()])} className="gap-1 h-7 text-xs">
              <Plus className="size-3" /> Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:grid grid-cols-12 gap-1 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
            <div className="col-span-3">Descripción</div>
            <div className="col-span-1">Unidad</div>
            <div className="col-span-1 text-right">Cant.</div>
            <div className="col-span-2 text-right">P. Unitario</div>
            <div className="col-span-1 text-right">Desc.</div>
            <div className="col-span-2">Afect. IGV</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-1" />
          </div>
          {lineas.map(l => {
            const { total } = calcLinea(l);
            return (
              <div key={l._key} className="grid grid-cols-12 gap-1 px-4 py-2 border-b border-border/40 items-center">
                <div className="col-span-12 md:col-span-3">
                  <Input value={l.descripcion} onChange={e => updateLinea(l._key, 'descripcion', e.target.value)}
                    placeholder="Descripción del servicio/bien" className="h-8 text-xs" />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <Input value={l.unidad} onChange={e => updateLinea(l._key, 'unidad', e.target.value)}
                    className="h-8 text-xs text-center" />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <Input value={l.cantidad} onChange={e => updateLinea(l._key, 'cantidad', e.target.value)}
                    className="h-8 text-xs text-right font-mono" type="number" min="0" step="0.001" />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Input value={l.precioUnitario} onChange={e => updateLinea(l._key, 'precioUnitario', e.target.value)}
                    placeholder="0.00" className="h-8 text-xs text-right font-mono" type="number" min="0" step="0.01" />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <Input value={l.descuento} onChange={e => updateLinea(l._key, 'descuento', e.target.value)}
                    className="h-8 text-xs text-right font-mono" type="number" min="0" step="0.01" />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <Select value={l.tipoAfectacionIgv} onValueChange={v => updateLinea(l._key, 'tipoAfectacionIgv', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_AFECTACION_IGV_LABELS).slice(0, 6).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{k} — {v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 md:col-span-1 text-right font-mono text-xs font-medium">
                  {fmt(total)}
                </div>
                <div className="col-span-2 md:col-span-1 flex justify-center">
                  <button onClick={() => lineas.length > 1 && setLineas(p => p.filter(x => x._key !== l._key))}
                    disabled={lineas.length <= 1}
                    className="size-6 flex items-center justify-center text-muted-foreground hover:text-red-500 disabled:opacity-30">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Totales */}
          <div className="px-4 py-3 space-y-1 bg-muted/20">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Op. Gravadas</span><span className="font-mono">{fmt(totales.opGravada)}</span>
            </div>
            {totales.opExonerada > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Op. Exoneradas</span><span className="font-mono">{fmt(totales.opExonerada)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>IGV (18%)</span><span className="font-mono">{fmt(totales.totalIgv)}</span>
            </div>
            {tieneDetraccion && totales.montoDetraccion > 0 && (
              <div className="flex justify-between text-xs text-amber-600">
                <span>Detracción ({detraccionTasa ? (parseFloat(detraccionTasa)*100).toFixed(0) : ''}%)</span>
                <span className="font-mono">-{fmt(totales.montoDetraccion)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-border pt-1 mt-1">
              <span>TOTAL</span><span className="font-mono">{fmt(totales.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detracción / Retención */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Tributos Adicionales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={tieneDetraccion} onCheckedChange={setTieneDetraccion} />
            <Label className="text-sm">Sujeto a Detracción (SPOT)</Label>
          </div>
          {tieneDetraccion && (
            <div className="grid grid-cols-2 gap-3 ml-7">
              <div className="space-y-1">
                <Label className="text-xs">Servicio/Bien SPOT</Label>
                <Select value={detraccionCodigo} onValueChange={v => {
                  setDetraccionCodigo(v);
                  const tasa = TASAS_DETRACCION.find(t => t.codigo === v);
                  if (tasa) setDetraccionTasa(String(tasa.tasa));
                }}>
                  <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger>
                  <SelectContent>
                    {TASAS_DETRACCION.map(t => (
                      <SelectItem key={t.codigo} value={t.codigo}>{t.codigo} — {t.descripcion} ({(t.tasa*100).toFixed(0)}%)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tasa (%)</Label>
                <Input value={detraccionTasa} onChange={e => setDetraccionTasa(e.target.value)}
                  className="text-sm h-9 font-mono" readOnly={!!tasaDetraccionSeleccionada} />
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Switch checked={tieneRetencion} onCheckedChange={setTieneRetencion} />
            <Label className="text-sm">Sujeto a Retención (3%)</Label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observaciones</Label>
            <Input value={observaciones} onChange={e => setObservaciones(e.target.value)}
              placeholder="Observaciones adicionales" className="text-sm" />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => onNavigate('/contabilidad/comprobantes')}>Cancelar</Button>
        <Button onClick={handleGuardar} disabled={guardando} className="gap-2">
          <Receipt className="size-4" />{guardando ? 'Guardando…' : 'Registrar Comprobante'}
        </Button>
      </div>
    </div>
  );
}

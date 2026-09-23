/**
 * Crear / editar un compromiso del flujo financiero DENTRO del ERP.
 *
 * Lo nativo se guarda con fuente='erp' y sobrevive a las reimportaciones del
 * Excel (que solo pisan fuente='excel'). El monto se guarda SIEMPRE positivo y
 * el tipo va en `sentido` (pagar = egreso, cobrar = ingreso como la CIPRL):
 * nunca se codifica por signo. La RLS asegura que cada quien solo escriba en
 * su área.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';

export interface CompromisoEdit {
  id?: string;
  area: string;
  cdc: string | null;
  categoria: string | null;
  concepto: string | null;
  proveedor: string | null;
  moneda: string | null;
  tc: number | null;
  mesVencimiento: string | null;   // 'YYYY-MM-01'
  monto: number;                    // siempre positivo
  sentido: 'pagar' | 'cobrar';
  origen?: string | null;           // real | comprometido | proyectado
  pagado: number;
  estado: string | null;
  postergado: number | null;
  observaciones?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inicial: CompromisoEdit | null;    // null = nuevo
  areas: string[];                   // áreas donde el usuario puede escribir
  etiquetaArea: (a: string) => string;
  tenantId: string | null;
  userId: string | null;
  centros: { id: string; codigo: string; nombre: string }[];
  onGuardado: () => void;
}

const ESTADOS = ['PENDIENTE', 'PAGADO', 'VENCIDO', 'SALDO A FAVOR'];

const mesInput = (iso: string | null) => (iso ? iso.slice(0, 7) : '');   // 'YYYY-MM'

export function CompromisoFlujoDialog({
  open, onOpenChange, inicial, areas, etiquetaArea, tenantId, userId, centros, onGuardado,
}: Props) {
  const editando = !!inicial?.id;
  const [area, setArea] = useState('');
  const [cdc, setCdc] = useState('');
  const [categoria, setCategoria] = useState('');
  const [concepto, setConcepto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [tipo, setTipo] = useState<'egreso' | 'ingreso'>('egreso');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [tc, setTc] = useState('');
  const [mes, setMes] = useState('');
  const [estado, setEstado] = useState('PENDIENTE');
  const [pagado, setPagado] = useState('');
  const [postergado, setPostergado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    const i = inicial;
    setArea(i?.area ?? areas[0] ?? '');
    setCdc(i?.cdc ?? '');
    setCategoria(i?.categoria ?? '');
    setConcepto(i?.concepto ?? '');
    setProveedor(i?.proveedor ?? '');
    setTipo(i?.sentido === 'cobrar' ? 'ingreso' : 'egreso');
    setMonto(i ? String(Math.abs(i.monto)) : '');
    setMoneda((i?.moneda as 'PEN' | 'USD') ?? 'PEN');
    setTc(i?.tc != null ? String(i.tc) : '');
    setMes(mesInput(i?.mesVencimiento ?? null));
    setEstado(i?.estado || 'PENDIENTE');
    setPagado(i?.pagado ? String(i.pagado) : '');
    setPostergado(i?.postergado != null ? String(i.postergado) : '');
    setObservaciones(i?.observaciones ?? '');
  }, [open, inicial, areas]);

  const guardar = async () => {
    if (!area) { toast.error('Elige el área'); return; }
    if (!concepto.trim()) { toast.error('El concepto es obligatorio'); return; }
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum === 0) { toast.error('Indica un monto válido'); return; }
    setGuardando(true);
    const centro = centros.find(c => c.codigo.toLowerCase() === cdc.trim().toLowerCase());
    const payload: Record<string, unknown> = {
      area,
      cdc: cdc.trim() || null,
      centro_costo_id: centro?.id ?? null,
      categoria: categoria.trim() || null,
      concepto: concepto.trim(),
      proveedor: proveedor.trim() || null,
      moneda,
      tc: moneda === 'USD' && tc ? Number(tc) : null,
      mes_vencimiento: mes ? `${mes}-01` : null,
      fecha_vencimiento: mes ? `${mes}-01` : null,
      monto_presupuestado: Math.round(Math.abs(montoNum) * 100) / 100,
      sentido: tipo === 'ingreso' ? 'cobrar' : 'pagar',
      // Lo que se registra a mano es una proyección salvo que ya esté pagado;
      // la OC y la factura ponen su propio origen al enlazarse.
      origen: /PAGADO/i.test(estado) ? 'real' : (inicial?.origen ?? 'proyectado'),
      monto_pagado: pagado ? Math.abs(Number(pagado)) : null,
      estado_pago: estado || null,
      postergado: postergado ? Number(postergado) : null,
      observaciones: observaciones.trim() || null,
      fuente: 'erp',
    };
    try {
      // La tabla flujo_compromisos es nueva y aún no está en los tipos generados.
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const tabla = (supabase as any).from('flujo_compromisos');
      const { error } = editando
        ? await tabla.update(payload).eq('id', inicial!.id)
        : await tabla.insert({ ...payload, tenant_id: tenantId, creado_por: userId });
      if (error) throw error;
      toast.success(editando ? 'Compromiso actualizado' : 'Compromiso agregado');
      onGuardado();
      onOpenChange(false);
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e instanceof Error ? e.message : 'error'));
    } finally {
      setGuardando(false);
    }
  };

  const campo = 'h-9 w-full rounded-md border bg-background px-3 text-sm';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar compromiso' : 'Nuevo compromiso'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 block text-xs">Área</Label>
            <select className={campo} value={area} onChange={e => setArea(e.target.value)}>
              {areas.map(a => <option key={a} value={a}>{etiquetaArea(a)}</option>)}
            </select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Centro de costo (código)</Label>
            <Input list="cc-codigos" value={cdc} onChange={e => setCdc(e.target.value)} placeholder="Ej. OFCENTRAL" />
            <datalist id="cc-codigos">
              {centros.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1 block text-xs">Concepto *</Label>
            <Input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Descripción del compromiso" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Categoría</Label>
            <Input value={categoria} onChange={e => setCategoria(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Proveedor</Label>
            <Input value={proveedor} onChange={e => setProveedor(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Tipo</Label>
            <select className={campo} value={tipo} onChange={e => setTipo(e.target.value as 'egreso' | 'ingreso')}>
              <option value="egreso">Egreso (a pagar)</option>
              <option value="ingreso">Ingreso (p. ej. CIPRL)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1 block text-xs">Monto</Label>
              <Input type="number" inputMode="decimal" value={monto} onChange={e => setMonto(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Moneda</Label>
              <select className={campo} value={moneda} onChange={e => setMoneda(e.target.value as 'PEN' | 'USD')}>
                <option value="PEN">Soles</option>
                <option value="USD">Dólares</option>
              </select>
            </div>
          </div>
          {moneda === 'USD' && (
            <div>
              <Label className="mb-1 block text-xs">Tipo de cambio</Label>
              <Input type="number" inputMode="decimal" value={tc} onChange={e => setTc(e.target.value)} placeholder="3.75" />
            </div>
          )}
          <div>
            <Label className="mb-1 block text-xs">Mes de vencimiento</Label>
            <Input type="month" value={mes} onChange={e => setMes(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Estado</Label>
            <select className={campo} value={estado} onChange={e => setEstado(e.target.value)}>
              <option value="">—</option>
              {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1 block text-xs">Monto pagado</Label>
              <Input type="number" inputMode="decimal" value={pagado} onChange={e => setPagado(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Postergado (meses)</Label>
              <Input type="number" inputMode="decimal" value={postergado} onChange={e => setPostergado(e.target.value)} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1 block text-xs">Observaciones</Label>
            <textarea className="w-full rounded-md border bg-background px-3 py-2 text-sm" rows={2}
              value={observaciones} onChange={e => setObservaciones(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? <><Loader2 className="size-4 animate-spin" /> Guardando…</> : (editando ? 'Guardar cambios' : 'Agregar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Solicitud de viaje (ERP y app móvil). Los viáticos salen de la tarifa de la
 * política (S/300 o S/550 por día según hospedaje); se puede pedir más con
 * justificación y el viaje queda marcado "excede tarifa" para quien aprueba.
 */
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { ProyectoSelector } from '../../shared/ProyectoSelector';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';
import { usePermissions } from '@/lib/rbac/usePermissions';
import { cargarTarifas, diasEntre, solicitarViaje, soles, tarifaVigente, type PasajeroInput, type Tarifa } from '../../../lib/viajes/viajes';

interface Persona { user_id: string; nombre: string; cargo: string | null; email: string }
const hoy = () => new Date().toISOString().slice(0, 10);

export function NuevoViajeForm({ onCreado, onCancelar, compacto = false }: { onCreado: (id: string, numero: string) => void; onCancelar?: () => void; compacto?: boolean }) {
  const { user, profile } = useAuth();
  const { can } = usePermissions();
  const puedeOtros = can('viajes', 'crear');
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const yo = useMemo<Persona>(() => ({ user_id: user?.id ?? '', nombre: profile?.nombre ?? (user?.user_metadata as { nombre?: string } | undefined)?.nombre ?? user?.email ?? 'Yo', cargo: null, email: user?.email ?? '' }), [user, profile]);

  const [f, setF] = useState({ proyectoId: null as string | null, motivo: '', origen: 'LIMA', destino: '', fechaSalida: hoy(), fechaRetorno: hoy(), horaSalida: '', horaRetorno: '',
    medio: 'aereo', requierePasajes: true, requiereViaticos: true, conHospedaje: true, justificacion: '', observaciones: '', sinRetorno: false, diasAbierto: '1' });
  const [pasajeros, setPasajeros] = useState<(PasajeroInput & { _k: number; montoManual: string })[]>([{ _k: 1, user_id: yo.user_id, nombre: yo.nombre, es_externo: false, montoManual: '' }]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarTarifas().then(setTarifas).catch(() => setTarifas([]));
    if (puedeOtros) {
      supabase.from('usuarios_tenant').select('user_id, nombre, cargo, email').eq('estado', 'activo').order('nombre')
        .then(({ data }) => setPersonas((data ?? []) as Persona[]));
    }
  }, [puedeOtros]);
  // El perfil (nombre) llega después del primer render: el viajero "yo" toma el nombre real cuando aparece.
  useEffect(() => { setPasajeros(ps => ps.map((p, i) => (i === 0 && !p.es_externo && (!p.user_id || p.user_id === yo.user_id) ? { ...p, user_id: yo.user_id, nombre: yo.nombre } : p))); }, [yo]);

  const dias = f.sinRetorno ? Math.max(1, Number(f.diasAbierto) || 1) : diasEntre(f.fechaSalida, f.fechaRetorno);
  const tarifa = tarifaVigente(tarifas, f.conHospedaje ? 'adelanto_con_hospedaje' : 'adelanto_sin_hospedaje', f.fechaSalida);
  const calculado = f.requiereViaticos ? tarifa * dias : 0;
  const total = pasajeros.reduce((s, p) => s + (p.montoManual ? Number(p.montoManual) : calculado), 0);
  const excede = f.requiereViaticos && pasajeros.some(p => p.montoManual && Number(p.montoManual) > calculado);

  const setP = (k: number, parche: Partial<PasajeroInput & { montoManual: string }>) => setPasajeros(ps => ps.map(p => (p._k === k ? { ...p, ...parche } : p)));
  const agregar = () => setPasajeros(ps => [...ps, { _k: Date.now(), user_id: null, nombre: '', es_externo: false, montoManual: '' }]);
  const quitar = (k: number) => setPasajeros(ps => (ps.length === 1 ? ps : ps.filter(p => p._k !== k)));
  const elegirPersona = (k: number, uid: string) => {
    if (uid === 'externo') { setP(k, { user_id: null, nombre: '', es_externo: true }); return; }
    const per = personas.find(x => x.user_id === uid) ?? (uid === yo.user_id ? yo : null);
    if (per) setP(k, { user_id: per.user_id, nombre: per.nombre, cargo: per.cargo ?? undefined, es_externo: false });
  };

  const enviar = async () => {
    if (!f.motivo.trim()) { toast.error('Escribe el motivo del viaje'); return; }
    if (!f.destino.trim()) { toast.error('Indica el destino'); return; }
    if (!f.sinRetorno && f.fechaRetorno < f.fechaSalida) { toast.error('El retorno no puede ser antes de la salida'); return; }
    if (pasajeros.some(p => !p.nombre.trim())) { toast.error('Todos los viajeros necesitan nombre'); return; }
    if (excede && !f.justificacion.trim()) { toast.error('Pides más que la tarifa de la política: escribe la justificación'); return; }
    setGuardando(true);
    try {
      const r = await solicitarViaje({
        proyecto_id: f.proyectoId, motivo: f.motivo.trim(), origen: f.origen.trim() || 'LIMA', destino: f.destino.trim().toUpperCase(),
        fecha_salida: f.fechaSalida, fecha_retorno: f.sinRetorno ? null : f.fechaRetorno, hora_salida: f.horaSalida || undefined, hora_retorno: f.horaRetorno || undefined,
        medio_sugerido: f.medio, requiere_pasajes: f.requierePasajes, requiere_viaticos: f.requiereViaticos, con_hospedaje: f.conHospedaje,
        justificacion_tope: f.justificacion.trim() || undefined, observaciones: f.observaciones.trim() || undefined, origen_datos: compacto ? 'app' : 'erp',
        pasajeros: pasajeros.map(p => ({ user_id: p.user_id ?? null, nombre: p.nombre.trim(), cargo: p.cargo, es_externo: p.es_externo, dias, con_hospedaje: f.conHospedaje,
          viatico_solicitado: p.montoManual ? Number(p.montoManual) : null, cuenta_abono: p.cuenta_abono })),
      });
      toast.success(`Viaje ${r.numero} solicitado${r.tope_excedido ? ' (excede la tarifa, lo verá quien aprueba)' : ''}`);
      onCreado(r.id, r.numero);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setGuardando(false); }
  };

  const col = compacto ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-3';
  return (
    <div className="space-y-4">
      <div className={col}>
        <div className={compacto ? '' : 'md:col-span-2'}><Label>Motivo del viaje *</Label><Input value={f.motivo} onChange={e => setF(x => ({ ...x, motivo: e.target.value }))} placeholder="Inmatriculación de motos en Huánuco" /></div>
        <div className={compacto ? '' : 'md:col-span-2'}><Label>Proyecto (si no, va a oficina central)</Label><ProyectoSelector value={f.proyectoId} onChange={(v: string | null) => setF(x => ({ ...x, proyectoId: v }))} nullable /></div>
        <div><Label>Origen</Label><Input value={f.origen} onChange={e => setF(x => ({ ...x, origen: e.target.value }))} /></div>
        <div><Label>Destino *</Label><Input value={f.destino} onChange={e => setF(x => ({ ...x, destino: e.target.value }))} placeholder="CUSCO" /></div>
        <div><Label>Salida *</Label><Input type="date" value={f.fechaSalida} onChange={e => setF(x => ({ ...x, fechaSalida: e.target.value, fechaRetorno: x.fechaRetorno < e.target.value ? e.target.value : x.fechaRetorno }))} /></div>
        <div><Label>Retorno {f.sinRetorno ? '' : '*'}</Label>
          {f.sinRetorno
            ? <Input type="number" min={1} value={f.diasAbierto} onChange={e => setF(x => ({ ...x, diasAbierto: e.target.value }))} placeholder="Días de viático" />
            : <Input type="date" value={f.fechaRetorno} min={f.fechaSalida} onChange={e => setF(x => ({ ...x, fechaRetorno: e.target.value }))} />}
          <label className="flex items-center gap-2 text-xs mt-1"><Checkbox checked={f.sinRetorno} onCheckedChange={(v: boolean | 'indeterminate') => setF(x => ({ ...x, sinRetorno: v === true }))} /> Sin fecha de retorno (indicar días de viático)</label>
        </div>
        <div><Label>Hora salida</Label><Input type="time" value={f.horaSalida} onChange={e => setF(x => ({ ...x, horaSalida: e.target.value }))} /></div>
        <div><Label>Hora retorno</Label><Input type="time" value={f.horaRetorno} onChange={e => setF(x => ({ ...x, horaRetorno: e.target.value }))} /></div>
        <div>
          <Label>Medio sugerido</Label>
          <Select value={f.medio} onValueChange={(v: string) => setF(x => ({ ...x, medio: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="aereo">Aéreo</SelectItem><SelectItem value="terrestre">Terrestre</SelectItem><SelectItem value="propio">Vehículo de la empresa</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 justify-end text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={f.requierePasajes} onCheckedChange={(v: boolean | 'indeterminate') => setF(x => ({ ...x, requierePasajes: v === true }))} /> Requiere pasajes</label>
          <label className="flex items-center gap-2"><Checkbox checked={f.requiereViaticos} onCheckedChange={(v: boolean | 'indeterminate') => setF(x => ({ ...x, requiereViaticos: v === true }))} /> Requiere viáticos</label>
          <label className="flex items-center gap-2"><Checkbox checked={f.conHospedaje} onCheckedChange={(v: boolean | 'indeterminate') => setF(x => ({ ...x, conHospedaje: v === true }))} /> Con hospedaje</label>
        </div>
      </div>

      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Viajeros ({pasajeros.length}) · {dias} día{dias === 1 ? '' : 's'}{f.requiereViaticos ? ` · tarifa ${soles(tarifa)}/día → ${soles(calculado)} por persona` : ''}</div>
          <Button type="button" variant="outline" size="sm" onClick={agregar}><Plus className="size-4 mr-1" /> Viajero</Button>
        </div>
        {pasajeros.map(p => (
          <div key={p._k} className={compacto ? 'grid grid-cols-1 gap-2 border-t pt-2' : 'grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2 border-t pt-2'}>
            <div>
              {puedeOtros ? (
                <Select value={p.es_externo ? 'externo' : (p.user_id ?? '')} onValueChange={(v: string) => elegirPersona(p._k, v)}>
                  <SelectTrigger><SelectValue placeholder="Elige a la persona" /></SelectTrigger>
                  <SelectContent>
                    {[yo, ...personas.filter(x => x.user_id !== yo.user_id)].map(x => <SelectItem key={x.user_id} value={x.user_id}>{x.nombre}{x.cargo ? ` · ${x.cargo}` : ''}</SelectItem>)}
                    <SelectItem value="externo">Externo / sin usuario (escribir nombre)</SelectItem>
                  </SelectContent>
                </Select>
              ) : <Input value={p.nombre} readOnly />}
              {(p.es_externo || (!puedeOtros && false)) && <Input className="mt-1" value={p.nombre} onChange={e => setP(p._k, { nombre: e.target.value })} placeholder="Nombre y apellidos" />}
            </div>
            <div>
              {f.requiereViaticos && <Input type="number" step="0.01" value={p.montoManual} onChange={e => setP(p._k, { montoManual: e.target.value })} placeholder={`Viático: ${soles(calculado)}`} />}
            </div>
            <div className="flex items-start"><Button type="button" variant="ghost" size="sm" onClick={() => quitar(p._k)} disabled={pasajeros.length === 1}><Trash2 className="size-4" /></Button></div>
          </div>
        ))}
        {f.requiereViaticos && <div className="text-sm text-right">Viáticos solicitados: <b>{soles(total)}</b></div>}
        {excede && (
          <div className="text-sm rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 flex gap-2"><AlertTriangle className="size-4 shrink-0 text-amber-600" />
            <div>Pides más que la tarifa de la política. Escribe la justificación: quien aprueba lo verá marcado.
              <Textarea className="mt-2" rows={2} value={f.justificacion} onChange={e => setF(x => ({ ...x, justificacion: e.target.value }))} placeholder="Ej.: hospedaje en zona sin oferta bajo S/250, dos ciudades en el mismo día…" /></div>
          </div>
        )}
      </div>
      <div><Label>Observaciones</Label><Textarea rows={2} value={f.observaciones} onChange={e => setF(x => ({ ...x, observaciones: e.target.value }))} /></div>
      <div className="flex gap-2 justify-end">
        {onCancelar && <Button variant="outline" onClick={onCancelar} disabled={guardando}>Cancelar</Button>}
        <Button onClick={enviar} disabled={guardando} className={compacto ? 'flex-1' : ''}>{guardando ? <Loader2 className="size-4 animate-spin mr-1" /> : null}Enviar solicitud</Button>
      </div>
    </div>
  );
}

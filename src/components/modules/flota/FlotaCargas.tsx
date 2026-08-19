/**
 * Flota → Cargas masivas por Excel (pestaña del detalle de flota).
 * - Vehículos: plantilla descargable → alta/actualización masiva por VIN, asignados a la flota.
 * - Tarifario de costos: plantilla (pre-llenada con el actual) → reemplaza los costos del contrato.
 * SheetJS (xlsx) se importa de forma lazy para no cargar en el bundle principal.
 */
import { useRef, useState } from 'react';
import { FileDown, FileUp, Car, DollarSign, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';
import type { Flota, ContratoFlota } from '../../../lib/flota/flotas-store';

interface Props {
  flota: Flota;
  contrato: ContratoFlota | null;
  onCambio: () => void;
}

const COLS_VEHICULOS = ['VIN', 'Placa', 'Placa interna', 'Padron', 'Tipo', 'Marca', 'Modelo', 'Anio', 'Color', 'Combustible', 'Ubicacion'];
const COLS_TARIFAS = ['Orden', 'Km del servicio', 'Mes estimado', 'Costo'];

export function FlotaCargas({ flota, contrato, onCambio }: Props) {
  const { tenantId } = useAuth();
  const [subiendoVeh, setSubiendoVeh] = useState(false);
  const [subiendoTar, setSubiendoTar] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string; detalles?: string[] } | null>(null);
  const refVeh = useRef<HTMLInputElement>(null);
  const refTar = useRef<HTMLInputElement>(null);

  const descargarPlantilla = async (nombre: string, cols: string[], filas: (string | number)[][]) => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([cols, ...filas]);
    ws['!cols'] = cols.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, nombre);
  };

  const leerFilas = async (file: File): Promise<Record<string, any>[]> => {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
  };

  const val = (row: Record<string, any>, ...keys: string[]) => {
    for (const k of keys) {
      const hit = Object.keys(row).find(c => c.trim().toLowerCase() === k.toLowerCase());
      if (hit && String(row[hit]).trim() !== '') return String(row[hit]).trim();
    }
    return '';
  };

  // ── Vehículos ──
  const plantillaVehiculos = () => descargarPlantilla(
    `plantilla-vehiculos-${flota.codigo}.xlsx`, COLS_VEHICULOS,
    [['MMBJJLC10SH000000', 'ABC-123', 'INT-001', '1', flota.tipo, 'MITSUBISHI', 'L200', 2025, 'BLANCO', 'DIESEL', 'Base']],
  );

  const cargarVehiculos = async (file: File | null | undefined) => {
    if (!file) return;
    setSubiendoVeh(true); setResultado(null);
    try {
      const filas = await leerFilas(file);
      const registros = filas
        .map(r => ({
          vin: val(r, 'VIN').toUpperCase(),
          placa: val(r, 'Placa'),
          placa_interna: val(r, 'Placa interna', 'Placa_interna') || null,
          numero_padron: val(r, 'Padron', 'Padrón') || null,
          tipo: (val(r, 'Tipo') || flota.tipo).toLowerCase(),
          marca: val(r, 'Marca') || '',
          modelo: val(r, 'Modelo') || '',
          anio: parseInt(val(r, 'Anio', 'Año'), 10) || new Date().getFullYear(),
          color: val(r, 'Color') || '',
          combustible: (val(r, 'Combustible') || 'diesel').toLowerCase(),
          ubicacion_actual: val(r, 'Ubicacion', 'Ubicación') || 'Base',
        }))
        .filter(v => v.vin);
      if (registros.length === 0) { setResultado({ ok: false, msg: 'No se encontraron filas con VIN' }); return; }

      // VINs ya existentes en el tenant → update; el resto → insert
      const { data: existentes } = await supabase.from('vehiculos')
        .select('id, vin').in('vin', registros.map(r => r.vin));
      const mapExist = new Map((existentes ?? []).map((v: any) => [v.vin, v.id]));

      let insertados = 0, actualizados = 0;
      const errores: string[] = [];
      const abbr = flota.codigo.replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase();

      for (const r of registros) {
        const comun = {
          flota_id: flota.id, proyecto_id: flota.proyectoId,
          // Flota interna (sin proyecto) = vehículos propios de Memphis →
          // se marcan como administrativos (seguimiento documentario, N17).
          es_administrativo: flota.proyectoId == null,
          tipo: r.tipo, tipo_flota: flota.tipo, marca: r.marca, modelo: r.modelo, anio: r.anio,
          color: r.color, combustible: r.combustible, placa: r.placa, placa_interna: r.placa_interna,
          numero_padron: r.numero_padron, ubicacion_actual: r.ubicacion_actual, estado: 'activo',
        };
        if (mapExist.has(r.vin)) {
          const { error } = await supabase.from('vehiculos').update(comun).eq('id', mapExist.get(r.vin));
          if (error) errores.push(`${r.vin}: ${error.message}`); else actualizados++;
        } else {
          // código estable derivado del VIN (único, determinista)
          const { error } = await supabase.from('vehiculos').insert({
            ...comun, tenant_id: tenantId, vin: r.vin,
            codigo: `VEH-${abbr}-${r.vin.slice(-6)}`,
            kilometraje: 0,
          });
          if (error) errores.push(`${r.vin}: ${error.message}`); else insertados++;
        }
      }
      setResultado({
        ok: errores.length === 0,
        msg: `${insertados} nuevos, ${actualizados} actualizados${errores.length ? `, ${errores.length} con error` : ''}`,
        detalles: errores.slice(0, 8),
      });
      if (insertados + actualizados > 0) { toast.success(`${insertados + actualizados} vehículos cargados a ${flota.nombre}`); onCambio(); }
    } catch (e) {
      setResultado({ ok: false, msg: `No se pudo procesar el archivo: ${(e as Error).message}` });
    } finally {
      setSubiendoVeh(false);
      if (refVeh.current) refVeh.current.value = '';
    }
  };

  // ── Tarifario ──
  const plantillaTarifas = () => {
    const actuales = (contrato?.tarifas ?? []).map(t => [t.orden, t.kmServicio, t.mesEstimado ?? '', t.costo]);
    descargarPlantilla(
      `plantilla-tarifario-${flota.codigo}.xlsx`, COLS_TARIFAS,
      actuales.length ? actuales : [[1, 5000, 2, 300.00], [2, 10000, 4, 350.00]],
    );
  };

  const cargarTarifas = async (file: File | null | undefined) => {
    if (!file) return;
    if (!contrato) { toast.error('Esta flota no tiene contrato activo para cargar el tarifario'); return; }
    setSubiendoTar(true); setResultado(null);
    try {
      const filas = await leerFilas(file);
      const tarifas = filas.map((r, i) => ({
        tenant_id: tenantId, contrato_id: contrato.id,
        orden: parseInt(val(r, 'Orden'), 10) || (i + 1),
        km_servicio: parseInt(val(r, 'Km del servicio', 'Km_del_servicio', 'Km', 'km_servicio').replace(/\D/g, ''), 10),
        mes_estimado: parseInt(val(r, 'Mes estimado', 'Mes'), 10) || null,
        costo: Number(val(r, 'Costo').replace(/[^\d.]/g, '')),
      })).filter(t => t.km_servicio > 0 && t.costo >= 0);
      if (tarifas.length === 0) { setResultado({ ok: false, msg: 'No se encontraron filas con km y costo válidos' }); return; }

      // reemplazo: borrar tarifas del contrato y reinsertar
      const { error: delErr } = await supabase.from('flota_contrato_tarifas').delete().eq('contrato_id', contrato.id);
      if (delErr) { setResultado({ ok: false, msg: `No se pudo limpiar el tarifario: ${delErr.message}` }); return; }
      const { error: insErr } = await supabase.from('flota_contrato_tarifas').insert(tarifas);
      if (insErr) { setResultado({ ok: false, msg: `No se pudieron cargar los costos: ${insErr.message}` }); return; }

      // actualizar el total por vehículo del contrato = suma del tarifario
      const total = tarifas.reduce((s, t) => s + (t.costo || 0), 0);
      await supabase.from('flota_contratos')
        .update({ cantidad_servicios: tarifas.length, costo_total_por_vehiculo: total }).eq('id', contrato.id);

      setResultado({ ok: true, msg: `${tarifas.length} costos cargados (total por vehículo: ${total.toFixed(2)})` });
      toast.success(`Tarifario de ${flota.nombre} actualizado`);
      onCambio();
    } catch (e) {
      setResultado({ ok: false, msg: `No se pudo procesar el archivo: ${(e as Error).message}` });
    } finally {
      setSubiendoTar(false);
      if (refTar.current) refTar.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {resultado && (
        <div className={`rounded-md border p-3 flex items-start gap-2 ${resultado.ok ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : 'border-red-300 bg-red-50 dark:bg-red-950/20'}`}>
          {resultado.ok ? <CheckCircle2 className="size-4 text-green-600 mt-0.5" /> : <AlertTriangle className="size-4 text-red-600 mt-0.5" />}
          <div className="text-sm">
            <p>{resultado.msg}</p>
            {resultado.detalles && resultado.detalles.length > 0 && (
              <ul className="list-disc ml-4 mt-1 text-red-700 dark:text-red-400">{resultado.detalles.map((d, i) => <li key={i}>{d}</li>)}</ul>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vehículos */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Car className="size-4" /> Vehículos de la flota</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sube el Excel con los vehículos (VIN obligatorio; la placa puede ir vacía y completarse
              luego). Los VIN existentes se actualizan; los nuevos se crean en esta flota.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={plantillaVehiculos}><FileDown className="size-4" /> Plantilla</Button>
              <Button size="sm" onClick={() => refVeh.current?.click()} disabled={subiendoVeh}>
                <FileUp className="size-4" /> {subiendoVeh ? 'Cargando…' : 'Cargar Excel'}
              </Button>
              <input ref={refVeh} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => cargarVehiculos(e.target.files?.[0])} />
            </div>
          </CardContent>
        </Card>

        {/* Tarifario */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><DollarSign className="size-4" /> Tarifario de costos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Costos del mantenimiento por km (varían por flota). La plantilla trae el tarifario actual;
              al cargar, <strong>reemplaza</strong> los costos del contrato de esta flota.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={plantillaTarifas} disabled={!contrato}><FileDown className="size-4" /> Plantilla</Button>
              <Button size="sm" onClick={() => refTar.current?.click()} disabled={subiendoTar || !contrato}>
                <FileUp className="size-4" /> {subiendoTar ? 'Cargando…' : 'Cargar Excel'}
              </Button>
              <input ref={refTar} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => cargarTarifas(e.target.files?.[0])} />
            </div>
            {!contrato && <p className="text-xs text-amber-600">Sin contrato activo en esta flota.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

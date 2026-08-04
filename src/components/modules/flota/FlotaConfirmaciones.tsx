/**
 * Flota → Confirmaciones (Fase D del flujo QR).
 * Bandeja interna de Memphis: los mantenimientos que el TALLER registró quedan
 * en 'registrado_taller' (o 'pendiente_aprobacion' si fue una excepción sin cita).
 * Memphis revisa km + fotos + costo y CONFIRMA (→ 'confirmado', cuenta contra el
 * contrato) u OBSERVA (→ 'observado'). El staff sí ve el costo.
 */
import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, RefreshCw, CheckCircle2, AlertTriangle, Image as ImageIcon, Gauge, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Textarea } from '../../ui/textarea';
import { PageNav } from '../../shared/PageNav';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '../../../auth/AuthProvider';
import { dbConfirmacionesFlota } from '../../../lib/supabase/helpers';
import { fmtMoneda } from '../../../lib/flota/flotas-store';

interface Props { onNavigate: (route: string) => void; }

interface MantoBandeja {
  id: string;
  estado: string;
  origen: string;
  km_servicio: number | null;
  km_odometro: number | null;
  fecha_ejecucion: string | null;
  fecha_programada: string | null;
  requiere_aprobacion: boolean;
  confirmado_taller_en: string | null;
  observaciones: string | null;
  fotos: string[] | null;
  costo: number | null;
  moneda: string | null;
  vehiculo: { codigo: string; placa: string | null; vin: string | null; numero_padron: string | null; flota: { nombre: string | null; codigo: string | null } | null } | null;
  taller: { nombre: string | null; codigo: string | null } | null;
}

export function FlotaConfirmaciones(_props: Props) {
  const { user } = useAuth();
  const [filas, setFilas] = useState<MantoBandeja[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [fotosUrl, setFotosUrl] = useState<Record<string, string[]>>({});
  const [expandido, setExpandido] = useState<string | null>(null);

  // Diálogo observar
  const [obsOpen, setObsOpen] = useState(false);
  const [obsManto, setObsManto] = useState<MantoBandeja | null>(null);
  const [obsMotivo, setObsMotivo] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await dbConfirmacionesFlota.bandeja();
    if (error) {
      console.error('[CONFIRMACIONES] Error al cargar:', error.message);
      toast.error('No se pudo cargar la bandeja');
    } else {
      setFilas((data ?? []) as any as MantoBandeja[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const verFotos = async (m: MantoBandeja) => {
    if (expandido === m.id) { setExpandido(null); return; }
    setExpandido(m.id);
    if (!fotosUrl[m.id] && m.fotos && m.fotos.length > 0) {
      const urls: string[] = [];
      for (const path of m.fotos) {
        const { data } = await dbConfirmacionesFlota.fotoUrl(path);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      setFotosUrl(prev => ({ ...prev, [m.id]: urls }));
    }
  };

  const confirmar = async (m: MantoBandeja) => {
    setProcesando(m.id);
    const { error } = await dbConfirmacionesFlota.confirmar(m.id, user?.id ?? null);
    setProcesando(null);
    if (error) { toast.error(`No se pudo confirmar: ${error.message}`); return; }
    toast.success(`Servicio confirmado — ${m.vehiculo?.placa ?? m.vehiculo?.codigo ?? ''}`);
    cargar();
  };

  const abrirObservar = (m: MantoBandeja) => { setObsManto(m); setObsMotivo(''); setObsOpen(true); };
  const observar = async () => {
    if (!obsManto) return;
    if (obsMotivo.trim().length < 5) { toast.error('Indica el motivo de la observación'); return; }
    setProcesando(obsManto.id);
    const { error } = await dbConfirmacionesFlota.observar(obsManto.id, obsMotivo.trim(), user?.id ?? null);
    setProcesando(null);
    setObsOpen(false);
    if (error) { toast.error(`No se pudo observar: ${error.message}`); return; }
    toast.success('Registro observado');
    cargar();
  };

  const registrados = filas.filter(f => f.estado === 'registrado_taller').length;
  const pendientes = filas.filter(f => f.estado === 'pendiente_aprobacion').length;

  const vehLabel = (m: MantoBandeja) => m.vehiculo?.placa || m.vehiculo?.vin || m.vehiculo?.codigo || '—';

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <ClipboardCheck className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Confirmaciones de mantenimiento</h2>
            <p className="text-muted-foreground mt-1">
              Revisa lo que registró el taller (km + fotos) y confírmalo para que cuente contra el contrato
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={cargar} disabled={loading}>
          <RefreshCw className="size-4" /> Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Registrados por el taller (esperan confirmación)</p>
          <p className="text-2xl font-bold">{registrados}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ShieldAlert className="size-3 text-red-600" /> Excepciones pendientes de aprobación
          </p>
          <p className="text-2xl font-bold text-red-600">{pendientes}</p>
        </CardContent></Card>
      </div>

      {/* Lista */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Cargando…</p>
          ) : filas.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No hay mantenimientos por confirmar</p>
          ) : filas.map(m => {
            const esExcepcion = m.estado === 'pendiente_aprobacion';
            const nFotos = m.fotos?.length ?? 0;
            return (
              <div key={m.id} className="rounded-lg border">
                <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{vehLabel(m)}</p>
                      <Badge variant={esExcepcion ? 'destructive' : 'secondary'}>
                        {esExcepcion ? 'Pendiente de aprobación' : 'Registrado por taller'}
                      </Badge>
                      {esExcepcion && <span className="text-xs text-red-600">excepción: sin cita programada</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[m.vehiculo?.flota?.nombre, m.taller?.nombre && `Taller: ${m.taller.nombre}`,
                        m.vehiculo?.numero_padron && `Padrón ${m.vehiculo.numero_padron}`].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex items-center gap-4 text-sm flex-wrap pt-1">
                      <span className="flex items-center gap-1"><Gauge className="size-3.5 text-muted-foreground" />
                        Odómetro <strong>{m.km_odometro != null ? m.km_odometro.toLocaleString('es-PE') : '—'}</strong></span>
                      <span className="text-muted-foreground">Servicio {m.km_servicio != null ? `${m.km_servicio.toLocaleString('es-PE')} km` : '—'}</span>
                      <span className="text-muted-foreground">Ejecutado {m.fecha_ejecucion ?? '—'}</span>
                      <span className="font-medium">{m.costo != null ? fmtMoneda(m.costo, m.moneda) : '—'}</span>
                      <button className="flex items-center gap-1 text-primary hover:underline" onClick={() => verFotos(m)}>
                        <ImageIcon className="size-3.5" /> {nFotos} foto{nFotos === 1 ? '' : 's'}
                      </button>
                    </div>
                    {m.observaciones && <p className="text-xs text-muted-foreground italic">“{m.observaciones}”</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => abrirObservar(m)} disabled={procesando === m.id}
                      className="hover:!bg-red-600 hover:!text-white hover:!border-red-600">
                      Observar
                    </Button>
                    <Button size="sm" onClick={() => confirmar(m)} disabled={procesando === m.id}>
                      <CheckCircle2 className="size-4" /> {esExcepcion ? 'Aprobar y cerrar' : 'Confirmar'}
                    </Button>
                  </div>
                </div>

                {/* Fotos */}
                {expandido === m.id && (
                  <div className="border-t p-4">
                    {(fotosUrl[m.id]?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">{nFotos === 0 ? 'Sin fotos' : 'Cargando fotos…'}</p>
                    ) : (
                      <div className="flex gap-3 flex-wrap">
                        {fotosUrl[m.id].map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt={`evidencia ${i + 1}`} className="size-28 rounded-md object-cover border" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Diálogo observar */}
      <Dialog open={obsOpen} onOpenChange={setObsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-red-600" /> Observar registro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              El registro de <strong>{obsManto ? vehLabel(obsManto) : ''}</strong> quedará como observado (no cuenta contra el contrato). Indica el motivo.
            </p>
            <Textarea rows={3} value={obsMotivo} onChange={e => setObsMotivo(e.target.value)}
              placeholder="Ej: las fotos no corresponden al servicio, el km no coincide…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObsOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={observar} disabled={procesando === obsManto?.id}>Observar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

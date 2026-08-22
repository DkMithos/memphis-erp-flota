/**
 * VEHICLE PUBLIC VIEW — Ruta pública /v/:token (Fase E, rediseño)
 * Consulta el RPC vehiculo_public_by_token (SECURITY DEFINER): dado el token
 * EXACTO devuelve SOLO datos no sensibles (sin cliente/contrato ni números de
 * documento) + cumplimiento + último mantenimiento. No permite enumerar.
 */

import { useEffect, useState } from 'react';
import { AlertCircle, Lock, Loader2, Car, Wrench, CalendarCheck, FileText, ShieldCheck, Info, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
import { supabase } from '../../../lib/supabase/client';

interface VehiclePublicViewProps {
  token: string;
  onNavigate?: (route: string) => void;
}

interface DocPublico { tipo: string; estado: 'vigente' | 'proximo' | 'vencido' }

interface DatosPublicos {
  publico: boolean;
  placa?: string | null;
  vin?: string | null;
  tipo?: string;
  marca?: string;
  modelo?: string;
  anio?: number;
  color?: string;
  estado?: string;
  kilometraje?: number;
  en_flota?: boolean;
  servicios_ejecutados?: number;
  servicios_contratados?: number | null;
  cumplimiento_pct?: number | null;
  ultimo_mantenimiento?: { fecha: string; km: number | null; servicio_km: number | null } | null;
  documentos?: DocPublico[];
}

type Estado = 'loading' | 'not_found' | 'disabled' | DatosPublicos;

const fmtFecha = (iso: string) => {
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return iso; }
};

function estadoBadge(estado?: string) {
  switch (estado) {
    case 'activo': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300">Activo</Badge>;
    case 'en_taller': return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300">En taller</Badge>;
    case 'inactivo': return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300">Inactivo</Badge>;
    default: return <Badge variant="outline">{estado ?? '—'}</Badge>;
  }
}

function docBadge(estado: DocPublico['estado']) {
  const map = {
    vigente: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300',
    proximo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300',
    vencido: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300',
  };
  const label = { vigente: 'Vigente', proximo: 'Próximo a vencer', vencido: 'Vencido' };
  return <Badge className={map[estado]}>{label[estado]}</Badge>;
}

export function VehiclePublicView({ token }: VehiclePublicViewProps) {
  const [estado, setEstado] = useState<Estado>('loading');
  // Al escanear el QR se muestra primero un MENU con dos opciones:
  //   1. Datos del vehiculo (publico)  2. Ingreso al portal de talleres
  const [vista, setVista] = useState<'menu' | 'datos'>('menu');

  useEffect(() => {
    if (!token) { setEstado('not_found'); return; }
    (async () => {
      // rpc casteado: la función es nueva y no está en los tipos generados de Database
      const { data, error } = await (supabase.rpc as any)('vehiculo_public_by_token', { p_token: token });
      if (error || data == null) { setEstado('not_found'); return; }
      const d = data as DatosPublicos;
      if (d.publico === false) { setEstado('disabled'); return; }
      setEstado(d);
    })();
  }, [token]);

  if (estado === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (estado === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="size-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-semibold mb-2">Vehículo no encontrado</h2>
            <p className="text-muted-foreground">
              El código QR escaneado no corresponde a ningún vehículo registrado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (estado === 'disabled') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Lock className="size-16 mx-auto mb-4 text-amber-500" />
            <h2 className="text-2xl font-semibold mb-2">Vista pública deshabilitada</h2>
            <p className="text-muted-foreground">
              El acceso público a este vehículo ha sido deshabilitado temporalmente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = estado;

  // ── Menú inicial del QR ──
  if (vista === 'menu') {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center size-14 bg-primary/10 rounded-2xl mb-3">
              <Car className="size-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold break-all">{d.placa || d.vin}</h1>
            <p className="text-sm text-muted-foreground">
              {[d.marca, d.modelo].filter(Boolean).join(' ')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Memphis Maquinarias</p>
          </div>

          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm text-center text-muted-foreground">¿Qué deseas hacer?</p>

              <button
                type="button"
                onClick={() => setVista('datos')}
                className="w-full rounded-lg border p-4 text-left hover:bg-accent transition-colors flex items-start gap-3"
              >
                <Info className="size-5 text-primary shrink-0 mt-0.5" />
                <span>
                  <span className="block font-semibold">1. Datos del vehículo</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Información general, cumplimiento y último mantenimiento
                  </span>
                </span>
              </button>

              <a
                href={`/taller?v=${encodeURIComponent(token)}`}
                className="w-full rounded-lg border p-4 text-left hover:bg-accent transition-colors flex items-start gap-3"
              >
                <Wrench className="size-5 text-primary shrink-0 mt-0.5" />
                <span>
                  <span className="block font-semibold">2. Ingreso a Portal</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Solo talleres autorizados — requiere usuario y contraseña
                  </span>
                </span>
              </a>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <ShieldCheck className="size-3.5" /> Memphis ERP · Gestión de Flota
          </p>
        </div>
      </div>
    );
  }
  const pct = d.cumplimiento_pct ?? null;
  const docs = d.documentos ?? [];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center size-14 bg-primary/10 rounded-2xl mb-3">
            <Car className="size-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Hoja pública del vehículo</h1>
          <p className="text-sm text-muted-foreground">Memphis Maquinarias · información no sensible</p>
          <button
            type="button"
            onClick={() => setVista('menu')}
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ArrowLeft className="size-3.5" /> Volver
          </button>
        </div>

        {/* Identificación */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {/* Placa en trámite → se identifica por VIN */}
                <p className="text-xs text-muted-foreground">{d.placa ? 'Placa' : 'VIN'}</p>
                <p className={`font-bold text-primary ${d.placa ? 'text-3xl' : 'text-lg break-all'}`}>
                  {d.placa || d.vin || '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Estado</p>
                {estadoBadge(d.estado)}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
              <div><p className="text-xs text-muted-foreground">Marca</p><p className="font-semibold">{d.marca}</p></div>
              <div><p className="text-xs text-muted-foreground">Modelo</p><p className="font-semibold break-words">{d.modelo}</p></div>
              <div><p className="text-xs text-muted-foreground">Año</p><p className="font-semibold">{d.anio}</p></div>
              <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-semibold capitalize">{d.tipo}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div><p className="text-xs text-muted-foreground">Color</p><p className="font-semibold">{d.color || '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Kilometraje</p><p className="font-semibold">{(d.kilometraje ?? 0).toLocaleString('es-PE')} km</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Cumplimiento del plan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Wrench className="size-4" /> Cumplimiento del plan de mantenimiento</CardTitle>
          </CardHeader>
          <CardContent>
            {d.servicios_contratados != null ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {d.servicios_ejecutados ?? 0} de {d.servicios_contratados} servicios realizados
                  </p>
                  {pct != null && <p className="text-lg font-bold text-primary">{pct}%</p>}
                </div>
                <Progress value={pct ?? 0} className="h-2" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin plan de mantenimiento contratado.</p>
            )}
          </CardContent>
        </Card>

        {/* Último mantenimiento */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><CalendarCheck className="size-4" /> Último mantenimiento</CardTitle>
          </CardHeader>
          <CardContent>
            {d.ultimo_mantenimiento ? (
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-semibold">{fmtFecha(d.ultimo_mantenimiento.fecha)}</p>
                </div>
                {d.ultimo_mantenimiento.km != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Odómetro</p>
                    <p className="font-semibold">{Number(d.ultimo_mantenimiento.km).toLocaleString('es-PE')} km</p>
                  </div>
                )}
                {d.ultimo_mantenimiento.servicio_km != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Servicio</p>
                    <p className="font-semibold">{Number(d.ultimo_mantenimiento.servicio_km).toLocaleString('es-PE')} km</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin mantenimientos registrados.</p>
            )}
          </CardContent>
        </Card>

        {/* Documentos (solo tipo + estado) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="size-4" /> Documentos</CardTitle>
          </CardHeader>
          <CardContent>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin documentos registrados.</p>
            ) : (
              <div className="space-y-2">
                {docs.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border p-2.5">
                    <span className="font-medium text-sm">{doc.tipo}</span>
                    {docBadge(doc.estado)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center pt-4 pb-2 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <ShieldCheck className="size-3.5" /> Memphis ERP · Gestión de Flota
        </div>
      </div>
    </div>
  );
}

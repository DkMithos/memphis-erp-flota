/**
 * EQUIPO BIOMÉDICO PUBLIC VIEW
 * Ruta: /e/:token — completamente pública, sin auth
 * Consulta Supabase directamente (RLS permite SELECT público por public_token)
 */

import { useEffect, useState } from 'react';
import {
  AlertCircle, Lock, Loader2, Activity, MapPin,
  Calendar, Shield, Wrench, Gauge
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { supabase } from '../../../lib/supabase/client';
import {
  calcMantenimientoStatus,
  calcCalibracionStatus,
  type MantenimientoStatusBio,
} from '../../../lib/biomedico/equipo-public';

interface EquipoPublicViewProps {
  token: string;
}

interface EquipoPublicData {
  codigo: string;
  nombre: string;
  marca: string;
  modelo: string;
  serie: string | null;
  categoria: string;
  riesgo: string;
  estado: string;
  ubicacion: string;
  servicio_clinico: string | null;
  fecha_adquisicion: string | null;
  garantia_vence: string | null;
  ultimo_mantenimiento: string | null;
  proximo_mantenimiento: string | null;
  frecuencia_mp_dias: number;
  public_view_enabled: boolean;
}

const CATEGORIA_LABELS: Record<string, string> = {
  diagnostico: 'Diagnóstico',
  terapeutico: 'Terapéutico',
  soporte_vital: 'Soporte Vital',
  laboratorio: 'Laboratorio',
  rehabilitacion: 'Rehabilitación',
};

const RIESGO_COLORS: Record<string, string> = {
  bajo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medio: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  alto: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  critico: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const ESTADO_LABELS: Record<string, string> = {
  operativo: 'Operativo',
  mantenimiento: 'En Mantenimiento',
  fuera_servicio: 'Fuera de Servicio',
  baja: 'Dado de Baja',
  calibracion: 'En Calibración',
};

const ESTADO_COLORS: Record<string, string> = {
  operativo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  mantenimiento: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  fuera_servicio: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  baja: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  calibracion: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

function StatusBadge({ status }: { status: MantenimientoStatusBio }) {
  const colors: Record<string, string> = {
    al_dia: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    proximo: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    vencido: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    sin_datos: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status.estado]}`}>
      {status.mensaje}
    </span>
  );
}

export function EquipoPublicView({ token }: EquipoPublicViewProps) {
  const [equipo, setEquipo] = useState<EquipoPublicData | null | 'not_found' | 'loading'>('loading');

  useEffect(() => {
    if (!token) { setEquipo('not_found'); return; }

    (async () => {
      const { data, error } = await supabase
        .from('equipos_biomedicos')
        .select('codigo, nombre, marca, modelo, serie, categoria, riesgo, estado, ubicacion, servicio_clinico, fecha_adquisicion, garantia_vence, ultimo_mantenimiento, proximo_mantenimiento, frecuencia_mp_dias, public_view_enabled')
        .eq('public_token', token)
        .maybeSingle();

      if (error || !data) {
        setEquipo('not_found');
        return;
      }

      setEquipo(data as EquipoPublicData);
    })();
  }, [token]);

  if (equipo === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (equipo === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="size-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-semibold mb-2">Equipo no encontrado</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              El código QR escaneado no corresponde a ningún equipo registrado.
            </p>
            <p className="text-xs text-gray-500">
              Token: <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">{token}</code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (equipo.public_view_enabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Lock className="size-16 mx-auto mb-4 text-amber-500" />
            <h2 className="text-2xl font-semibold mb-2">Vista pública deshabilitada</h2>
            <p className="text-gray-600 dark:text-gray-400">
              El acceso público a este equipo ha sido deshabilitado temporalmente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate maintenance and warranty status
  const mantStatus = calcMantenimientoStatus(equipo.proximo_mantenimiento);
  const calStatus = calcCalibracionStatus(null); // calibración dates not in base query
  const garantiaVence = equipo.garantia_vence;
  const garantiaVigente = garantiaVence ? new Date() < new Date(garantiaVence) : false;

  // Parse ubicacion
  let ubicacionDisplay = equipo.ubicacion || 'No especificada';
  try {
    const parsed = JSON.parse(equipo.ubicacion);
    if (parsed && typeof parsed === 'object') {
      ubicacionDisplay = [parsed.area, parsed.subarea].filter(Boolean).join(' — ');
    }
  } catch { /* plain text */ }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center pt-4 pb-2">
          <h1 className="text-2xl font-bold" style={{ color: '#0A66C2' }}>Memphis ERP</h1>
          <p className="text-sm text-gray-500">Ficha Técnica del Equipo</p>
        </div>

        {/* Identificación */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="size-5" />
                {equipo.nombre}
              </CardTitle>
              <Badge className={ESTADO_COLORS[equipo.estado] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'}>
                {ESTADO_LABELS[equipo.estado] ?? equipo.estado}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Código</span>
                <p className="font-mono font-semibold">{equipo.codigo}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Categoría</span>
                <p className="font-medium">{CATEGORIA_LABELS[equipo.categoria] ?? equipo.categoria}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Marca</span>
                <p className="font-medium">{equipo.marca}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Modelo</span>
                <p className="font-medium">{equipo.modelo}</p>
              </div>
              {equipo.serie && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Nº Serie</span>
                  <p className="font-mono">{equipo.serie}</p>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center gap-2 text-sm">
              <Shield className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Nivel de Riesgo:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RIESGO_COLORS[equipo.riesgo] ?? ''}`}>
                {equipo.riesgo.charAt(0).toUpperCase() + equipo.riesgo.slice(1)}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Ubicación:</span>
              <span className="font-medium">{ubicacionDisplay}</span>
              {equipo.servicio_clinico && (
                <span className="text-muted-foreground">— {equipo.servicio_clinico}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mantenimiento */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="size-5" />
              Estado de Mantenimiento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mantenimiento Preventivo</span>
              <StatusBadge status={mantStatus} />
            </div>
            {equipo.ultimo_mantenimiento && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Último mantenimiento</span>
                <span>{new Date(equipo.ultimo_mantenimiento).toLocaleDateString('es-PE')}</span>
              </div>
            )}
            {equipo.proximo_mantenimiento && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Próximo mantenimiento</span>
                <span className="font-medium">{new Date(equipo.proximo_mantenimiento).toLocaleDateString('es-PE')}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Frecuencia MP</span>
              <span>Cada {equipo.frecuencia_mp_dias} días</span>
            </div>

            {calStatus.estado !== 'sin_datos' && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Gauge className="size-4" /> Calibración
                  </span>
                  <StatusBadge status={calStatus} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Garantía */}
        {garantiaVence && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="size-5" />
                Garantía
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estado</span>
                <Badge variant={garantiaVigente ? 'default' : 'secondary'}>
                  {garantiaVigente ? 'Vigente' : 'Vencida'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Vencimiento</span>
                <span>{new Date(garantiaVence).toLocaleDateString('es-PE')}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-500">
            Consultado el {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Memphis ERP — Gestión de Equipos Biomédicos
          </p>
        </div>
      </div>
    </div>
  );
}

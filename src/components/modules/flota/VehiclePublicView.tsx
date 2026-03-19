/**
 * VEHICLE PUBLIC VIEW
 * Ruta: /v/:token  — completamente pública, sin auth
 * Consulta Supabase directamente (RLS permite SELECT público en vehiculos por public_token)
 */

import { useEffect, useState } from 'react';
import { AlertCircle, Lock, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { supabase } from '../../../lib/supabase/client';
import { VehiclePublicLifeSheet } from './VehiclePublicLifeSheet';
import type { Vehiculo } from '../../../lib/flota/vehiculos-config';

interface VehiclePublicViewProps {
  token: string;
  onNavigate?: (route: string) => void;
}

export function VehiclePublicView({ token }: VehiclePublicViewProps) {
  const [vehiculo, setVehiculo] = useState<Vehiculo | null | 'not_found' | 'loading'>('loading');

  useEffect(() => {
    if (!token) { setVehiculo('not_found'); return; }

    (async () => {
      const { data, error } = await supabase
        .from('vehiculos')
        .select('*, docs:vehiculo_documentos(*)')
        .eq('public_token', token)
        .maybeSingle();

      if (error || !data) {
        setVehiculo('not_found');
        return;
      }

      // Map DB → frontend shape (minimal fields needed by VehiclePublicLifeSheet)
      const mapped: Vehiculo = {
        id: data.codigo,
        placa: data.placa,
        vin: data.vin ?? undefined,
        tipo: data.tipo,
        marca: data.marca,
        modelo: data.modelo,
        año: data.anio,
        color: data.color,
        motor: data.motor ?? undefined,
        combustible: data.combustible,
        capacidad: data.capacidad ?? undefined,
        kilometraje: data.kilometraje,
        ubicacionActual: data.ubicacion_actual,
        estado: data.estado,
        ultimoMantenimiento: data.ultimo_mantenimiento ?? undefined,
        proximoMantenimiento: data.proximo_mantenimiento ?? undefined,
        publicViewEnabled: data.public_view_enabled,
        publicToken: data.public_token ?? undefined,
        vinculoContrato: data.contrato_cliente_nombre ? {
          clienteNombre: data.contrato_cliente_nombre,
          proyectoNombre: data.contrato_proyecto_nombre ?? '',
          contratoNombre: data.contrato_nombre ?? '',
          tipoContrato: (data.contrato_tipo ?? 'otro') as Vehiculo['vinculoContrato'],
          fechaInicio: data.contrato_fecha_inicio ?? '',
          fechaFin: data.contrato_fecha_fin ?? '',
        } as Vehiculo['vinculoContrato'] : undefined,
        planPreventivoContratado: data.plan_preventivo_habilitado ? {
          habilitado: data.plan_preventivo_habilitado,
          tipoPlan: data.plan_preventivo_tipo ?? 'por_km',
          totalPreventivosContratados: data.plan_preventivo_total_contratados ?? 0,
          intervaloKm: data.plan_preventivo_intervalo_km ?? undefined,
          intervaloMeses: data.plan_preventivo_intervalo_meses ?? undefined,
        } as Vehiculo['planPreventivoContratado'] : undefined,
        documentosVehiculo: (data.docs ?? []).map((d: any) => ({
          id: d.codigo,
          tipo: d.tipo,
          nombre: d.nombre,
          numero: d.numero ?? undefined,
          fechaEmision: d.fecha_emision ?? undefined,
          fechaVencimiento: d.fecha_vencimiento,
          archivoNombre: d.archivo_nombre ?? undefined,
          observaciones: d.observaciones ?? undefined,
          creadoPor: d.creado_por ?? undefined,
          creadoEn: d.creado_en,
        })),
        documentos: [],
        creadoPor: data.creado_por ?? 'sistema',
        creadoEn: data.creado_en,
      };

      setVehiculo(mapped);
    })();
  }, [token]);

  if (vehiculo === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (vehiculo === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="size-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-semibold mb-2">Vehículo no encontrado</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              El código QR escaneado no corresponde a ningún vehículo registrado.
            </p>
            <p className="text-xs text-gray-500">
              Token: <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">{token}</code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (vehiculo.publicViewEnabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Lock className="size-16 mx-auto mb-4 text-amber-500" />
            <h2 className="text-2xl font-semibold mb-2">Vista pública deshabilitada</h2>
            <p className="text-gray-600 dark:text-gray-400">
              El acceso público a este vehículo ha sido deshabilitado temporalmente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <VehiclePublicLifeSheet vehiculo={vehiculo} />;
}

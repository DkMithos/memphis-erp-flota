/**
 * VEHICLE PUBLIC LIFE SHEET
 * Vista pública accesible por QR (/v/:token)
 * Muestra información no sensible del vehículo
 * 
 * 5 Secciones:
 * A) Identificación + estado operativo
 * B) Mantenimiento preventivo
 * C) Documentación
 * D) Historial resumido
 * E) Indicadores de cumplimiento
 */

import { Car, Clock, FileText, Wrench, TrendingUp, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Progress } from '../../ui/progress';
import { Vehiculo } from '../../../lib/flota/vehiculos-config';
import { useOTStore } from '../../../lib/flota/ot-store';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import {
  calcMaintenanceStatusByKm,
  calcDocStatusByDate,
  calcCompliancePreventivo,
  calcComplianceDocs,
  calcAvailability,
  getRecentMaintenanceHistory
} from '../../../lib/flota/vehicle-public';
import { buildPreventivoCounters, getNextPreventivoProjection } from '../../../lib/flota/vehicle-lifecycle';

interface VehiclePublicLifeSheetProps {
  vehiculo?: Vehiculo; // Objeto vehículo directamente
  vehiculoId?: string; // O ID para buscarlo
}

export function VehiclePublicLifeSheet({ vehiculo: vehiculoProp, vehiculoId }: VehiclePublicLifeSheetProps) {
  const { ots } = useOTStore();
  const { obtenerVehiculo } = useVehiculos();

  // Obtener vehículo: usar prop directa o buscar por ID
  const vehiculo = vehiculoProp || (vehiculoId ? obtenerVehiculo(vehiculoId) : undefined);

  // Si no hay vehículo, mostrar error
  if (!vehiculo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <Car className="size-16 mx-auto mb-4 text-red-500" />
              <h2 className="text-2xl font-semibold mb-2">Vehículo no encontrado</h2>
              <p className="text-gray-600 dark:text-gray-400">
                No se pudo cargar la información del vehículo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ========================================================================
  // CÁLCULOS
  // ========================================================================

  // Preventivos
  const preventivos = buildPreventivoCounters(vehiculo, ots);
  const proyeccion = getNextPreventivoProjection(vehiculo, ots);

  // Mantenimiento por KM
  const maintenanceStatus = proyeccion.proyeccionKm
    ? calcMaintenanceStatusByKm(
        proyeccion.proyeccionKm.kmActual,
        proyeccion.proyeccionKm.kmProximoPreventivo
      )
    : null;

  // Documentos con estado calculado
  const documentosConEstado = (vehiculo.documentos || []).map(doc => {
    if (!doc.fechaVencimiento) {
      return { ...doc, estadoCalculado: null };
    }
    const status = calcDocStatusByDate(doc.fechaVencimiento);
    return { ...doc, estadoCalculado: status.estado };
  });

  const docsVigentes = documentosConEstado.filter(d => d.estadoCalculado === 'vigente').length;
  const totalDocs = documentosConEstado.length;

  // Indicadores
  const cumplimientoPreventivo = calcCompliancePreventivo(preventivos.usados, preventivos.total);
  const cumplimientoDocumental = calcComplianceDocs(docsVigentes, totalDocs);
  const disponibilidad = calcAvailability(vehiculo, cumplimientoPreventivo, cumplimientoDocumental);

  // Historial
  const historialResumido = getRecentMaintenanceHistory(ots, vehiculo.id, 3);

  // Última actualización
  const ultimaActualizacion = vehiculo.modificadoEn || vehiculo.creadoEn;
  const fechaFormateada = new Date(ultimaActualizacion).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // ========================================================================
  // HELPERS DE RENDERING
  // ========================================================================

  const getEstadoBadge = (estado: Vehiculo['estado']) => {
    switch (estado) {
      case 'activo':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300">Activo</Badge>;
      case 'en_taller':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300">En Taller</Badge>;
      case 'inactivo':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300">Inactivo</Badge>;
    }
  };

  const getMantenimientoBadge = (estado: string) => {
    switch (estado) {
      case 'vigente':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 flex items-center gap-1">
          <CheckCircle2 className="size-3" /> Vigente
        </Badge>;
      case 'proximo':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 flex items-center gap-1">
          <AlertTriangle className="size-3" /> Próximo
        </Badge>;
      case 'vencido':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300 flex items-center gap-1">
          <XCircle className="size-3" /> Vencido
        </Badge>;
    }
  };

  const getDocBadge = (estado: string | null) => {
    if (!estado) {
      return <Badge variant="outline">N/A</Badge>;
    }
    switch (estado) {
      case 'vigente':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300">Vigente</Badge>;
      case 'proximo_a_vencer':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300">Próximo a Vencer</Badge>;
      case 'vencido':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300">Vencido</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#0A66C2' }}>
            Hoja de Vida del Vehículo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Vista pública - Información general
          </p>
        </div>

        {/* SECCIÓN A: IDENTIFICACIÓN + ESTADO OPERATIVO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="size-5" />
              Identificación del Vehículo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Placa</p>
                <p className="text-3xl font-bold" style={{ color: '#0A66C2' }}>
                  {vehiculo.placa}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Estado Operativo</p>
                <div className="mt-1">{getEstadoBadge(vehiculo.estado)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Marca</p>
                <p className="font-semibold">{vehiculo.marca}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Modelo</p>
                <p className="font-semibold">{vehiculo.modelo}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Año</p>
                <p className="font-semibold">{vehiculo.año}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tipo</p>
                <p className="font-semibold capitalize">{vehiculo.tipo.replace('_', ' ')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Kilometraje Actual</p>
                <p className="font-semibold">{vehiculo.kilometraje?.toLocaleString()} km</p>
              </div>
              {vehiculo.ubicacionActual && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ubicación / Base</p>
                  <p className="font-semibold">{vehiculo.ubicacionActual}</p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Última actualización: {fechaFormateada}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* SECCIÓN B: MANTENIMIENTO PREVENTIVO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-5" />
              Mantenimiento Preventivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Contadores */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {preventivos.total}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Contratados</p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {preventivos.usados}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Realizados</p>
              </div>
              <div className="text-center p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {preventivos.restantes}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Restantes</p>
              </div>
            </div>

            {/* Estado por KM */}
            {maintenanceStatus && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold">Próximo Mantenimiento</p>
                  {getMantenimientoBadge(maintenanceStatus.estado)}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {maintenanceStatus.mensaje}
                </p>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>KM Actual: {maintenanceStatus.kmActual.toLocaleString()}</span>
                  <span className="mx-2">•</span>
                  <span>Próximo: {maintenanceStatus.kmProximo.toLocaleString()} km</span>
                </div>
              </div>
            )}

            {/* Último y próximo (si hay datos) */}
            {vehiculo.ultimoMantenimiento && (
              <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold mb-1">Último Preventivo</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date(vehiculo.ultimoMantenimiento).toLocaleDateString('es-ES')}
                  </p>
                </div>
                {vehiculo.proximoMantenimiento && (
                  <div>
                    <p className="text-sm font-semibold mb-1">Próximo Programado</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(vehiculo.proximoMantenimiento).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SECCIÓN C: DOCUMENTACIÓN */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Documentación del Vehículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documentosConEstado.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No hay documentos registrados
              </p>
            ) : (
              <div className="space-y-3">
                {documentosConEstado.map(doc => {
                  // Calcular alerta visual según estado
                  const getAlertaBorder = () => {
                    if (doc.estadoCalculado === 'vencido') return 'border-red-300 bg-red-50 dark:bg-red-950';
                    if (doc.estadoCalculado === 'proximo_a_vencer') return 'border-amber-300 bg-amber-50 dark:bg-amber-950';
                    return 'border-gray-200';
                  };

                  return (
                    <div
                      key={doc.id}
                      className={`flex items-center justify-between p-3 border-2 rounded-lg hover:shadow-sm transition-shadow ${getAlertaBorder()}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{doc.tipo}</p>
                          {doc.estadoCalculado === 'vencido' && (
                            <AlertTriangle className="size-4 text-red-600" />
                          )}
                          {doc.estadoCalculado === 'proximo_a_vencer' && (
                            <AlertTriangle className="size-4 text-amber-600" />
                          )}
                        </div>
                        {doc.numero && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Nº {doc.numero}
                          </p>
                        )}
                        <div className="mt-1 space-y-0.5">
                          {doc.fechaEmision && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Emisión: {new Date(doc.fechaEmision).toLocaleDateString('es-ES')}
                            </p>
                          )}
                          {doc.fechaVencimiento && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Vencimiento: {new Date(doc.fechaVencimiento).toLocaleDateString('es-ES')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>{getDocBadge(doc.estadoCalculado)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SECCIÓN D: HISTORIAL RESUMIDO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5" />
              Historial de Mantenimientos (Últimos 3)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historialResumido.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No hay mantenimientos registrados
              </p>
            ) : (
              <div className="space-y-3">
                {historialResumido.map(item => (
                  <div
                    key={item.numeroOT}
                    className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-sm">{item.descripcion}</p>
                      <Badge variant="outline" className="text-xs">
                        {item.tipo}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <p>OT: {item.numeroOT}</p>
                      <p>Fecha: {new Date(item.fecha).toLocaleDateString('es-ES')}</p>
                      <p>Kilometraje: {item.kilometraje.toLocaleString()} km</p>
                      <p>Taller: {item.taller}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SECCIÓN E: INDICADORES DE CUMPLIMIENTO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5" />
              Indicadores de Cumplimiento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cumplimiento Preventivo */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Cumplimiento de Preventivos</p>
                <p className="text-sm font-bold" style={{ color: '#0A66C2' }}>
                  {cumplimientoPreventivo}%
                </p>
              </div>
              <Progress value={cumplimientoPreventivo} className="h-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {preventivos.usados} de {preventivos.total} preventivos realizados
              </p>
            </div>

            {/* Cumplimiento Documental */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Cumplimiento Documental</p>
                <p className="text-sm font-bold" style={{ color: '#0A66C2' }}>
                  {cumplimientoDocumental}%
                </p>
              </div>
              <Progress value={cumplimientoDocumental} className="h-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {docsVigentes} de {totalDocs} documentos vigentes
              </p>
            </div>

            {/* Disponibilidad */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Disponibilidad del Vehículo</p>
                <p className="text-sm font-bold" style={{ color: '#0A66C2' }}>
                  {disponibilidad}%
                </p>
              </div>
              <Progress value={disponibilidad} className="h-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Basado en estado operativo y cumplimiento
              </p>
            </div>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pt-8 pb-4 text-xs text-gray-500 dark:text-gray-400">
          <p>Memphis ERP - Sistema de Gestión de Flota</p>
          <p className="mt-1">Vista pública - Información no sensible</p>
        </div>
      </div>
    </div>
  );
}
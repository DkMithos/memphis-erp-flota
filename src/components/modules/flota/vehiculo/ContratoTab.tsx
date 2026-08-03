/**
 * Memphis ERP - Flota → Vehículo Detalle → Tab Contrato
 * Rediseño 2026-08: el vínculo contractual del vehículo se DERIVA de la flota.
 * El encargado solo elige la flota (desplegable); proyecto, contrato, proveedor,
 * tarifario y costos vienen del contrato de esa flota (modo lectura, sin tecleo).
 */

import { useState, useEffect } from 'react';
import { Building2, Save, RotateCcw, CheckCircle2, Info, FileWarning } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Label } from '../../../ui/label';
import { Badge } from '../../../ui/badge';
import { SearchableSelect } from '../../../shared/SearchableSelect';
import { useVehiculos } from '../../../../lib/flota/vehiculos-store';
import { useFlotas, fmtMoneda } from '../../../../lib/flota/flotas-store';
import { useProyectos } from '../../../../lib/proyectos/proyectos-store';
import { Vehiculo, TIPO_CONTRATO_LABELS } from '../../../../lib/flota/vehiculos-config';
import { toast } from 'sonner';

interface ContratoTabProps {
  vehiculoId: string;
  vehiculo: Vehiculo;
}

export function ContratoTab({ vehiculoId, vehiculo }: ContratoTabProps) {
  const { asignarFlota } = useVehiculos();
  const { flotas, loading: flotasLoading } = useFlotas();
  const { proyectos } = useProyectos();

  const [flotaIdSel, setFlotaIdSel] = useState<string | null>(vehiculo.flotaId ?? null);
  const [guardando, setGuardando] = useState(false);

  // Reset cuando cambia el vehículo (o su flota) desde afuera
  useEffect(() => {
    setFlotaIdSel(vehiculo.flotaId ?? null);
  }, [vehiculo.flotaId]);

  const modificado = flotaIdSel !== (vehiculo.flotaId ?? null);

  // Flota seleccionada y datos derivados
  const flotaSel = flotas.find(f => f.id === flotaIdSel);
  const proyecto = flotaSel ? proyectos.find(p => p._dbId === flotaSel.proyectoId) : undefined;
  const contrato = flotaSel
    ? (flotaSel.contratos.find(c => c.estado === 'activo') ?? flotaSel.contratos[0])
    : undefined;

  const opcionesFlota = flotas.map(f => ({
    value: f.id,
    label: `${f.codigo} — ${f.nombre}`,
    keywords: `${f.tipo ?? ''}`,
  }));

  const handleGuardar = async () => {
    setGuardando(true);
    const resultado = await asignarFlota(vehiculoId, flotaIdSel, flotaSel?.proyectoId ?? null);
    if (resultado.exito) {
      toast.success('Flota asignada', {
        description: flotaSel
          ? `El vehículo quedó vinculado a ${flotaSel.codigo}`
          : 'El vehículo quedó sin flota (administrativo)',
      });
    } else {
      toast.error('Error al asignar la flota', {
        description: resultado.errores?.join(', '),
      });
    }
    setGuardando(false);
  };

  const handleRestablecer = () => setFlotaIdSel(vehiculo.flotaId ?? null);

  const tieneFlota = !!vehiculo.flotaId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold flex items-center gap-2">
            <Building2 className="size-5 text-[#0A66C2]" />
            Contrato & Flota
          </h3>
          <p className="text-sm text-muted-foreground">
            El vehículo hereda su proyecto, contrato y tarifario de la flota a la que pertenece
          </p>
        </div>

        {tieneFlota && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-4" />
            Flota asignada
          </div>
        )}
      </div>

      {/* Selector de flota */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flota del vehículo</CardTitle>
          <CardDescription>
            Selecciona la flota. Los datos del contrato se completan automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Flota</Label>
            <SearchableSelect
              value={flotaIdSel}
              onChange={setFlotaIdSel}
              options={opcionesFlota}
              placeholder={flotasLoading ? 'Cargando flotas…' : 'Seleccionar flota'}
              searchPlaceholder="Buscar flota…"
              emptyText="No hay flotas disponibles"
              nullable
              nullLabel="Sin flota (vehículo administrativo)"
              disabled={guardando || flotasLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Datos derivados del contrato de la flota */}
      {flotaSel && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Contrato de la flota
              {contrato && (
                <Badge variant="outline" className="font-normal capitalize">
                  {contrato.estado}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Información heredada de {flotaSel.codigo} — solo lectura</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cliente / proyecto */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="Cliente / Entidad" valor={proyecto?.entidadCliente ?? '—'} />
              <Campo
                label="Proyecto"
                valor={proyecto ? `${proyecto.id} — ${proyecto.nombre}` : 'Proyecto de la flota'}
              />
            </div>

            {!contrato ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-sm">
                <FileWarning className="size-4 mt-0.5 text-amber-600 shrink-0" />
                <span>
                  Esta flota aún no tiene un contrato configurado. Configúralo en el detalle de la
                  flota (proveedor, moneda y tarifario) y aquí se reflejará automáticamente.
                </span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Campo label="Contrato" valor={contrato.nombre} />
                  <Campo label="Proveedor / Taller" valor={contrato.proveedorNombre ?? '—'} />
                  <Campo
                    label="Modalidad de pago"
                    valor={contrato.modalidadPago === 'adelantado' ? 'Adelantado' : 'Mensual'}
                  />
                  <Campo label="Moneda" valor={contrato.moneda} />
                  <Campo
                    label="Duración"
                    valor={contrato.duracionMeses != null ? `${contrato.duracionMeses} meses` : '—'}
                  />
                  <Campo
                    label="Km límite"
                    valor={contrato.kmLimite != null ? `${contrato.kmLimite.toLocaleString('es-PE')} km` : '—'}
                  />
                  <Campo
                    label="Servicios contratados"
                    valor={contrato.cantidadServicios != null ? String(contrato.cantidadServicios) : '—'}
                  />
                  <Campo
                    label="Costo total por vehículo"
                    valor={
                      contrato.costoTotalPorVehiculo != null
                        ? fmtMoneda(contrato.costoTotalPorVehiculo, contrato.moneda)
                        : '—'
                    }
                  />
                  <Campo label="Fecha de inicio" valor={contrato.fechaInicio ?? '—'} />
                </div>

                {/* Tarifario */}
                {contrato.tarifas.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Tarifario del contrato ({contrato.tarifas.length} servicios)
                    </Label>
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="text-left font-medium px-3 py-2">#</th>
                            <th className="text-right font-medium px-3 py-2">Km del servicio</th>
                            <th className="text-right font-medium px-3 py-2">Mes estimado</th>
                            <th className="text-right font-medium px-3 py-2">Costo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contrato.tarifas.map(t => (
                            <tr key={t.id} className="border-t">
                              <td className="px-3 py-2">{t.orden}</td>
                              <td className="px-3 py-2 text-right font-mono">
                                {t.kmServicio.toLocaleString('es-PE')}
                              </td>
                              <td className="px-3 py-2 text-right">{t.mesEstimado ?? '—'}</td>
                              <td className="px-3 py-2 text-right font-mono">
                                {fmtMoneda(t.costo, contrato.moneda)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Datos heredados (legacy) — solo lectura, para no perder información previa */}
      {vehiculo.vinculoContrato && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Info className="size-4" />
              Datos de contrato previos (heredados)
            </CardTitle>
            <CardDescription>
              Registrados antes del rediseño por flota. Se conservan como referencia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <Campo label="Cliente" valor={vehiculo.vinculoContrato.clienteNombre || '—'} />
              <Campo label="Proyecto" valor={vehiculo.vinculoContrato.proyectoNombre || '—'} />
              <Campo label="Contrato" valor={vehiculo.vinculoContrato.contratoNombre || '—'} />
              <Campo
                label="Tipo"
                valor={TIPO_CONTRATO_LABELS[vehiculo.vinculoContrato.tipoContrato] ?? vehiculo.vinculoContrato.tipoContrato}
              />
              <Campo label="Inicio" valor={vehiculo.vinculoContrato.fechaInicio || '—'} />
              <Campo label="Fin" valor={vehiculo.vinculoContrato.fechaFin || '—'} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-3">
        <Button onClick={handleGuardar} disabled={guardando || !modificado} className="gap-2">
          <Save className="size-4" />
          {guardando ? 'Guardando...' : 'Guardar Flota'}
        </Button>

        <Button
          variant="outline"
          onClick={handleRestablecer}
          disabled={guardando || !modificado}
          className="gap-2"
        >
          <RotateCcw className="size-4" />
          Restablecer
        </Button>

        {modificado && (
          <span className="text-sm text-muted-foreground">Hay cambios sin guardar</span>
        )}
      </div>
    </div>
  );
}

/** Campo de solo lectura (label + valor) */
function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{valor}</p>
    </div>
  );
}

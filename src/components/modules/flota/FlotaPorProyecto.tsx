/**
 * FlotaPorProyecto — Vista de vehículos agrupados por proyecto
 * Muestra KPIs de costos (contratado/consumido/restante) y vehículos por tipo de flota
 */

import { useState, useMemo } from 'react';
import {
  FolderKanban, Car, DollarSign, Wrench, ChevronRight,
  AlertTriangle, Search, Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Progress } from '../../ui/progress';
import { Button } from '../../ui/button';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useOTStore } from '../../../lib/flota/ot-store';
import { useProyectos } from '../../../lib/proyectos/proyectos-store';
import { calcSaldoPreventivo, type Vehiculo } from '../../../lib/flota/vehiculos-config';
import { ProyectoSelector } from '../../shared/ProyectoSelector';

interface FlotaPorProyectoProps {
  onNavigate: (route: string) => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(amount);
}

function getProgressColor(porcentaje: number): string {
  if (porcentaje >= 90) return '[&>div]:bg-red-500';
  if (porcentaje >= 70) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-green-500';
}

interface VehiculoRowProps {
  vehiculo: Vehiculo;
  ots: Array<{ vehiculoId: string; tipo: string; estado: string; costos?: { total: number } }>;
  onNavigate: (route: string) => void;
}

function VehiculoRow({ vehiculo, ots, onNavigate }: VehiculoRowProps) {
  const saldo = calcSaldoPreventivo(
    vehiculo.id,
    ots,
    vehiculo.planPreventivoContratado
  );

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors group"
      onClick={() => onNavigate(`/flota/vehiculos/${vehiculo.id}`)}
    >
      {/* Placa + modelo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{vehiculo.placa}</span>
          <Badge variant="outline" className="text-xs">{vehiculo.tipo}</Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {vehiculo.marca} {vehiculo.modelo} ({vehiculo.año}) · {vehiculo.kilometraje.toLocaleString()} km
        </p>
      </div>

      {/* Preventivos count */}
      <div className="hidden sm:block text-center min-w-[80px]">
        <p className="text-xs text-muted-foreground">Prev.</p>
        <p className="text-sm font-medium">
          {saldo.preventivosRealizados}/{saldo.preventivosTotal}
        </p>
      </div>

      {/* Costo consumido / total */}
      <div className="hidden md:block min-w-[160px]">
        {saldo.costoTotalContratado > 0 ? (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {formatCurrency(saldo.costoConsumido)}
              </span>
              <span className="font-medium">{saldo.porcentajeCosto}%</span>
            </div>
            <Progress value={saldo.porcentajeCosto} className={`h-1.5 ${getProgressColor(saldo.porcentajeCosto)}`} />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Sin contrato</span>
        )}
      </div>

      {/* Saldo restante */}
      <div className="hidden lg:block text-right min-w-[100px]">
        <p className="text-xs text-muted-foreground">Saldo</p>
        <p className={`text-sm font-semibold ${saldo.costoRestante <= 0 ? 'text-red-600' : 'text-green-600'}`}>
          {saldo.costoTotalContratado > 0 ? formatCurrency(saldo.costoRestante) : '—'}
        </p>
      </div>

      <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export function FlotaPorProyecto({ onNavigate }: FlotaPorProyectoProps) {
  const { vehiculos } = useVehiculos();
  const { ordenes } = useOTStore();
  const { proyectos } = useProyectos();

  const [proyectoSeleccionado, setProyectoSeleccionado] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  // Map OTs para cálculos
  const otsParaCalculo = useMemo(() =>
    ordenes.map(ot => ({
      vehiculoId: ot.vehiculoId,
      tipo: ot.tipo,
      estado: ot.estado,
      costos: ot.costos,
    })),
    [ordenes]
  );

  // Obtener proyectos que tienen vehículos asignados
  const proyectosConFlota = useMemo(() => {
    const proyectoIds = new Set(
      vehiculos.filter(v => v.proyectoId).map(v => v.proyectoId!)
    );
    return proyectos.filter(p => proyectoIds.has(p._dbId));
  }, [vehiculos, proyectos]);

  // Vehículos sin proyecto
  const vehiculosSinProyecto = useMemo(() =>
    vehiculos.filter(v => !v.proyectoId),
    [vehiculos]
  );

  // Filtrar vehículos del proyecto seleccionado
  const vehiculosDelProyecto = useMemo(() => {
    if (!proyectoSeleccionado) return [];
    return vehiculos.filter(v => v.proyectoId === proyectoSeleccionado);
  }, [vehiculos, proyectoSeleccionado]);

  // Agrupar por tipo de flota
  const gruposPorTipoFlota = useMemo(() => {
    const source = proyectoSeleccionado ? vehiculosDelProyecto : vehiculos;
    const filtered = busqueda
      ? source.filter(v =>
          v.placa.toLowerCase().includes(busqueda.toLowerCase()) ||
          v.marca.toLowerCase().includes(busqueda.toLowerCase()) ||
          v.modelo.toLowerCase().includes(busqueda.toLowerCase())
        )
      : source;

    const groups: Record<string, Vehiculo[]> = {};
    filtered.forEach(v => {
      const key = v.tipoFlota || 'sin_asignar';
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    });
    return groups;
  }, [vehiculos, vehiculosDelProyecto, proyectoSeleccionado, busqueda]);

  // KPIs del proyecto seleccionado
  const kpis = useMemo(() => {
    const source = proyectoSeleccionado ? vehiculosDelProyecto : vehiculos;
    let totalContratado = 0;
    let totalConsumido = 0;
    let totalPreventivos = 0;
    let preventivosRealizados = 0;

    source.forEach(v => {
      const saldo = calcSaldoPreventivo(v.id, otsParaCalculo, v.planPreventivoContratado);
      totalContratado += saldo.costoTotalContratado;
      totalConsumido += saldo.costoConsumido;
      totalPreventivos += saldo.preventivosTotal;
      preventivosRealizados += saldo.preventivosRealizados;
    });

    const totalRestante = Math.max(0, totalContratado - totalConsumido);
    const porcentaje = totalContratado > 0 ? Math.round((totalConsumido / totalContratado) * 100) : 0;

    return {
      totalVehiculos: source.length,
      totalContratado,
      totalConsumido,
      totalRestante,
      porcentaje,
      totalPreventivos,
      preventivosRealizados,
    };
  }, [vehiculos, vehiculosDelProyecto, proyectoSeleccionado, otsParaCalculo]);

  const proyectoInfo = proyectoSeleccionado
    ? proyectos.find(p => p._dbId === proyectoSeleccionado)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FolderKanban className="size-6 text-primary" />
            Flota por Proyecto
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Vista consolidada de vehículos, mantenimientos y costos por proyecto
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-xs">
          <ProyectoSelector
            value={proyectoSeleccionado}
            onChange={setProyectoSeleccionado}
            nullable
          />
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, marca o modelo..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Nombre del proyecto seleccionado */}
      {proyectoInfo && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-sm font-medium text-primary">
            {proyectoInfo.id} — {proyectoInfo.nombre}
          </p>
          {proyectoInfo.gerenteProyecto && (
            <p className="text-xs text-muted-foreground mt-0.5">Gerente: {proyectoInfo.gerenteProyecto}</p>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Car className="size-5 mx-auto text-blue-600 mb-1" />
            <p className="text-2xl font-bold">{kpis.totalVehiculos}</p>
            <p className="text-xs text-muted-foreground">Vehículos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="size-5 mx-auto text-blue-600 mb-1" />
            <p className="text-lg font-bold">{formatCurrency(kpis.totalContratado)}</p>
            <p className="text-xs text-muted-foreground">Total Contratado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="size-5 mx-auto text-amber-600 mb-1" />
            <p className="text-lg font-bold">{formatCurrency(kpis.totalConsumido)}</p>
            <p className="text-xs text-muted-foreground">Consumido ({kpis.porcentaje}%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="size-5 mx-auto text-green-600 mb-1" />
            <p className="text-lg font-bold">{formatCurrency(kpis.totalRestante)}</p>
            <p className="text-xs text-muted-foreground">Saldo Disponible</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de progreso general */}
      {kpis.totalContratado > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Consumo total: {kpis.preventivosRealizados} de {kpis.totalPreventivos} preventivos
            </span>
            <span className="font-medium">{kpis.porcentaje}%</span>
          </div>
          <Progress value={kpis.porcentaje} className={`h-2.5 ${getProgressColor(kpis.porcentaje)}`} />
        </div>
      )}

      {/* Grupos por tipo de flota */}
      {Object.keys(gruposPorTipoFlota).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Filter className="size-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {proyectoSeleccionado
                ? 'No hay vehículos asignados a este proyecto.'
                : 'Selecciona un proyecto para ver su flota, o visualiza todos los vehículos.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(gruposPorTipoFlota)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([tipoFlota, vehs]) => {
            const label = tipoFlota === 'sin_asignar'
              ? 'Sin tipo de flota asignado'
              : tipoFlota.charAt(0).toUpperCase() + tipoFlota.slice(1).replace(/_/g, ' ');

            return (
              <Card key={tipoFlota}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Car className="size-4 text-primary" />
                    {label}
                    <Badge variant="secondary" className="text-xs">{vehs.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {vehs.map(v => (
                    <VehiculoRow
                      key={v.id}
                      vehiculo={v}
                      ots={otsParaCalculo}
                      onNavigate={onNavigate}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })
      )}

      {/* Resumen de vehículos sin proyecto */}
      {!proyectoSeleccionado && vehiculosSinProyecto.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>{vehiculosSinProyecto.length}</strong> vehículo(s) sin proyecto asignado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

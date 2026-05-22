/**
 * AlertasPreventivo — Alertas de mantenimiento preventivo próximo
 * Muestra vehículos que se acercan a su próximo preventivo por km o meses
 */

import { useMemo } from 'react';
import { AlertTriangle, Gauge, Calendar, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useOTStore } from '../../../lib/flota/ot-store';
import { calcAlertaPreventivo, type AlertaPreventivo as AlertaPreventivoType } from '../../../lib/flota/vehiculos-config';

interface AlertasPreventivoProps {
  onNavigate: (route: string) => void;
  limit?: number; // Máximo de alertas a mostrar (default: 10)
}

export function AlertasPreventivo({ onNavigate, limit = 10 }: AlertasPreventivoProps) {
  const { vehiculos } = useVehiculos();
  const { ordenes } = useOTStore();

  const alertas = useMemo(() => {
    const resultado: AlertaPreventivoType[] = [];

    vehiculos.forEach(v => {
      if (v.estado !== 'activo') return;

      // Contar preventivos realizados
      const preventivosRealizados = ordenes.filter(
        ot => ot.vehiculoId === v.id && ot.tipo === 'preventivo' && ot.estado === 'cerrada'
      ).length;

      const alerta = calcAlertaPreventivo(v, preventivosRealizados);
      if (alerta) resultado.push(alerta);
    });

    // Ordenar: urgentes primero, luego próximos
    resultado.sort((a, b) => {
      if (a.severidad === 'urgente' && b.severidad !== 'urgente') return -1;
      if (b.severidad === 'urgente' && a.severidad !== 'urgente') return 1;
      // Dentro de la misma severidad, por km faltantes (menor primero)
      return (a.kmFaltantes ?? Infinity) - (b.kmFaltantes ?? Infinity);
    });

    return resultado.slice(0, limit);
  }, [vehiculos, ordenes, limit]);

  if (alertas.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          Alertas de Mantenimiento Preventivo
          <Badge variant="secondary" className="text-xs">{alertas.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {alertas.map(alerta => (
          <div
            key={alerta.vehiculoId}
            className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors group"
            onClick={() => onNavigate(`/flota/vehiculos/${alerta.vehiculoId}`)}
          >
            {/* Severity icon */}
            <div className={`size-2.5 rounded-full flex-shrink-0 ${
              alerta.severidad === 'urgente' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
            }`} />

            {/* Vehicle info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{alerta.placa}</span>
                <Badge variant={alerta.severidad === 'urgente' ? 'destructive' : 'outline'} className="text-xs">
                  {alerta.severidad === 'urgente' ? 'Urgente' : 'Próximo'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {alerta.marca} {alerta.modelo}
              </p>
            </div>

            {/* Alert details */}
            <div className="hidden sm:flex items-center gap-4 text-xs">
              {alerta.kmFaltantes !== undefined && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Gauge className="size-3.5" />
                  <span className={alerta.severidad === 'urgente' && alerta.tipo !== 'meses' ? 'text-red-600 font-semibold' : ''}>
                    {alerta.kmFaltantes.toLocaleString()} km
                  </span>
                </div>
              )}
              {alerta.diasFaltantes !== undefined && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="size-3.5" />
                  <span className={alerta.severidad === 'urgente' && alerta.tipo !== 'km' ? 'text-red-600 font-semibold' : ''}>
                    {alerta.diasFaltantes}d
                  </span>
                </div>
              )}
            </div>

            <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

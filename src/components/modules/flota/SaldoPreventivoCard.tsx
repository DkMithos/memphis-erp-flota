/**
 * SaldoPreventivoCard — Modelo de crédito prepago por mantenimiento preventivo
 * Muestra: costo total contratado, costo consumido, saldo restante
 * + barra de progreso visual y conteo de servicios
 */

import { DollarSign, Wrench, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Progress } from '../../ui/progress';
import { Badge } from '../../ui/badge';
import type { SaldoPreventivo } from '../../../lib/flota/vehiculos-config';

interface SaldoPreventivoCardProps {
  saldo: SaldoPreventivo;
  kilometrajeActual?: number;
  intervaloKm?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(amount);
}

function getStatusColor(porcentaje: number): string {
  if (porcentaje >= 90) return 'text-red-600 dark:text-red-400';
  if (porcentaje >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-green-600 dark:text-green-400';
}

function getProgressColor(porcentaje: number): string {
  if (porcentaje >= 90) return '[&>div]:bg-red-500';
  if (porcentaje >= 70) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-green-500';
}

export function SaldoPreventivoCard({ saldo, kilometrajeActual, intervaloKm }: SaldoPreventivoCardProps) {
  const {
    preventivosRealizados,
    preventivosRestantes,
    preventivosTotal,
    porcentajeServicios,
    costoTotalContratado,
    costoConsumido,
    costoRestante,
    porcentajeCosto,
  } = saldo;

  // Calcular km hasta próximo preventivo
  let kmProximo: number | null = null;
  if (kilometrajeActual && intervaloKm && intervaloKm > 0) {
    const preventivosHechos = preventivosRealizados;
    const kmSiguiente = (preventivosHechos + 1) * intervaloKm;
    kmProximo = kmSiguiente - kilometrajeActual;
  }

  const sinContrato = costoTotalContratado === 0 && preventivosTotal === 0;

  if (sinContrato) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="size-5 text-muted-foreground" />
            Saldo Preventivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground">
            <AlertTriangle className="size-5" />
            <p className="text-sm">Sin plan preventivo contratado. Configure el plan en la pestaña "Plan Preventivo".</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="size-5 text-primary" />
          Saldo Preventivo
          {porcentajeCosto >= 90 && (
            <Badge variant="destructive" className="text-xs">Casi agotado</Badge>
          )}
          {porcentajeCosto < 50 && costoTotalContratado > 0 && (
            <Badge variant="outline" className="text-xs text-green-700 border-green-300 dark:text-green-400 dark:border-green-700">
              Disponible
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Barra de progreso de costo */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Consumo del contrato</span>
            <span className={`font-semibold ${getStatusColor(porcentajeCosto)}`}>
              {porcentajeCosto}%
            </span>
          </div>
          <Progress value={porcentajeCosto} className={`h-3 ${getProgressColor(porcentajeCosto)}`} />
        </div>

        {/* KPIs en grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Costo total contratado */}
          <div className="space-y-1 text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
            <p className="text-xs text-muted-foreground">Contratado</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
              {formatCurrency(costoTotalContratado)}
            </p>
          </div>

          {/* Costo consumido */}
          <div className="space-y-1 text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
            <p className="text-xs text-muted-foreground">Consumido</p>
            <p className={`text-lg font-bold ${getStatusColor(porcentajeCosto)}`}>
              {formatCurrency(costoConsumido)}
            </p>
          </div>

          {/* Saldo restante */}
          <div className="space-y-1 text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-400">
              {formatCurrency(costoRestante)}
            </p>
          </div>
        </div>

        {/* Conteo de servicios */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-muted-foreground" />
            <span className="text-sm">Preventivos realizados</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {preventivosRealizados} <span className="text-muted-foreground font-normal">de</span> {preventivosTotal}
            </span>
            <Badge variant="outline" className="text-xs">
              {preventivosRestantes} restantes
            </Badge>
          </div>
        </div>

        {/* Próximo mantenimiento por km */}
        {kmProximo !== null && (
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              <TrendingDown className="size-4 text-muted-foreground" />
              <span className="text-sm">Próximo preventivo</span>
            </div>
            <div className="flex items-center gap-1">
              {kmProximo <= 0 ? (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="size-3 mr-1" />
                  Vencido ({Math.abs(kmProximo).toLocaleString()} km excedidos)
                </Badge>
              ) : kmProximo <= 500 ? (
                <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 dark:text-amber-400">
                  <AlertTriangle className="size-3 mr-1" />
                  En {kmProximo.toLocaleString()} km
                </Badge>
              ) : (
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="size-3.5 text-green-500" />
                  En {kmProximo.toLocaleString()} km
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * FINANZAS — Flujo de Caja
 * Proyección de entradas/salidas y análisis de liquidez
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import {
  TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight,
  Download, RefreshCw, Calendar, BarChart3, Wallet
} from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { toast } from 'sonner';

interface FlujoCajaProps {
  onNavigate?: (route: string) => void;
}

interface Transaccion {
  id: string;
  tipo: 'ingreso' | 'egreso' | 'transferencia';
  monto: number;
  fecha: string;
  descripcion: string;
  estado: string;
  categoria?: string;
}

interface PuntoFlujo {
  mes: string;
  ingresos: number;
  egresos: number;
  balance: number;
  acumulado: number;
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function formatMoney(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getMesLabel(isoDate: string) {
  const d = new Date(isoDate + 'T00:00:00');
  return MESES[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
}

export function FinanzasFlujoCaja({ onNavigate }: FlujoCajaProps) {
  const { tenantId } = useAuth();
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<'6m' | '12m' | '3m'>('6m');

  const cargar = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const mesesAtras = periodo === '3m' ? 3 : periodo === '6m' ? 6 : 12;
      const desde = new Date();
      desde.setMonth(desde.getMonth() - mesesAtras);
      const desdeStr = desde.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('transacciones')
        .select('id, tipo, monto, fecha, descripcion, estado, categoria')
        .gte('fecha', desdeStr)
        .in('estado', ['aprobada', 'pagada', 'pendiente'])
        .order('fecha', { ascending: true });

      if (error) throw error;
      setTransacciones((data as Transaccion[]) ?? []);
    } catch (e: any) {
      toast.error('Error al cargar transacciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [tenantId, periodo]);

  // Agrupar por mes
  const flujoPorMes = useMemo((): PuntoFlujo[] => {
    const mapa = new Map<string, { ingresos: number; egresos: number }>();
    transacciones.forEach(t => {
      const key = t.fecha.slice(0, 7); // YYYY-MM
      if (!mapa.has(key)) mapa.set(key, { ingresos: 0, egresos: 0 });
      const entry = mapa.get(key)!;
      if (t.tipo === 'ingreso') entry.ingresos += t.monto;
      else if (t.tipo === 'egreso') entry.egresos += t.monto;
    });

    const sorted = Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b));
    let acumulado = 0;
    return sorted.map(([mes, { ingresos, egresos }]) => {
      const balance = ingresos - egresos;
      acumulado += balance;
      return {
        mes: getMesLabel(mes + '-01'),
        ingresos: Math.round(ingresos * 100) / 100,
        egresos: Math.round(egresos * 100) / 100,
        balance: Math.round(balance * 100) / 100,
        acumulado: Math.round(acumulado * 100) / 100,
      };
    });
  }, [transacciones]);

  const totalIngresos = transacciones.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0);
  const totalEgresos = transacciones.filter(t => t.tipo === 'egreso').reduce((s, t) => s + t.monto, 0);
  const balance = totalIngresos - totalEgresos;

  const exportCSV = () => {
    const rows = [
      ['Mes', 'Ingresos', 'Egresos', 'Balance', 'Acumulado'],
      ...flujoPorMes.map(p => [p.mes, p.ingresos, p.egresos, p.balance, p.acumulado])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'flujo-caja.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wallet className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Flujo de Caja</h1>
            <p className="text-sm text-muted-foreground">Análisis de liquidez y proyección financiera</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">3 meses</SelectItem>
              <SelectItem value="6m">6 meses</SelectItem>
              <SelectItem value="12m">12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={cargar} disabled={loading}>
            <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="size-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <ArrowUpRight className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Ingresos</p>
                <p className="text-xl font-bold text-green-600">{formatMoney(totalIngresos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <ArrowDownRight className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Egresos</p>
                <p className="text-xl font-bold text-red-600">{formatMoney(totalEgresos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${balance >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                <DollarSign className={`size-5 ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Balance Neto</p>
                <p className={`text-xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {formatMoney(balance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            Evolución del Flujo de Caja
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Cargando...</div>
          ) : flujoPorMes.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Wallet className="size-10 opacity-30" />
              <p className="text-sm">No hay transacciones en este período</p>
              <Button size="sm" variant="outline" onClick={() => onNavigate?.('/finanzas/transacciones')}>
                Registrar transacción
              </Button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={flujoPorMes} margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number, name: string) => [formatMoney(v), name === 'ingresos' ? 'Ingresos' : name === 'egresos' ? 'Egresos' : 'Acumulado']} />
                <Legend />
                <Area type="monotone" dataKey="ingresos" stackId="none" stroke="#22c55e" fill="#22c55e20" name="ingresos" />
                <Area type="monotone" dataKey="egresos" stackId="none" stroke="#ef4444" fill="#ef444420" name="egresos" />
                <Area type="monotone" dataKey="acumulado" stackId="none" stroke="#0A66C2" fill="#0A66C220" name="acumulado" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabla mensual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            Resumen Mensual
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {flujoPorMes.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Sin datos para el período seleccionado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Egresos</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flujoPorMes.map((p) => (
                  <TableRow key={p.mes}>
                    <TableCell className="font-medium">{p.mes}</TableCell>
                    <TableCell className="text-right text-green-600">{formatMoney(p.ingresos)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatMoney(p.egresos)}</TableCell>
                    <TableCell className={`text-right font-medium ${p.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {formatMoney(p.balance)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${p.acumulado >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                      {formatMoney(p.acumulado)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

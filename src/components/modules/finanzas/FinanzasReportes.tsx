/**
 * FINANZAS — Reportes Financieros
 * Estados financieros, P&L y análisis de presupuesto vs real
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Progress } from '../../ui/progress';
import {
  BarChart3, Download, TrendingUp, TrendingDown, DollarSign, FileBarChart,
  PieChart, CheckCircle, AlertCircle
} from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { exportToPDF } from '../../../lib/shared/export-utils';
import { useAuth } from '../../../auth/AuthProvider';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';

interface ReportesProps {
  onNavigate?: (route: string) => void;
}

interface ResumenFinanciero {
  totalIngresos: number;
  totalEgresos: number;
  utilidad: number;
  margenUtilidad: number;
  ingresosMes: number;
  egresosMes: number;
  transaccionesCount: number;
}

interface Presupuesto {
  id: string;
  nombre: string;
  monto_total: number;
  estado: string;
  tipo_periodo: string;
  periodo: string;
}

interface LineaPresupuesto {
  categoria: string;
  monto_presupuestado: number;
  monto_ejecutado: number;
}

function formatMoney(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FinanzasReportes({ onNavigate }: ReportesProps) {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState<ResumenFinanciero>({
    totalIngresos: 0, totalEgresos: 0, utilidad: 0, margenUtilidad: 0,
    ingresosMes: 0, egresosMes: 0, transaccionesCount: 0,
  });
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [lineas, setLineas] = useState<LineaPresupuesto[]>([]);
  const [anio, setAnio] = useState(new Date().getFullYear().toString());

  const cargar = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const mesActual = new Date().toISOString().slice(0, 7);
      const inicioAnio = `${anio}-01-01`;
      const finAnio = `${anio}-12-31`;
      const desdeEsteMs = `${mesActual}-01`;

      const [resTx, resTxMes, resPres, resLineas] = await Promise.all([
        supabase.from('transacciones')
          .select('tipo, monto, estado')
          .gte('fecha', inicioAnio).lte('fecha', finAnio)
          .in('estado', ['aprobada', 'pagada']),
        supabase.from('transacciones')
          .select('tipo, monto, estado')
          .gte('fecha', desdeEsteMs)
          .in('estado', ['aprobada', 'pagada']),
        supabase.from('presupuestos')
          .select('id, nombre, monto_total, estado, tipo_periodo, periodo'),
        supabase.from('presupuesto_lineas')
          .select('categoria, monto_presupuestado, monto_ejecutado'),
      ]);

      const txs = (resTx.data ?? []) as Array<{ tipo: string; monto: number; estado: string }>;
      const txsMes = (resTxMes.data ?? []) as Array<{ tipo: string; monto: number }>;

      const totalIngresos = txs.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0);
      const totalEgresos = txs.filter(t => t.tipo === 'egreso').reduce((s, t) => s + t.monto, 0);
      const utilidad = totalIngresos - totalEgresos;

      setResumen({
        totalIngresos,
        totalEgresos,
        utilidad,
        margenUtilidad: totalIngresos > 0 ? (utilidad / totalIngresos) * 100 : 0,
        ingresosMes: txsMes.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0),
        egresosMes: txsMes.filter(t => t.tipo === 'egreso').reduce((s, t) => s + t.monto, 0),
        transaccionesCount: txs.length,
      });

      setPresupuestos((resPres.data ?? []) as Presupuesto[]);

      // Agrupar líneas por categoría
      const lineasMap = new Map<string, { presupuestado: number; ejecutado: number }>();
      ((resLineas.data ?? []) as LineaPresupuesto[]).forEach(l => {
        const prev = lineasMap.get(l.categoria) ?? { presupuestado: 0, ejecutado: 0 };
        lineasMap.set(l.categoria, {
          presupuestado: prev.presupuestado + (l.monto_presupuestado ?? 0),
          ejecutado: prev.ejecutado + (l.monto_ejecutado ?? 0),
        });
      });
      setLineas(Array.from(lineasMap.entries()).map(([cat, v]) => ({
        categoria: cat,
        monto_presupuestado: v.presupuestado,
        monto_ejecutado: v.ejecutado,
      })));
    } catch (e: any) {
      toast.error('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [tenantId, anio]);

  const chartData = lineas.slice(0, 8).map(l => ({
    name: l.categoria.length > 14 ? l.categoria.slice(0, 14) + '…' : l.categoria,
    Presupuestado: l.monto_presupuestado,
    Ejecutado: l.monto_ejecutado,
  }));

  const exportPDF = () => {
    exportToPDF(
      `reporte-financiero-${anio}`,
      `Reporte Financiero ${anio}`,
      lineas.map(l => ({
        categoria: l.categoria,
        presupuestado: `S/ ${l.monto_presupuestado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
        ejecutado: `S/ ${l.monto_ejecutado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
        ejecucion: l.monto_presupuestado > 0 ? ((l.monto_ejecutado / l.monto_presupuestado) * 100).toFixed(1) + '%' : '—',
      })),
      { categoria: 'Categoría', presupuestado: 'Presupuestado', ejecutado: 'Ejecutado', ejecucion: '% Ejecución' }
    );
  };

  const exportCSV = () => {
    const rows = [
      ['Categoría', 'Presupuestado', 'Ejecutado', '% Ejecución'],
      ...lineas.map(l => [
        l.categoria,
        l.monto_presupuestado,
        l.monto_ejecutado,
        l.monto_presupuestado > 0 ? ((l.monto_ejecutado / l.monto_presupuestado) * 100).toFixed(1) + '%' : '—'
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reporte-financiero-${anio}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileBarChart className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reportes Financieros</h1>
            <p className="text-sm text-muted-foreground">Estados financieros y análisis de presupuesto vs real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={anio} onValueChange={setAnio}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="size-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <Download className="size-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pyg">
        <TabsList>
          <TabsTrigger value="pyg">P&amp;G</TabsTrigger>
          <TabsTrigger value="presupuesto">Presupuesto vs Real</TabsTrigger>
          <TabsTrigger value="resumen">Resumen Ejecutivo</TabsTrigger>
        </TabsList>

        {/* P&G */}
        <TabsContent value="pyg" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Ingresos', value: resumen.totalIngresos, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
              { label: 'Egresos', value: resumen.totalEgresos, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
              { label: 'Utilidad Neta', value: resumen.utilidad, color: resumen.utilidad >= 0 ? 'text-blue-600' : 'text-orange-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: 'Margen', value: null, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', suffix: `${resumen.margenUtilidad.toFixed(1)}%` },
            ].map((kpi) => (
              <Card key={kpi.label} className="border-0 shadow-sm">
                <CardContent className={`p-4 rounded-lg ${kpi.bg}`}>
                  <p className="text-xs text-muted-foreground mb-1">{kpi.label} {anio}</p>
                  <p className={`text-lg font-bold ${kpi.color}`}>
                    {kpi.suffix ?? formatMoney(kpi.value!)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Estado de Resultados — {anio}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-semibold">Ingresos Operativos</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">{formatMoney(resumen.totalIngresos)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">Mes actual</TableCell>
                    <TableCell className="text-right text-green-600">{formatMoney(resumen.ingresosMes)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-semibold">Egresos Operativos</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">({formatMoney(resumen.totalEgresos)})</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">Mes actual</TableCell>
                    <TableCell className="text-right text-red-600">({formatMoney(resumen.egresosMes)})</TableCell>
                  </TableRow>
                  <TableRow className="border-t-2 border-border">
                    <TableCell className="font-bold text-base">Utilidad Neta</TableCell>
                    <TableCell className={`text-right font-bold text-base ${resumen.utilidad >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatMoney(resumen.utilidad)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Margen de utilidad</TableCell>
                    <TableCell className="text-right text-muted-foreground">{resumen.margenUtilidad.toFixed(1)}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">N° de transacciones</TableCell>
                    <TableCell className="text-right text-muted-foreground">{resumen.transaccionesCount}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Presupuesto vs Real */}
        <TabsContent value="presupuesto" className="space-y-4 pt-4">
          {lineas.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <BarChart3 className="size-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No hay presupuestos con líneas configuradas</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => onNavigate?.('/finanzas/presupuestos')}>
                  Crear presupuesto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Presupuesto vs Ejecución por Categoría</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData} margin={{ top: 4, right: 20, left: 10, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatMoney(v)} />
                      <Legend />
                      <Bar dataKey="Presupuestado" fill="#0A66C240" stroke="#0A66C2" radius={[4,4,0,0]} />
                      <Bar dataKey="Ejecutado" fill="#0A66C2" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Presupuestado</TableHead>
                        <TableHead className="text-right">Ejecutado</TableHead>
                        <TableHead className="text-right">% Ejecución</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineas.map(l => {
                        const pct = l.monto_presupuestado > 0 ? (l.monto_ejecutado / l.monto_presupuestado) * 100 : 0;
                        return (
                          <TableRow key={l.categoria}>
                            <TableCell className="font-medium capitalize">{l.categoria}</TableCell>
                            <TableCell className="text-right">{formatMoney(l.monto_presupuestado)}</TableCell>
                            <TableCell className="text-right">{formatMoney(l.monto_ejecutado)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <Progress value={Math.min(pct, 100)} className="w-16 h-1.5" />
                                <span className={`text-xs font-medium ${pct > 90 ? 'text-red-600' : pct > 70 ? 'text-orange-600' : 'text-green-600'}`}>
                                  {pct.toFixed(1)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {pct > 100 ? (
                                <Badge variant="destructive" className="text-xs">Excedido</Badge>
                              ) : pct > 90 ? (
                                <Badge className="bg-orange-100 text-orange-800 text-xs">En límite</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800 text-xs">Normal</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Resumen Ejecutivo */}
        <TabsContent value="resumen" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="size-4 text-green-600" />
                  Indicadores Clave — {anio}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Ratio Ingreso/Egreso', value: resumen.totalEgresos > 0 ? (resumen.totalIngresos / resumen.totalEgresos).toFixed(2) : '—', good: Number(resumen.totalEgresos > 0 ? resumen.totalIngresos / resumen.totalEgresos : 0) >= 1 },
                  { label: 'Margen de Utilidad', value: resumen.margenUtilidad.toFixed(1) + '%', good: resumen.margenUtilidad > 10 },
                  { label: 'Transacciones Totales', value: resumen.transaccionesCount.toString(), good: true },
                  { label: 'Presupuestos activos', value: presupuestos.filter(p => p.estado === 'activo' || p.estado === 'aprobado').length.toString(), good: true },
                ].map(ind => (
                  <div key={ind.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{ind.label}</span>
                    <div className="flex items-center gap-2">
                      {ind.good ? (
                        <CheckCircle className="size-3.5 text-green-500" />
                      ) : (
                        <AlertCircle className="size-3.5 text-orange-500" />
                      )}
                      <span className="font-semibold text-sm">{ind.value}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileBarChart className="size-4 text-primary" />
                  Presupuestos del Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                {presupuestos.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">Sin presupuestos configurados</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => onNavigate?.('/finanzas/presupuestos')}>
                      Crear presupuesto
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {presupuestos.slice(0, 5).map(p => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                        <div>
                          <p className="text-sm font-medium">{p.nombre}</p>
                          <p className="text-xs text-muted-foreground">{p.tipo_periodo} · {p.periodo}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatMoney(p.monto_total)}</p>
                          <Badge variant={p.estado === 'aprobado' ? 'default' : 'secondary'} className="text-xs">
                            {p.estado}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

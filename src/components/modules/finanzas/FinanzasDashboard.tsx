import { useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, AlertCircle,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useFinanzas } from '@/lib/finanzas/finanzas-store';

interface Props {
  onNavigate: (route: string) => void;
}

const COLORS = ['#0A66C2', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'];

function fmt(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FinanzasDashboard({ onNavigate }: Props) {
  const { transacciones, loading } = useFinanzas();

  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const anioActual = hoy.getFullYear();

  const mesLabel = hoy.toLocaleString('es-PE', { month: 'long', year: 'numeric' });

  const trxMes = useMemo(() =>
    transacciones.filter(t => {
      const d = new Date(t.fecha);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    }),
    [transacciones, mesActual, anioActual]
  );

  const ingresosMes = useMemo(() =>
    trxMes.filter(t => t.tipo === 'ingreso' && t.estado !== 'anulada').reduce((s, t) => s + t.monto, 0),
    [trxMes]
  );

  const egresosMes = useMemo(() =>
    trxMes.filter(t => t.tipo === 'egreso' && t.estado !== 'anulada').reduce((s, t) => s + t.monto, 0),
    [trxMes]
  );

  const balance = ingresosMes - egresosMes;

  const pendientesAprobacion = useMemo(() =>
    transacciones.filter(t => t.estado === 'pendiente').length,
    [transacciones]
  );

  // Últimos 6 meses
  const ultimos6Meses = useMemo(() => {
    const meses: { mes: string; ingresos: number; egresos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anioActual, mesActual - i, 1);
      const m = d.getMonth();
      const a = d.getFullYear();
      const label = d.toLocaleString('es-PE', { month: 'short' });
      const ing = transacciones
        .filter(t => {
          const td = new Date(t.fecha);
          return td.getMonth() === m && td.getFullYear() === a && t.tipo === 'ingreso' && t.estado !== 'anulada';
        })
        .reduce((s, t) => s + t.monto, 0);
      const egr = transacciones
        .filter(t => {
          const td = new Date(t.fecha);
          return td.getMonth() === m && td.getFullYear() === a && t.tipo === 'egreso' && t.estado !== 'anulada';
        })
        .reduce((s, t) => s + t.monto, 0);
      meses.push({ mes: label, ingresos: ing, egresos: egr });
    }
    return meses;
  }, [transacciones, mesActual, anioActual]);

  // Egresos por categoría (mes actual)
  const egresosPorCategoria = useMemo(() => {
    const map = new Map<string, number>();
    trxMes
      .filter(t => t.tipo === 'egreso' && t.estado !== 'anulada')
      .forEach(t => {
        map.set(t.categoria, (map.get(t.categoria) ?? 0) + t.monto);
      });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [trxMes]);

  // Top 5 egresos recientes
  const top5Egresos = useMemo(() =>
    transacciones
      .filter(t => t.tipo === 'egreso' && t.estado !== 'anulada')
      .slice(0, 5),
    [transacciones]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Cargando datos financieros...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Dashboard Financiero</h2>
        <p className="text-muted-foreground mt-1 capitalize">{mesLabel}</p>
      </div>

      {/* Alerta pendientes */}
      {pendientesAprobacion > 0 && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertCircle className="size-5 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Hay <strong>{pendientesAprobacion}</strong> transacciones pendientes de aprobación.
            <button
              className="ml-2 underline font-medium"
              onClick={() => onNavigate('/finanzas/transacciones')}
            >
              Revisar
            </button>
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ingresos del Mes</CardTitle>
            <TrendingUp className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fmt(ingresosMes)}</div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <ArrowUpRight className="size-3" />
              <span>Mes actual</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Egresos del Mes</CardTitle>
            <TrendingDown className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{fmt(egresosMes)}</div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <ArrowDownRight className="size-3" />
              <span>Mes actual</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Balance</CardTitle>
            <DollarSign className={`size-4 ${balance >= 0 ? 'text-green-600' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {fmt(balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ingresos − Egresos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pendientes Aprobación</CardTitle>
            <AlertCircle className={`size-4 ${pendientesAprobacion > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${pendientesAprobacion > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
              {pendientesAprobacion}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Transacciones</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Barras: Ingresos vs Egresos */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ingresos vs Egresos — Últimos 6 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            {transacciones.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Sin transacciones registradas
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={ultimos6Meses}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `S/${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(val: number) => fmt(val)} />
                  <Legend />
                  <Bar dataKey="ingresos" fill="#10B981" name="Ingresos" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="egresos" fill="#EF4444" name="Egresos" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Dona: Egresos por Categoría */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Egresos por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            {egresosPorCategoria.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Sin egresos este mes
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={egresosPorCategoria}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {egresosPorCategoria.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => fmt(val)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {egresosPorCategoria.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="truncate max-w-[100px]">{item.name}</span>
                      </div>
                      <span className="font-medium">{fmt(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 5 Egresos Recientes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Top 5 Egresos Recientes</CardTitle>
          <button
            className="text-xs text-primary underline"
            onClick={() => onNavigate('/finanzas/transacciones')}
          >
            Ver todos
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {top5Egresos.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Sin egresos registrados.</p>
          ) : (
            <div className="divide-y divide-border">
              {top5Egresos.map(t => (
                <div key={t._dbId} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{t.descripcion}</p>
                    <p className="text-xs text-muted-foreground">{t.categoria} · {t.fecha}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-500">{fmt(t.monto)}</p>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        t.estado === 'pagada' ? 'border-green-500 text-green-700' :
                        t.estado === 'aprobada' ? 'border-blue-500 text-blue-700' :
                        t.estado === 'pendiente' ? 'border-yellow-500 text-yellow-700' :
                        'border-gray-400 text-gray-600'
                      }`}
                    >
                      {t.estado}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

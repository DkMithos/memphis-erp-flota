import { useMemo } from 'react';
import { Package, AlertTriangle, TrendingDown, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import { useInventarioStore } from '../../../lib/inventario/inventario-store';
import { PageNav } from '../../shared/PageNav';

interface Props {
  onNavigate: (route: string) => void;
}

export function InventarioDashboard({ onNavigate }: Props) {
  const { articulos, loading } = useInventarioStore();

  const stats = useMemo(() => {
    const total = articulos.filter(a => a.activo).length;
    const criticos = articulos.filter(a => a.estadoStock === 'critico').length;
    const bajos = articulos.filter(a => a.estadoStock === 'bajo').length;
    const valorTotal = articulos.reduce((sum, a) => sum + (a.valorTotal ?? 0), 0);
    return { total, criticos, bajos, valorTotal };
  }, [articulos]);

  const top10PorValor = useMemo(() => {
    return [...articulos]
      .filter(a => a.valorTotal != null && a.valorTotal > 0)
      .sort((a, b) => (b.valorTotal ?? 0) - (a.valorTotal ?? 0))
      .slice(0, 10);
  }, [articulos]);

  const alertas = useMemo(() => {
    return articulos
      .filter(a => a.estadoStock === 'critico' || a.estadoStock === 'bajo')
      .sort((a, b) => a.stockActual - b.stockActual)
      .slice(0, 20);
  }, [articulos]);

  // Group by category for bar chart
  const porCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    articulos.forEach(a => {
      const cat = a.categoriaNombre ?? 'Sin categoría';
      map[cat] = (map[cat] ?? 0) + 1;
    });
    return Object.entries(map).map(([categoria, cantidad]) => ({ categoria, cantidad }));
  }, [articulos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Cargando inventario...
      </div>
    );
  }

  const formatMoney = (v: number) =>
    v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
          <Package className="size-6 text-black dark:text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Inventario</h2>
          <p className="text-muted-foreground mt-1">Control de stock, artículos y movimientos de almacén</p>
        </div>
      </div>

      {/* KPIs — patrón Home */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:border-[#f0c000] hover:shadow-sm transition-colors"
          onClick={() => onNavigate('/inventario/articulos')}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-slate-500 rounded-lg flex items-center justify-center shrink-0">
              <Package className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Artículos</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-red-500 rounded-lg flex items-center justify-center shrink-0">
              <AlertTriangle className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stock Crítico</p>
              <p className="text-2xl font-bold">{stats.criticos}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
              <TrendingDown className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bajo Mínimo</p>
              <p className="text-2xl font-bold">{stats.bajos}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
              <DollarSign className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-2xl font-bold">S/ {formatMoney(stats.valorTotal)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Artículos por categoría */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Artículos por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            {porCategoria.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={porCategoria} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="categoria" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#0A66C2" radius={[3, 3, 0, 0]} name="Artículos" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Alertas de stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas de Stock</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {alertas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin alertas activas</p>
            ) : (
              <div className="divide-y divide-border max-h-[260px] overflow-y-auto">
                {alertas.map(a => (
                  <div key={a._dbId} className="flex items-center justify-between px-4 py-2 hover:bg-muted/40">
                    <div>
                      <p className="text-sm font-medium">{a.nombre}</p>
                      <p className="text-xs text-muted-foreground">{a.id} · Stock: {a.stockActual} / Mín: {a.stockMinimo} {a.unidadMedida}</p>
                    </div>
                    {a.estadoStock === 'critico' ? (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 shrink-0">Crítico</Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100 shrink-0">Bajo</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 10 por valor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 Artículos por Valor</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {top10PorValor.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos de valorización</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">P. Unit.</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top10PorValor.map(a => (
                  <TableRow key={a._dbId}>
                    <TableCell className="font-medium text-sm">{a.id}</TableCell>
                    <TableCell className="text-sm">{a.nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.categoriaNombre ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm">{a.stockActual} {a.unidadMedida}</TableCell>
                    <TableCell className="text-right text-sm">S/ {a.precioUnitario?.toFixed(2) ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">S/ {formatMoney(a.valorTotal ?? 0)}</TableCell>
                    <TableCell>
                      {a.estadoStock === 'normal' && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">Normal</Badge>}
                      {a.estadoStock === 'bajo' && <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100">Bajo</Badge>}
                      {a.estadoStock === 'critico' && <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100">Crítico</Badge>}
                      {a.estadoStock === 'sobrestock' && <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100">Sobrestock</Badge>}
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

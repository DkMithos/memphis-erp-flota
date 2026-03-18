/**
 * PROYECTOS — Valorizaciones
 * Control de avance financiero por proyecto y fase
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Calculator, TrendingUp, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';
import { toast } from 'sonner';

interface ValorizacionesProps { onNavigate?: (route: string) => void; }

interface ProyectoValorizacion {
  id: string;
  nombre: string;
  codigo: string;
  presupuesto: number;
  costoReal: number;
  avancePct: number;
  estado: string;
  fechaInicio?: string;
  fechaFin?: string;
}

function formatMoney(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ProyectosValorizaciones({ onNavigate }: ValorizacionesProps) {
  const { tenantId } = useAuth();
  const [proyectos, setProyectos] = useState<ProyectoValorizacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const cargar = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('proyectos')
          .select('id, nombre, codigo, presupuesto, costo_real, avance_pct, estado, fecha_inicio, fecha_fin')
          .order('nombre');
        if (error) throw error;
        setProyectos((data ?? []).map((p: any) => ({
          id: p.id, nombre: p.nombre, codigo: p.codigo,
          presupuesto: p.presupuesto ?? 0,
          costoReal: p.costo_real ?? 0,
          avancePct: p.avance_pct ?? 0,
          estado: p.estado,
          fechaInicio: p.fecha_inicio,
          fechaFin: p.fecha_fin,
        })));
      } catch (e: any) {
        toast.error('Error al cargar valorizaciones');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [tenantId]);

  const totalPresupuesto = proyectos.reduce((s, p) => s + p.presupuesto, 0);
  const totalEjecutado = proyectos.reduce((s, p) => s + p.costoReal, 0);
  const variacion = totalPresupuesto - totalEjecutado;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calculator className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Valorizaciones</h1>
            <p className="text-sm text-muted-foreground">Control de avance financiero por proyecto</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onNavigate?.('/proyectos/lista')}>
          Ver proyectos
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground">Presupuesto Total</p>
          <p className="text-xl font-bold text-primary">{formatMoney(totalPresupuesto)}</p>
          <p className="text-xs text-muted-foreground mt-1">{proyectos.length} proyectos</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground">Costo Ejecutado</p>
          <p className="text-xl font-bold">{formatMoney(totalEjecutado)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalPresupuesto > 0 ? ((totalEjecutado / totalPresupuesto) * 100).toFixed(1) : 0}% del presupuesto
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground">Variación Presupuestal</p>
          <p className={`text-xl font-bold ${variacion >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(Math.abs(variacion))}</p>
          <p className="text-xs text-muted-foreground mt-1">{variacion >= 0 ? 'Bajo presupuesto' : 'Sobre presupuesto'}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Avance Financiero por Proyecto</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Cargando...</div>
          ) : proyectos.length === 0 ? (
            <div className="py-12 text-center">
              <Calculator className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No hay proyectos registrados</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => onNavigate?.('/proyectos/lista')}>
                Crear proyecto
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead className="text-right">Presupuesto</TableHead>
                  <TableHead className="text-right">Ejecutado</TableHead>
                  <TableHead>Avance Físico</TableHead>
                  <TableHead className="text-right">Variación</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proyectos.map(p => {
                  const varP = p.presupuesto - p.costoReal;
                  return (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onNavigate?.(`/proyectos/detalle/${p.id}`)}>
                      <TableCell>
                        <p className="font-medium">{p.nombre}</p>
                        <p className="text-xs text-muted-foreground">{p.codigo}</p>
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(p.presupuesto)}</TableCell>
                      <TableCell className="text-right">{formatMoney(p.costoReal)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={p.avancePct} className="w-20 h-1.5" />
                          <span className="text-xs font-medium">{p.avancePct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${varP >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {varP >= 0 ? '+' : ''}{formatMoney(varP)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.estado === 'completado' ? 'default' : p.estado === 'en_ejecucion' ? 'secondary' : 'outline'} className="text-xs capitalize">
                          {p.estado?.replace('_', ' ') ?? '—'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

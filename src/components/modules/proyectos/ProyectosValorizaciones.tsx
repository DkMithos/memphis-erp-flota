/**
 * PROYECTOS — Valorizaciones
 * Control de avance financiero por proyecto y fase
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Calculator, TrendingUp, DollarSign, TrendingDown } from 'lucide-react';
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
          .select('id, nombre, codigo, presupuesto, costo_real, porcentaje_avance, estado, fecha_inicio, fecha_fin_estimada')
          .order('nombre');
        if (error) throw error;
        setProyectos((data ?? []).map((p: any) => ({
          id: p.id, nombre: p.nombre, codigo: p.codigo,
          presupuesto: p.presupuesto ?? 0,
          costoReal: p.costo_real ?? 0,
          avancePct: p.porcentaje_avance ?? 0,
          estado: p.estado,
          fechaInicio: p.fecha_inicio,
          fechaFin: p.fecha_fin_estimada,
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
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <Calculator className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Valorizaciones</h1>
            <p className="text-sm text-muted-foreground">Control de avance financiero por proyecto</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onNavigate?.('/proyectos/lista')} className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
          Ver proyectos
        </Button>
      </div>

      {/* KPIs — patrón Home */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
              <DollarSign className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Presupuesto Total</p>
              <p className="text-2xl font-bold">{formatMoney(totalPresupuesto)}</p>
              <p className="text-xs text-muted-foreground mt-1">{proyectos.length} proyectos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
              <TrendingUp className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Costo Ejecutado</p>
              <p className="text-2xl font-bold">{formatMoney(totalEjecutado)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {totalPresupuesto > 0 ? ((totalEjecutado / totalPresupuesto) * 100).toFixed(1) : 0}% del presupuesto
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${variacion >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
              {variacion >= 0
                ? <TrendingDown className="size-5 text-white" />
                : <TrendingUp className="size-5 text-white" />
              }
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Variación Presupuestal</p>
              <p className="text-2xl font-bold">{formatMoney(Math.abs(variacion))}</p>
              <p className="text-xs text-muted-foreground mt-1">{variacion >= 0 ? 'Bajo presupuesto' : 'Sobre presupuesto'}</p>
            </div>
          </CardContent>
        </Card>
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

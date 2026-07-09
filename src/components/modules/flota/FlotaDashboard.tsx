/**
 * Flota → Dashboard (rediseño 2026-07)
 * Resumen por flota: unidades, cumplimiento de mantenimientos y
 * consumo de la provisión (gastado vs provisionado = ahorro).
 */
import { Truck, Bike, Layers, Wrench, PiggyBank, TrendingUp, ArrowRight, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
import { PageNav } from '../../shared/PageNav';
import { useFlotas, fmtMoneda } from '../../../lib/flota/flotas-store';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useProyectos } from '../../../lib/proyectos/proyectos-store';

interface Props { onNavigate: (route: string) => void; }

const ICONO_TIPO: Record<string, JSX.Element> = {
  camioneta: <Truck className="size-5 text-white" />,
  moto: <Bike className="size-5 text-white" />,
};

export function FlotaDashboard({ onNavigate }: Props) {
  const { flotas, loading, consumoPorFlota } = useFlotas();
  const { vehiculos } = useVehiculos();
  const { proyectos } = useProyectos();

  const nombreProyecto = (id: string) =>
    (proyectos as any[]).find(p => p._dbId === id)?.nombre ?? '—';

  const administrativos = vehiculos.filter(v => v.esAdministrativo && v.estado === 'activo');
  const activos = vehiculos.filter(v => v.estado === 'activo');

  // Totales globales (montos se muestran por flota, cada una en su moneda)
  const resumen = flotas.map(f => ({ flota: f, c: consumoPorFlota(f.id) }));
  const totalUnidades = resumen.reduce((s, r) => s + r.c.unidades, 0);
  const totalEjecutados = resumen.reduce((s, r) => s + r.c.ejecutados, 0);
  const totalContratados = resumen.reduce((s, r) => s + r.c.contratados, 0);

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <Truck className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Flota</h2>
            <p className="text-muted-foreground mt-1">
              Flotas por proyecto, contratos de mantenimiento y consumo de la provisión
            </p>
          </div>
        </div>
        <Button onClick={() => onNavigate('/flota/flotas')}>
          Ver flotas <ArrowRight className="size-4" />
        </Button>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
              <Layers className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Flotas</p>
              <p className="text-2xl font-bold">{flotas.length}</p>
              <p className="text-xs text-muted-foreground mt-1">{totalUnidades} unidades en flotas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-green-500 rounded-lg flex items-center justify-center shrink-0">
              <Truck className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vehículos activos</p>
              <p className="text-2xl font-bold">{activos.length}</p>
              <p className="text-xs text-muted-foreground mt-1">{vehiculos.length} registrados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
              <Wrench className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mantenimientos ejecutados</p>
              <p className="text-2xl font-bold">{totalEjecutados.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                de {totalContratados.toLocaleString()} contratados
                {totalContratados > 0 && ` (${((totalEjecutados / totalContratados) * 100).toFixed(1)}%)`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
              <Shield className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vehículos administrativos</p>
              <p className="text-2xl font-bold">{administrativos.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Seguimiento documentario</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tarjetas por flota */}
      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Cargando flotas…</CardContent></Card>
      ) : flotas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay flotas registradas todavía.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {resumen.map(({ flota, c }) => {
            const cumplimiento = c.contratados > 0 ? (c.ejecutados / c.contratados) * 100 : 0;
            const consumoPct = c.provision > 0 ? (c.gastado / c.provision) * 100 : 0;
            const contrato = flota.contratos.find(x => x.estado === 'activo') ?? flota.contratos[0];
            return (
              <Card
                key={flota.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onNavigate(`/flota/flotas/${flota.codigo}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="size-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
                        {ICONO_TIPO[flota.tipo] ?? <Truck className="size-5 text-white" />}
                      </div>
                      <div>
                        <CardTitle className="text-base">{flota.nombre}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {flota.codigo} · {nombreProyecto(flota.proyectoId)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">{c.unidades} unidades</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Cumplimiento de mantenimientos</span>
                      <span className="font-medium">
                        {c.ejecutados.toLocaleString()} / {c.contratados.toLocaleString()} ({cumplimiento.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={Math.min(cumplimiento, 100)} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Consumo de la provisión</span>
                      <span className="font-medium">{consumoPct.toFixed(1)}%</span>
                    </div>
                    <Progress value={Math.min(consumoPct, 100)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <p className="text-xs text-muted-foreground">Provisionado</p>
                      <p className="text-sm font-semibold">{fmtMoneda(c.provision, c.moneda)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gastado</p>
                      <p className="text-sm font-semibold">{fmtMoneda(c.gastado, c.moneda)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <PiggyBank className="size-3" /> Saldo (ahorro potencial)
                      </p>
                      <p className="text-sm font-semibold text-green-600 dark:text-green-500">
                        {fmtMoneda(c.saldo, c.moneda)}
                      </p>
                    </div>
                  </div>
                  {contrato && (
                    <p className="text-xs text-muted-foreground border-t pt-2 flex items-center gap-1">
                      <TrendingUp className="size-3" />
                      {contrato.proveedorNombre ?? contrato.nombre} · {contrato.modalidadPago === 'adelantado' ? 'pago adelantado' : 'pago mensual'}
                      {contrato.kmLimite ? ` · hasta ${contrato.kmLimite.toLocaleString()} km` : ''}
                      {contrato.cantidadServicios ? ` · ${contrato.cantidadServicios} servicios/unidad` : ''}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

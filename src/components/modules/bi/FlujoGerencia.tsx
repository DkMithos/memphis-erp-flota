/**
 * Flujo Gerencia — el tablero que reemplaza al Flujo GM.
 *
 * Fase 1: lo que se puede sostener con los datos que ya están migrados —
 * compromiso mensual, por proyecto, por centro de costo y concentración de
 * proveedores.
 *
 * Lo que NO está y se dice en pantalla: deuda, vencido y calendario de pagos.
 * Esas cifras salen de facturas, y `comprobantes_pago` está vacía hasta que
 * exista el módulo de CxP. Se rotula el hueco en vez de mostrar S/0, porque un
 * cero donde hay millones invita a decidir mal.
 */
import { useMemo } from 'react';
import {
  TrendingUp, Building2, Landmark, Users, AlertCircle, Wallet,
} from 'lucide-react';
import { PageNav } from '../../shared/PageNav';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import { BotonExportar } from '../../shared/BotonExportar';
import { useGerencia, concentracion } from '../../../lib/bi/gerencia-store';

const money = (n: number, sim: string) =>
  `${sim} ${Math.round(n).toLocaleString('es-PE')}`;

const mesLegible = (m: string) => {
  const [a, mm] = m.split('-');
  const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${nombres[Number(mm) - 1] ?? mm} ${a.slice(2)}`;
};

export function FlujoGerencia() {
  const { meses, proyectos, centros, proveedores, loading } = useGerencia();

  const ultimos = useMemo(() => meses.slice(-12), [meses]);
  const maxMes = useMemo(
    () => Math.max(1, ...ultimos.map(m => m.pen + m.usd)),
    [ultimos],
  );

  const totales = useMemo(() => {
    const pen = proyectos.reduce((s, p) => s + p.comprometidoPen, 0);
    const usd = proyectos.reduce((s, p) => s + p.comprometidoUsd, 0);
    const presupuesto = proyectos.reduce((s, p) => s + (p.presupuesto ?? 0), 0);
    const sinPresupuesto = proyectos.filter(p => !p.presupuesto).length;
    return { pen, usd, presupuesto, sinPresupuesto };
  }, [proyectos]);

  const conc = useMemo(() => concentracion(proveedores, 10), [proveedores]);
  const sinProyecto = useMemo(
    () => centros.filter(c => !c.tieneProyecto).reduce((s, c) => s + c.ordenes, 0),
    [centros],
  );

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <TrendingUp className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Flujo Gerencia</h2>
            <p className="text-muted-foreground mt-1">
              Compromiso, proyectos, áreas y proveedores
            </p>
          </div>
        </div>
        <BotonExportar
          modulo="compras" nombre="flujo-gerencia" hoja="Por proyecto"
          datos={proyectos.map(p => ({
            proyecto: p.proyecto, estado: p.estado,
            presupuesto: p.presupuesto ?? 0,
            comprometidoPen: p.comprometidoPen,
            comprometidoUsd: p.comprometidoUsd,
            ordenes: p.ordenes, avance: p.avance,
          }))}
          headers={{
            proyecto: 'Proyecto', estado: 'Estado', presupuesto: 'Presupuesto',
            comprometidoPen: 'Comprometido S/', comprometidoUsd: 'Comprometido $',
            ordenes: 'Órdenes', avance: '% avance',
          }}
        />
      </div>

      {/* Lo que todavía no se puede mostrar, dicho de frente */}
      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="p-4 flex gap-3">
          <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Falta la mitad de deuda, y es a propósito</p>
            <p className="text-muted-foreground mt-1">
              La deuda total, lo vencido y el calendario de pagos salen de las facturas de
              proveedor, que todavía no están cargadas en el sistema. Se mostrarán cuando entre el
              módulo de Cuentas por Pagar. Preferimos decirlo a enseñar S/0 donde hay millones.
            </p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Comprometido en soles</p>
                <p className="text-2xl font-semibold mt-2 tabular-nums">{money(totales.pen, 'S/')}</p>
                <p className="text-xs text-muted-foreground mt-1">órdenes vigentes con proyecto</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Comprometido en dólares</p>
                <p className="text-2xl font-semibold mt-2 tabular-nums">{money(totales.usd, '$')}</p>
                <p className="text-xs text-muted-foreground mt-1">no se suma con soles: falta el tipo de cambio</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-slate-400">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Presupuesto de proyectos</p>
                <p className="text-2xl font-semibold mt-2 tabular-nums">{money(totales.presupuesto, 'S/')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totales.sinPresupuesto > 0
                    ? `${totales.sinPresupuesto} proyecto(s) sin presupuesto cargado`
                    : 'todos con presupuesto'}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Top 10 proveedores</p>
                <p className="text-2xl font-semibold mt-2 tabular-nums">{conc.porcentaje.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  del compromiso, sobre {proveedores.length} proveedores
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Compromiso mensual */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="size-4" /> Compromiso por mes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ultimos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos.</p>
              ) : ultimos.map(m => (
                <div key={m.mes} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{mesLegible(m.mes)}</span>
                  <Progress value={((m.pen + m.usd) / maxMes) * 100} className="h-3 flex-1" />
                  <span className="text-xs tabular-nums w-28 text-right whitespace-nowrap">
                    {money(m.pen, 'S/')}
                  </span>
                  <span className="text-xs tabular-nums w-24 text-right whitespace-nowrap text-emerald-600">
                    {money(m.usd, '$')}
                  </span>
                  <span className="text-xs text-muted-foreground w-14 text-right">{m.ordenes} OC</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-2">
                Comprometido = órdenes emitidas y no anuladas. No es lo pagado: eso llega con CxP.
              </p>
            </CardContent>
          </Card>

          {/* Por proyecto */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="size-4" /> Por proyecto
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Presupuesto</TableHead>
                    <TableHead className="text-right">Comprometido S/</TableHead>
                    <TableHead className="text-right">Comprometido $</TableHead>
                    <TableHead className="text-right">OCs</TableHead>
                    <TableHead className="w-32">Avance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proyectos.map(p => (
                    <TableRow key={p.proyectoId}>
                      <TableCell className="text-sm font-medium">{p.proyecto}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{p.estado}</Badge></TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">
                        {p.presupuesto ? money(p.presupuesto, 'S/') : <span className="text-muted-foreground">sin cargar</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">{money(p.comprometidoPen, 'S/')}</TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap text-emerald-600">{money(p.comprometidoUsd, '$')}</TableCell>
                      <TableCell className="text-right text-sm">{p.ordenes}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(p.avance, 100)} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-9 text-right">{p.avance.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Por centro de costo */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Landmark className="size-4" /> Por centro de costo
              </CardTitle>
              {sinProyecto > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {sinProyecto} OC(s) en centros sin proyecto
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Centro de costo</TableHead>
                    <TableHead className="text-right">Comprometido S/</TableHead>
                    <TableHead className="text-right">Comprometido $</TableHead>
                    <TableHead className="text-right">OCs</TableHead>
                    <TableHead>Proyecto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {centros.slice(0, 15).map(c => (
                    <TableRow key={c.codigo}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{c.codigo}</div>
                        {c.nombre !== c.codigo && (
                          <div className="text-xs text-muted-foreground">{c.nombre}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">{money(c.comprometidoPen, 'S/')}</TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap text-emerald-600">{money(c.comprometidoUsd, '$')}</TableCell>
                      <TableCell className="text-right text-sm">{c.ordenes}</TableCell>
                      <TableCell>
                        {c.tieneProyecto
                          ? <Badge variant="secondary" className="text-xs">enlazado</Badge>
                          : <Badge className="text-xs bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">sin imputar</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Concentración de proveedores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-4" /> Principales proveedores
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>RUC</TableHead>
                    <TableHead className="text-right">Comprometido S/</TableHead>
                    <TableHead className="text-right">Comprometido $</TableHead>
                    <TableHead className="text-right">OCs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proveedores.slice(0, 10).map(p => (
                    <TableRow key={p.ruc ?? p.proveedor}>
                      <TableCell className="text-sm font-medium">{p.proveedor}</TableCell>
                      <TableCell className="text-sm font-mono text-xs">{p.ruc ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">{money(p.comprometidoPen, 'S/')}</TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap text-emerald-600">{money(p.comprometidoUsd, '$')}</TableCell>
                      <TableCell className="text-right text-sm">{p.ordenes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex gap-3 text-sm">
              <Wallet className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                Las cifras en soles y en dólares no se suman. El gasto de Memphis es
                mayoritariamente en dólares, así que consolidar con un tipo de cambio fijo movería
                el total en millones. El consolidado llega cuando Contabilidad confirme qué tipo de
                cambio usar.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

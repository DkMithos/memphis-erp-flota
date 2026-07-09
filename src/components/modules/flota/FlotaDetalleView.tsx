/**
 * Flota → Detalle de flota (rediseño 2026-07)
 * Contrato de mantenimiento, tarifario por km y consumo por vehículo
 * (provisión vs gastado, en precio y en cantidad).
 */
import { useState } from 'react';
import { ArrowLeft, Truck, Bike, FileText, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Progress } from '../../ui/progress';
import { PageNav } from '../../shared/PageNav';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { useFlotas, fmtMoneda } from '../../../lib/flota/flotas-store';
import { useVehiculos } from '../../../lib/flota/vehiculos-store';
import { useProyectos } from '../../../lib/proyectos/proyectos-store';
import { usePagination } from '../../../lib/shared/usePagination';

interface Props {
  codigo: string; // código o UUID de la flota
  onNavigate: (route: string) => void;
}

export function FlotaDetalleView({ codigo, onNavigate }: Props) {
  const { obtenerFlota, loading, consumoPorVehiculo, consumoPorFlota } = useFlotas();
  const { vehiculos } = useVehiculos();
  const { proyectos } = useProyectos();
  const [busqueda, setBusqueda] = useState('');

  const flota = obtenerFlota(decodeURIComponent(codigo));

  // Datos derivados (los hooks van SIEMPRE antes de cualquier return condicional)
  const unidades = (flota ? vehiculos.filter(v => v.flotaId === flota.id) : [])
    .filter(v => {
      if (!busqueda) return true;
      const q = busqueda.toLowerCase();
      return [v.placa, v.placaInterna, v.vin, v.numeroPadron, v.id]
        .some(x => x && String(x).toLowerCase().includes(q));
    })
    .sort((a, b) => (a.numeroPadron ?? a.placa ?? '').localeCompare(b.numeroPadron ?? b.placa ?? '', 'es', { numeric: true }));

  const { paged, page, totalPages, setPage } = usePagination(unidades);

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Cargando flota…</div>;
  }
  if (!flota) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => onNavigate('/flota/flotas')}>
          <ArrowLeft className="size-4" /> Volver a flotas
        </Button>
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Flota no encontrada ({codigo})
        </CardContent></Card>
      </div>
    );
  }

  const proyecto = (proyectos as any[]).find(p => p._dbId === flota.proyectoId);
  const contrato = flota.contratos.find(c => c.estado === 'activo') ?? flota.contratos[0];
  const c = consumoPorFlota(flota.id);
  const cumplimiento = c.contratados > 0 ? (c.ejecutados / c.contratados) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => onNavigate('/flota/flotas')}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            {flota.tipo === 'moto'
              ? <Bike className="size-6 text-black dark:text-primary" />
              : <Truck className="size-6 text-black dark:text-primary" />}
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{flota.nombre}</h2>
            <p className="text-muted-foreground mt-1">
              {flota.codigo} · {proyecto?.nombre ?? 'Proyecto —'} · {c.unidades} unidades
            </p>
          </div>
        </div>
        <Badge variant={flota.estado === 'activa' ? 'default' : 'secondary'} className="capitalize">{flota.estado}</Badge>
      </div>

      {/* Resumen del consumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cumplimiento</p>
            <p className="text-2xl font-bold">{cumplimiento.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">{c.ejecutados.toLocaleString()} de {c.contratados.toLocaleString()} servicios</p>
            <Progress className="mt-2" value={Math.min(cumplimiento, 100)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Provisionado</p>
            <p className="text-2xl font-bold">{fmtMoneda(c.provision, c.moneda)}</p>
            {contrato?.modalidadPago === 'adelantado' && contrato.montoPagado ? (
              <p className="text-xs text-muted-foreground mt-1">Pagado adelantado: {fmtMoneda(contrato.montoPagado, contrato.moneda)}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Pago mensual según ejecutados</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Gastado (real)</p>
            <p className="text-2xl font-bold">{fmtMoneda(c.gastado, c.moneda)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {c.provision > 0 ? `${((c.gastado / c.provision) * 100).toFixed(1)}% de la provisión` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Saldo (ahorro potencial)</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-500">{fmtMoneda(c.saldo, c.moneda)}</p>
            <p className="text-xs text-muted-foreground mt-1">Servicios no ejecutados aún</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="vehiculos">
        <TabsList>
          <TabsTrigger value="vehiculos">Vehículos ({c.unidades})</TabsTrigger>
          <TabsTrigger value="contrato">Contrato y tarifario</TabsTrigger>
        </TabsList>

        {/* TAB: vehículos con consumo */}
        <TabsContent value="vehiculos" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por placa, VIN o padrón…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Padrón</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>VIN</TableHead>
                    <TableHead className="text-right">Km</TableHead>
                    <TableHead className="text-right">Servicios</TableHead>
                    <TableHead className="text-right">Gastado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Consumo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin vehículos</TableCell></TableRow>
                  ) : paged.map(v => {
                    const cv = consumoPorVehiculo((v as any)._dbId ?? '');
                    const pct = cv?.provisionTotal ? (cv.gastado / cv.provisionTotal) * 100 : 0;
                    return (
                      <TableRow
                        key={v.id}
                        className="cursor-pointer hover:!bg-slate-100 dark:hover:!bg-accent/50"
                        onClick={() => onNavigate(`/flota/vehiculos/${v.id}`)}
                      >
                        <TableCell className="font-mono text-sm">{v.numeroPadron ?? '—'}</TableCell>
                        <TableCell>
                          <p className="font-semibold">{v.placa || 'Sin placa'}</p>
                          {v.placaInterna && <p className="text-xs text-muted-foreground">{v.placaInterna}</p>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{v.vin ?? '—'}</TableCell>
                        <TableCell className="text-right">{v.kilometraje.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {cv ? `${cv.serviciosEjecutados} / ${cv.serviciosContratados ?? '—'}` : '—'}
                        </TableCell>
                        <TableCell className="text-right">{cv ? fmtMoneda(cv.gastado, cv.moneda) : '—'}</TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-500">
                          {cv?.saldoProvision != null ? fmtMoneda(cv.saldoProvision, cv.moneda) : '—'}
                        </TableCell>
                        <TableCell className="w-32">
                          <Progress value={Math.min(pct, 100)} />
                          <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(0)}%</p>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-3 border-t">
                  <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: contrato + tarifario */}
        <TabsContent value="contrato" className="space-y-4">
          {!contrato ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Esta flota no tiene contrato de mantenimiento registrado</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="size-4" /> {contrato.nombre}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Proveedor</p>
                    <p className="font-medium">{contrato.proveedorNombre ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Modalidad de pago</p>
                    <p className="font-medium capitalize">{contrato.modalidadPago}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cobertura</p>
                    <p className="font-medium">
                      {contrato.duracionMeses ? `${contrato.duracionMeses} meses` : '—'}
                      {contrato.kmLimite ? ` o ${contrato.kmLimite.toLocaleString()} km` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">(lo que ocurra primero)</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Provisión por vehículo</p>
                    <p className="font-medium">
                      {contrato.costoTotalPorVehiculo != null ? fmtMoneda(contrato.costoTotalPorVehiculo, contrato.moneda) : '—'}
                      {contrato.cantidadServicios ? ` · ${contrato.cantidadServicios} servicios` : ''}
                    </p>
                    {contrato.moneda === 'USD' && contrato.tipoCambio && (
                      <p className="text-xs text-muted-foreground">TC provisión: {contrato.tipoCambio}</p>
                    )}
                  </div>
                  {contrato.montoPagado != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Monto pagado (contrato)</p>
                      <p className="font-medium">{fmtMoneda(contrato.montoPagado, contrato.moneda)}</p>
                    </div>
                  )}
                  {contrato.notas && (
                    <div className="col-span-2 md:col-span-4">
                      <p className="text-xs text-muted-foreground">Notas</p>
                      <p className="text-sm">{contrato.notas}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Tarifario por servicio (según km)</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead className="text-right">Km del servicio</TableHead>
                        <TableHead className="text-right">Mes estimado</TableHead>
                        <TableHead className="text-right">Costo ({contrato.moneda})</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contrato.tarifas.map(t => (
                        <TableRow key={t.id}>
                          <TableCell>{t.orden}</TableCell>
                          <TableCell className="text-right">{t.kmServicio.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{t.mesEstimado ?? '—'}</TableCell>
                          <TableCell className="text-right font-medium">{fmtMoneda(t.costo, contrato.moneda)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Fianzas — tablero de vencimientos y cadena de cartas.
 *
 * Lo que resuelve: que no se venza una carta fianza. Hoy eso depende de que
 * alguien mire el Excel; aquí lo primero que se ve es qué renueva y cuándo.
 */
import { useMemo, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, CalendarClock, Download, ChevronDown,
  Plus, FileText, Landmark, ArrowLeft, Coins,
} from 'lucide-react';
import { PageNav } from '../../shared/PageNav';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Progress } from '../../ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { toast } from 'sonner';
import { usePermissions } from '../../../lib/rbac/usePermissions';
import {
  useFianzas, diasParaRenovar, urgencia,
  type Fianza, type CartaFianza, type Urgencia,
} from '../../../lib/fianzas/fianzas-store';
import { exportToExcel, exportToExcelMultiHoja } from '../../../lib/shared/export-utils';

const soles = (n: number | null | undefined) =>
  n === null || n === undefined
    ? '—'
    : `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fecha = (iso: string | null) => {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

const COLOR_URGENCIA: Record<Urgencia, string> = {
  vencida: 'bg-red-600 text-white',
  critica: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  proxima: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  holgada: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
};

const ETIQUETA_ESTADO: Record<string, string> = {
  vigente: 'Vigente', renovada: 'Renovada', devuelta: 'Devuelta',
};

function textoDias(d: number) {
  if (d < 0) return `venció hace ${Math.abs(d)} d`;
  if (d === 0) return 'renueva hoy';
  return `en ${d} días`;
}

export function FianzasModule() {
  const { fianzas, cargos, loading } = useFianzas();
  const { can } = usePermissions();
  const puedeExportar = can('fianzas', 'exportar');
  const puedeCrear = can('fianzas', 'crear');

  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const fianza = fianzas.find(f => f.id === seleccionada) ?? null;

  /** Todas las cartas vigentes, ordenadas por lo que vence antes. */
  const vigentes = useMemo(() => {
    const filas: { f: Fianza; c: CartaFianza }[] = [];
    for (const f of fianzas) for (const c of f.cartas) if (c.estado === 'vigente') filas.push({ f, c });
    return filas.sort((a, b) => diasParaRenovar(a.c) - diasParaRenovar(b.c));
  }, [fianzas]);

  const totales = useMemo(() => {
    const t = { afianzado: 0, encaje: 0, costo: 0, criticas: 0, vencidas: 0 };
    for (const { c } of vigentes) {
      t.afianzado += c.montoAfianzado ?? 0;
      t.encaje += c.encaje ?? 0;
      t.costo += c.costoRenovacion ?? 0;
      const u = urgencia(c);
      if (u === 'vencida') t.vencidas++;
      else if (u === 'critica') t.criticas++;
    }
    return t;
  }, [vigentes]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return fianzas;
    return fianzas.filter(f =>
      f.nombreProyecto.toLowerCase().includes(q) ||
      f.entidad.toLowerCase().includes(q) ||
      (f.concurso ?? '').toLowerCase().includes(q) ||
      f.cartas.some(c => c.numero.toLowerCase().includes(q)));
  }, [fianzas, busqueda]);

  // ── Exportaciones ────────────────────────────────────────────────────────

  const CAB_CARTAS = {
    proyecto: 'Nombre del proyecto', entidad: 'Entidad', concurso: 'Concurso y/o contrato',
    consorcio: 'Empresas y/o consorcio', aseguradora: 'Proveedor', tipo: 'Tipo',
    numero: 'N° carta fianza', inicio: 'Inicio', plazo: 'Plazo', fin: 'Fin',
    renovacion: 'Fecha de renovación', montoContrato: 'Monto contrato',
    porcentaje: 'Porcentaje', afianzado: 'Monto afianzado',
    costo: 'Costo de renovación', encaje: 'Encaje', vigencia: 'Vigencia',
  };

  const filasCartas = () => fianzas.flatMap(f => f.cartas.map(c => ({
    proyecto: f.nombreProyecto, entidad: f.entidad, concurso: f.concurso ?? '',
    consorcio: f.consorcio ?? '', aseguradora: c.aseguradora ?? '', tipo: c.tipo ?? '',
    numero: c.numero, inicio: c.inicio, plazo: c.plazoDias, fin: c.fin,
    renovacion: c.fechaRenovacion, montoContrato: f.montoContrato ?? 0,
    porcentaje: f.porcentaje === null ? '' : `${(f.porcentaje * 100).toFixed(0)}%`,
    afianzado: c.montoAfianzado ?? 0, costo: c.costoRenovacion ?? 0,
    encaje: c.encaje ?? 0,
    vigencia: c.estado === 'vigente' ? 'SI' : c.estado === 'devuelta' ? 'DEVUELTA' : 'NO',
  })));

  const hoy = () => new Date().toISOString().slice(0, 10);

  /** Mismo orden de columnas que la hoja de Administración, a propósito. */
  const exportarStatus = async () => {
    if (!puedeExportar) return;
    await exportToExcel(`status-de-fianzas-${hoy()}`, filasCartas(), CAB_CARTAS, 'Fianzas');
    toast.success(`${filasCartas().length} cartas exportadas`);
  };

  const exportarVencimientos = async () => {
    if (!puedeExportar) return;
    const filas = vigentes.map(({ f, c }) => ({
      proyecto: f.nombreProyecto, entidad: f.entidad, numero: c.numero,
      aseguradora: c.aseguradora ?? '', fin: c.fin, renovacion: c.fechaRenovacion,
      dias: diasParaRenovar(c), afianzado: c.montoAfianzado ?? 0,
      costo: c.costoRenovacion ?? 0, encaje: c.encaje ?? 0,
    }));
    await exportToExcel(`fianzas-vencimientos-${hoy()}`, filas, {
      proyecto: 'Proyecto', entidad: 'Entidad', numero: 'N° carta',
      aseguradora: 'Aseguradora', fin: 'Vence', renovacion: 'Renovar antes de',
      dias: 'Días restantes', afianzado: 'Monto afianzado',
      costo: 'Costo de renovación', encaje: 'Encaje',
    }, 'Vencimientos');
    toast.success(`${filas.length} cartas vigentes exportadas`);
  };

  const exportarTodo = async () => {
    if (!puedeExportar) return;
    await exportToExcelMultiHoja(`fianzas-completo-${hoy()}`, [
      {
        nombre: 'Fianzas',
        data: fianzas.map(f => ({
          proyecto: f.nombreProyecto, entidad: f.entidad, concurso: f.concurso ?? '',
          consorcio: f.consorcio ?? '', montoContrato: f.montoContrato ?? 0,
          porcentaje: f.porcentaje === null ? '' : `${(f.porcentaje * 100).toFixed(0)}%`,
          cartas: f.cartas.length,
          vigente: f.cartas.find(c => c.estado === 'vigente')?.numero ?? '—',
        })),
        headersMap: {
          proyecto: 'Proyecto', entidad: 'Entidad', concurso: 'Concurso',
          consorcio: 'Consorcio', montoContrato: 'Monto contrato',
          porcentaje: 'Porcentaje', cartas: 'N° de cartas', vigente: 'Carta vigente',
        },
      },
      { nombre: 'Cartas', data: filasCartas(), headersMap: CAB_CARTAS },
    ]);
    toast.success('Fianzas y cartas exportadas');
  };

  // ── Detalle de una fianza ────────────────────────────────────────────────

  if (fianza) {
    const cargosDeFianza = cargos.filter(c => c.fianzaId === fianza.id);
    return (
      <div className="space-y-6">
        <PageNav onBack={() => setSeleccionada(null)} />

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Button variant="ghost" size="sm" className="px-2 -ml-2 mb-1 text-muted-foreground"
              onClick={() => setSeleccionada(null)}>
              <ArrowLeft className="size-4" /> Volver a las fianzas
            </Button>
            <h2 className="text-2xl font-semibold">{fianza.nombreProyecto}</h2>
            <p className="text-muted-foreground mt-1">{fianza.entidad}</p>
            {fianza.concurso && (
              <p className="text-xs text-muted-foreground mt-1">{fianza.concurso}</p>
            )}
          </div>
          <div className="text-sm text-right space-y-1">
            <div><span className="text-muted-foreground">Monto del contrato: </span>
              <strong>{soles(fianza.montoContrato)}</strong></div>
            <div><span className="text-muted-foreground">Porcentaje afianzado: </span>
              <strong>{fianza.porcentaje === null ? '—' : `${(fianza.porcentaje * 100).toFixed(0)}%`}</strong></div>
            {fianza.consorcio && (
              <div className="text-xs text-muted-foreground max-w-xs">{fianza.consorcio}</div>
            )}
            {fianza.proyectoNombre && (
              <Badge variant="secondary" className="text-xs">
                Proyecto: {fianza.proyectoNombre}
              </Badge>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Cadena de cartas ({fianza.cartas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° carta</TableHead>
                  <TableHead>Aseguradora</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead className="text-right">Plazo</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Renovar antes de</TableHead>
                  <TableHead className="text-right">Afianzado</TableHead>
                  <TableHead className="text-right">Costo renov.</TableHead>
                  <TableHead className="text-right">Encaje</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fianza.cartas.map(c => (
                  <TableRow key={c.id} className={c.estado === 'vigente' ? 'bg-primary/5' : ''}>
                    <TableCell className="font-medium text-sm whitespace-nowrap">{c.numero}</TableCell>
                    <TableCell className="text-sm">{c.aseguradora ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{fecha(c.inicio)}</TableCell>
                    <TableCell className="text-right text-sm">{c.plazoDias} d</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{fecha(c.fin)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {fecha(c.fechaRenovacion)}
                      {c.estado === 'vigente' && (
                        <Badge className={`ml-2 text-xs ${COLOR_URGENCIA[urgencia(c)]}`}>
                          {textoDias(diasParaRenovar(c))}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">{soles(c.montoAfianzado)}</TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">{soles(c.costoRenovacion)}</TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">{soles(c.encaje)}</TableCell>
                    <TableCell>
                      <Badge variant={c.estado === 'vigente' ? 'default' : 'secondary'} className="text-xs">
                        {ETIQUETA_ESTADO[c.estado] ?? c.estado}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" /> Cargos ({cargosDeFianza.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cargosDeFianza.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin cargos registrados. Los archivos siguen en SharePoint, en
                <span className="font-mono text-xs"> Administración / Fianzas / Cargos Fianzas / {fianza.entidad}</span>.
              </p>
            ) : (
              <ul className="space-y-2">
                {cargosDeFianza.map(g => (
                  <li key={g.id} className="text-sm flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground shrink-0" />
                    {g.sharepointUrl
                      ? <a href={g.sharepointUrl} target="_blank" rel="noreferrer" className="underline">{g.nombre}</a>
                      : <span>{g.nombre}</span>}
                    <span className="text-xs text-muted-foreground">
                      {g.subidoPor ? `· ${g.subidoPor}` : ''} · {fecha(g.subidoEn)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Tablero ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <ShieldCheck className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Fianzas</h2>
            <p className="text-muted-foreground mt-1">
              Cartas fianza de fiel cumplimiento y sus renovaciones
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!puedeExportar || fianzas.length === 0}>
                <Download className="size-4" /> Exportar <ChevronDown className="size-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                {fianzas.length} fianzas · {filasCartas().length} cartas
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportarStatus}>
                <ShieldCheck className="size-4" />
                <div>
                  <div>Status de fianzas</div>
                  <div className="text-xs text-muted-foreground">Mismas columnas que la hoja actual</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportarVencimientos}>
                <CalendarClock className="size-4" />
                <div>
                  <div>Vencimientos</div>
                  <div className="text-xs text-muted-foreground">Solo las vigentes, por fecha</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportarTodo}>
                <Landmark className="size-4" />
                <div>
                  <div>Fianzas + cartas</div>
                  <div className="text-xs text-muted-foreground">Dos hojas con todo el detalle</div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {puedeCrear && (
            <Button disabled title="Próximamente">
              <Plus className="size-4" /> Nueva Fianza
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className={totales.vencidas + totales.criticas > 0 ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-emerald-500'}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <AlertTriangle className="size-3" /> Por renovar pronto
                </p>
                <p className="text-2xl font-semibold mt-2 tabular-nums">
                  {totales.vencidas + totales.criticas}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  de {vigentes.length} vigentes · próximos 15 días
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Monto afianzado</p>
                <p className="text-2xl font-semibold mt-2 tabular-nums">{soles(totales.afianzado)}</p>
                <p className="text-xs text-muted-foreground mt-1">en cartas vigentes</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Coins className="size-3" /> Encaje inmovilizado
                </p>
                <p className="text-2xl font-semibold mt-2 tabular-nums">{soles(totales.encaje)}</p>
                <p className="text-xs text-muted-foreground mt-1">garantía retenida</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-slate-400">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Costo de renovación</p>
                <p className="text-2xl font-semibold mt-2 tabular-nums">{soles(totales.costo)}</p>
                <p className="text-xs text-muted-foreground mt-1">del ciclo vigente</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="size-4" /> Próximas renovaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {vigentes.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">Sin cartas vigentes.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proyecto</TableHead>
                      <TableHead>N° carta</TableHead>
                      <TableHead>Aseguradora</TableHead>
                      <TableHead>Renovar antes de</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead className="w-44">Tiempo restante</TableHead>
                      <TableHead className="text-right">Afianzado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vigentes.map(({ f, c }) => {
                      const d = diasParaRenovar(c);
                      const u = urgencia(c);
                      return (
                        <TableRow key={c.id} className="cursor-pointer"
                          onClick={() => setSeleccionada(f.id)}>
                          <TableCell className="py-2">
                            <div className="font-medium text-sm leading-tight">{f.nombreProyecto}</div>
                            <div className="text-xs text-muted-foreground">{f.entidad}</div>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{c.numero}</TableCell>
                          <TableCell className="text-sm">{c.aseguradora ?? '—'}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{fecha(c.fechaRenovacion)}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{fecha(c.fin)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={Math.max(0, Math.min(100, 100 - (d / 90) * 100))}
                                className={`h-2 flex-1 ${u === 'vencida' || u === 'critica' ? '[&>div]:bg-red-500' : u === 'proxima' ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
                              />
                              <Badge className={`text-xs whitespace-nowrap ${COLOR_URGENCIA[u]}`}>
                                {textoDias(d)}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm whitespace-nowrap">{soles(c.montoAfianzado)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div>
            <Input
              placeholder="Buscar por proyecto, entidad, contrato o N° de carta…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="sm:max-w-md mb-3"
            />
            <p className="text-xs text-muted-foreground mb-2">
              {listaFiltrada.length} de {fianzas.length} fianzas
            </p>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proyecto</TableHead>
                      <TableHead>Entidad</TableHead>
                      <TableHead className="text-right">Monto contrato</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Cartas</TableHead>
                      <TableHead>Carta vigente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaFiltrada.map(f => {
                      const vig = f.cartas.find(c => c.estado === 'vigente');
                      return (
                        <TableRow key={f.id} className="cursor-pointer"
                          onClick={() => setSeleccionada(f.id)}>
                          <TableCell className="py-2">
                            <div className="font-medium text-sm leading-tight">{f.nombreProyecto}</div>
                            {f.concurso && (
                              <div className="text-xs text-muted-foreground truncate max-w-md">{f.concurso}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{f.entidad}</TableCell>
                          <TableCell className="text-right text-sm whitespace-nowrap">{soles(f.montoContrato)}</TableCell>
                          <TableCell className="text-right text-sm">
                            {f.porcentaje === null ? '—' : `${(f.porcentaje * 100).toFixed(0)}%`}
                          </TableCell>
                          <TableCell className="text-right text-sm">{f.cartas.length}</TableCell>
                          <TableCell className="text-sm">
                            {vig ? (
                              <div className="flex items-center gap-2">
                                <span className="whitespace-nowrap">{vig.numero}</span>
                                <Badge className={`text-xs ${COLOR_URGENCIA[urgencia(vig)]}`}>
                                  {textoDias(diasParaRenovar(vig))}
                                </Badge>
                              </div>
                            ) : (
                              <Badge variant="secondary" className="text-xs">sin carta vigente</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Memphis ERP — ContabilidadDashboard
 * Vista principal del módulo Contabilidad con KPIs y alertas del período.
 */
import { useMemo } from 'react';
import {
  BookOpen, FileText, Receipt, AlertTriangle, CheckCircle2,
  Clock, Plus, ArrowRight, TrendingUp, ShieldCheck, Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { usePeriodosStore } from '../../../lib/contabilidad/periodos-store';
import { usePlanCuentas } from '../../../lib/contabilidad/plan-cuentas-store';
import { useAsientosStore } from '../../../lib/contabilidad/asientos-store';
import { useComprobantesStore } from '../../../lib/contabilidad/comprobantes-store';
import { convertirAMonedaBase } from '../../../lib/shared/currency-utils';

interface ContabilidadDashboardProps {
  onNavigate: (route: string) => void;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(n);
}

export function ContabilidadDashboard({ onNavigate }: ContabilidadDashboardProps) {
  const { periodos, periodoActual } = usePeriodosStore();
  const { cuentas } = usePlanCuentas();
  const { asientos } = useAsientosStore();
  const { comprobantes, pendientesContabilizar } = useComprobantesStore();

  const kpis = useMemo(() => {
    const asientosPeriodo = periodoActual
      ? asientos.filter(a => a.periodoId === periodoActual.id)
      : [];
    const borradores = asientosPeriodo.filter(a => a.estado === 'borrador').length;
    const validados  = asientosPeriodo.filter(a => a.estado === 'validado').length;
    const desbalanceados = asientosPeriodo.filter(a => !a.balanceado && a.estado !== 'anulado').length;

    const compMes = periodoActual
      ? comprobantes.filter(c => {
          const mes = `${new Date(c.fechaEmision).getFullYear()}${String(new Date(c.fechaEmision).getMonth()+1).padStart(2,'0')}`;
          return mes === `${periodoActual.anio}${String(periodoActual.mes).padStart(2,'0')}`;
        })
      : [];
    const totalIGVCompras = compMes.filter(c => c.direccion === 'recibido').reduce((s,c) => s + convertirAMonedaBase(c.igv, c.moneda), 0);
    const totalIGVVentas  = compMes.filter(c => c.direccion === 'emitido').reduce((s,c) => s + convertirAMonedaBase(c.igv, c.moneda), 0);
    const saldoIGV = totalIGVVentas - totalIGVCompras;

    return {
      totalCuentas: cuentas.filter(c => c.activo).length,
      totalPeriodos: periodos.length,
      borradores,
      validados,
      desbalanceados,
      pendientesContabilizar: pendientesContabilizar.length,
      totalIGVCompras,
      totalIGVVentas,
      saldoIGV,
      compMes: compMes.length,
    };
  }, [periodoActual, asientos, comprobantes, cuentas, periodos, pendientesContabilizar]);

  // Últimos 5 asientos
  const ultimosAsientos = asientos.slice(0, 5);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="size-6 text-primary" />
            Contabilidad
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Libro Diario · Plan de Cuentas PCGE · Registros SUNAT · Motor Fiscal Perú
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => onNavigate('/contabilidad/asientos')}>
            Ver asientos
          </Button>
          <Button size="sm" className="gap-2" onClick={() => onNavigate('/contabilidad/asientos/nuevo')}>
            <Plus className="size-4" /> Nuevo Asiento
          </Button>
        </div>
      </div>

      {/* Período actual */}
      {periodoActual ? (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/10">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-green-500/15 flex items-center justify-center">
                <CheckCircle2 className="size-5 text-green-500" />
              </div>
              <div>
                <p className="font-semibold">Período activo: {periodoActual.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {kpis.borradores} borrador(es) · {kpis.validados} validado(s)
                  {kpis.desbalanceados > 0 && (
                    <span className="text-red-500 font-medium ml-2">⚠ {kpis.desbalanceados} desbalanceado(s)</span>
                  )}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('/contabilidad/periodos')}>
              Gestionar períodos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 text-amber-500" />
              <p className="font-medium text-sm">No hay período contable abierto. Crea uno para registrar asientos.</p>
            </div>
            <Button size="sm" onClick={() => onNavigate('/contabilidad/periodos')}>
              Crear período
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Cuentas activas', value: kpis.totalCuentas, icon: Layers,    color: 'text-blue-500',   bg: 'bg-blue-500/10',   route: '/contabilidad/plan-cuentas' },
          { label: 'Asientos (período)', value: kpis.borradores + kpis.validados, icon: BookOpen, color: 'text-green-500', bg: 'bg-green-500/10', route: '/contabilidad/asientos' },
          { label: 'Comprobantes mes',  value: kpis.compMes,     icon: Receipt,   color: 'text-purple-500', bg: 'bg-purple-500/10', route: '/contabilidad/comprobantes' },
          { label: 'Pend. contabilizar',value: kpis.pendientesContabilizar, icon: Clock, color: kpis.pendientesContabilizar > 0 ? 'text-amber-500' : 'text-muted-foreground', bg: kpis.pendientesContabilizar > 0 ? 'bg-amber-500/10' : 'bg-muted/50', route: '/contabilidad/comprobantes' },
        ].map(k => (
          <Card key={k.label} className="cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all border-border/60"
            onClick={() => onNavigate(k.route)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                  <p className="text-2xl font-bold">{k.value}</p>
                </div>
                <div className={`size-9 rounded-xl flex items-center justify-center ${k.bg}`}>
                  <k.icon className={`size-5 ${k.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* IGV del período */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            IGV del Período {periodoActual?.nombre ?? '—'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-200/50 dark:border-red-800/50">
              <p className="text-xs text-muted-foreground mb-1">IGV Compras (Crédito Fiscal)</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{fmt(kpis.totalIGVCompras)}</p>
            </div>
            <div className="p-3 rounded-xl bg-green-500/5 border border-green-200/50 dark:border-green-800/50">
              <p className="text-xs text-muted-foreground mb-1">IGV Ventas (Débito Fiscal)</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{fmt(kpis.totalIGVVentas)}</p>
            </div>
            <div className={`p-3 rounded-xl border ${kpis.saldoIGV >= 0
              ? 'bg-amber-500/5 border-amber-200/50 dark:border-amber-800/50'
              : 'bg-blue-500/5 border-blue-200/50 dark:border-blue-800/50'}`}>
              <p className="text-xs text-muted-foreground mb-1">
                {kpis.saldoIGV >= 0 ? 'IGV a Pagar' : 'Saldo a Favor'}
              </p>
              <p className={`text-xl font-bold ${kpis.saldoIGV >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {fmt(Math.abs(kpis.saldoIGV))}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onNavigate('/contabilidad/registro-compras')}>
              <TrendingUp className="size-3.5" /> Reg. Compras
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onNavigate('/contabilidad/registro-ventas')}>
              <TrendingUp className="size-3.5" /> Reg. Ventas
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Últimos asientos + Accesos rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                Últimos Asientos
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-auto py-1"
                onClick={() => onNavigate('/contabilidad/asientos')}>
                Ver todos <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {ultimosAsientos.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <BookOpen className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin asientos registrados</p>
                <Button variant="outline" size="sm" className="mt-2 gap-2 text-xs"
                  onClick={() => onNavigate('/contabilidad/asientos/nuevo')}>
                  <Plus className="size-3" /> Crear primer asiento
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {ultimosAsientos.map(a => (
                  <button key={a._dbId}
                    onClick={() => onNavigate(`/contabilidad/asientos/${a.numero}`)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors text-left text-sm">
                    <div className="size-7 rounded flex items-center justify-center bg-primary/10 shrink-0">
                      <BookOpen className="size-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{a.numero}</p>
                      <p className="font-medium truncate text-xs">{a.glosa}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono">{new Intl.NumberFormat('es-PE',{minimumFractionDigits:2}).format(a.totalDebe)}</p>
                      <Badge variant="secondary" className={`text-[10px] py-0 px-1 ${
                        a.estado === 'validado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : a.estado === 'anulado' ? 'bg-gray-100 text-gray-500'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {a.estado}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acciones rápidas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Accesos Rápidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Plan de Cuentas',    icon: Layers,    route: '/contabilidad/plan-cuentas',       color: 'text-blue-500',   bg: 'bg-blue-500/10' },
                { label: 'Nuevo Asiento',      icon: BookOpen,  route: '/contabilidad/asientos/nuevo',     color: 'text-green-500',  bg: 'bg-green-500/10' },
                { label: 'Comprobantes',       icon: Receipt,   route: '/contabilidad/comprobantes',       color: 'text-purple-500', bg: 'bg-purple-500/10' },
                { label: 'Reg. Compras',       icon: FileText,  route: '/contabilidad/registro-compras',   color: 'text-orange-500', bg: 'bg-orange-500/10' },
                { label: 'Reg. Ventas',        icon: FileText,  route: '/contabilidad/registro-ventas',    color: 'text-cyan-500',   bg: 'bg-cyan-500/10' },
                { label: 'Períodos',           icon: Clock,     route: '/contabilidad/periodos',           color: 'text-amber-500',  bg: 'bg-amber-500/10' },
              ].map(a => (
                <button key={a.label}
                  onClick={() => onNavigate(a.route)}
                  className="flex items-center gap-2 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-accent/30 transition-all text-left group">
                  <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${a.bg}`}>
                    <a.icon className={`size-4 ${a.color}`} />
                  </div>
                  <span className="text-xs font-medium group-hover:text-primary transition-colors">
                    {a.label}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * MÓDULO PROVEEDORES — Dashboard
 * Punto de entrada del módulo: KPIs del directorio + accesos rápidos.
 * (Antes redirigía al directorio; ahora es un dashboard real.)
 */

import { useMemo } from 'react';
import { Users, CheckCircle, AlertTriangle, Globe2, ArrowRight, Building2, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useProveedorStore } from '../../lib/proveedores/proveedores-store';

interface ProveedoresProps {
  onNavigate?: (route: string) => void;
}

export function Proveedores({ onNavigate }: ProveedoresProps) {
  const { proveedores } = useProveedorStore();

  const stats = useMemo(() => {
    const activos = proveedores.filter(p => p.estado === 'activo').length;
    const observados = proveedores.filter(p => p.estado === 'observado').length;
    const enEvaluacion = proveedores.filter(p => p.estado === 'en_evaluacion').length;
    const noDomiciliados = proveedores.filter(p => !/^\d{11}$/.test(p.ruc ?? '')).length;
    const porTipo: Record<string, number> = {};
    proveedores.forEach(p => { porTipo[p.tipo] = (porTipo[p.tipo] ?? 0) + 1; });
    const conCalificacion = proveedores.filter(p => (p.calificacion ?? 0) > 0);
    const top = [...conCalificacion]
      .sort((a, b) => (b.calificacion ?? 0) - (a.calificacion ?? 0))
      .slice(0, 5);
    return { total: proveedores.length, activos, observados, enEvaluacion, noDomiciliados, porTipo, top };
  }, [proveedores]);

  const kpi = (label: string, value: number | string, icon: React.ReactNode, extra?: string) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {extra && <p className="text-xs text-muted-foreground mt-0.5">{extra}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="size-6" />
            Proveedores
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Resumen del directorio de proveedores homologados
          </p>
        </div>
        <Button onClick={() => onNavigate?.('/proveedores/directorio')}>
          Ir al Directorio <ArrowRight className="size-4 ml-1" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpi('Total Proveedores', stats.total, <Users className="size-4 text-blue-600" />)}
        {kpi('Activos', stats.activos, <CheckCircle className="size-4 text-green-600" />)}
        {kpi('Observados', stats.observados, <AlertTriangle className="size-4 text-amber-600" />)}
        {kpi('En Evaluación', stats.enEvaluacion, <Star className="size-4 text-purple-600" />)}
        {kpi('No Domiciliados', stats.noDomiciliados, <Globe2 className="size-4 text-slate-600" />, 'Extranjeros / sin RUC peruano')}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Por tipo</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(stats.porTipo).map(([tipo, n]) => (
              <div key={tipo} className="flex items-center justify-between text-sm">
                <span className="capitalize">{tipo}</span>
                <Badge variant="secondary">{n}</Badge>
              </div>
            ))}
            {Object.keys(stats.porTipo).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Mejor calificados</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.top.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay proveedores calificados — las evaluaciones alimentan este ranking.</p>
            ) : stats.top.map(p => (
              <div
                key={p._dbId}
                className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 -mx-2"
                onClick={() => onNavigate?.(`/proveedores/directorio/${p.id}`)}
              >
                <span className="truncate">{p.razonSocial}</span>
                <Badge className="bg-amber-100 text-amber-800 shrink-0">★ {(p.calificacion ?? 0).toFixed(1)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Directorio', route: '/proveedores/directorio' },
          { label: 'Evaluaciones', route: '/proveedores/evaluaciones' },
          { label: 'Contratos', route: '/proveedores/contratos' },
          { label: 'Talleres', route: '/proveedores/talleres' },
        ].map(x => (
          <Button key={x.route} variant="outline" className="justify-between" onClick={() => onNavigate?.(x.route)}>
            {x.label} <ArrowRight className="size-4" />
          </Button>
        ))}
      </div>
    </div>
  );
}

// Exportar componentes reales del módulo
export * from './proveedores/ProveedoresDirectorio';
export * from './proveedores/ProveedorDetalle';
export * from './proveedores/ProveedorForm';

// Exportar placeholders de submódulos (evaluaciones, contratos, talleres)
export { ProveedoresEvaluaciones, ProveedoresContratos, ProveedoresTalleres } from './placeholders';

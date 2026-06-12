/**
 * GESTIÓN DE FLUJO DE APROBACIÓN — Panel Admin Memphis ERP
 * Permite configurar los 3 niveles de aprobación por monto de orden.
 */

import { useState } from 'react';
import { Save, Shield, AlertTriangle, ChevronRight, ArrowRight, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { Checkbox } from '../../ui/checkbox';
import { useRoles } from '../../../lib/rbac/roles-store';
import {
  loadFlujoAprobacion,
  saveFlujoAprobacion,
  formatearUmbral,
  nivelAprobacionColor,
  type FlujoAprobacionConfig,
  type NivelAprobacion,
} from '../../../lib/compras/approval-flow';
import { toast } from 'sonner';

const NIVEL_ICONS = ['①', '②', '③'];
const NIVEL_TITLES = ['Nivel 1', 'Nivel 2', 'Nivel 3'];

export function GestionFlujoAprobacion() {
  const { roles } = useRoles();
  const [config, setConfig] = useState<FlujoAprobacionConfig>(loadFlujoAprobacion);
  const [saving, setSaving] = useState(false);

  // Helpers para actualizar un nivel
  const updateNivel = (idx: 0 | 1 | 2, changes: Partial<NivelAprobacion>) => {
    setConfig(prev => {
      const nuevos = [...prev.niveles] as typeof prev.niveles;
      nuevos[idx] = { ...nuevos[idx], ...changes };
      // Si se cambia el max del nivel idx, actualizar el min del siguiente
      if (changes.montoMax !== undefined && idx < 2) {
        nuevos[idx + 1] = { ...nuevos[idx + 1], montoMin: changes.montoMax ?? 0 };
      }
      return { ...prev, niveles: nuevos };
    });
  };

  const toggleRole = (nivelIdx: 0 | 1 | 2, rolNombre: string, checked: boolean) => {
    const current = config.niveles[nivelIdx].roles;
    const updated = checked
      ? [...current, rolNombre]
      : current.filter(r => r !== rolNombre);
    updateNivel(nivelIdx, { roles: updated });
  };

  const handleSave = () => {
    // Validate thresholds are ascending
    const [n1, n2] = config.niveles;
    if (n1.montoMax === null || n2.montoMax === null) {
      toast.error('Los umbrales 1 y 2 deben tener un límite superior definido');
      return;
    }
    if (n1.montoMax <= 0 || n2.montoMax <= n1.montoMax) {
      toast.error('Los umbrales deben ser ascendentes: Umbral 1 < Umbral 2');
      return;
    }
    if (config.tipoCambioRef <= 0) {
      toast.error('El tipo de cambio de referencia debe ser mayor a 0');
      return;
    }
    setSaving(true);
    try {
      saveFlujoAprobacion(config);
      toast.success('Flujo de aprobación guardado', {
        description: 'Los cambios aplican a las nuevas órdenes de compra.',
      });
    } finally {
      setSaving(false);
    }
  };

  const nivelColors = [
    'border-[#64748B] dark:border-border hover:shadow-[inset_4px_0_0_0_#22c55e]',
    'border-[#64748B] dark:border-border hover:shadow-[inset_4px_0_0_0_#eab308]',
    'border-[#64748B] dark:border-border hover:shadow-[inset_4px_0_0_0_#ef4444]',
  ];

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <Shield className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold">Flujo de Aprobación de Órdenes</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configura los umbrales de monto y los roles requeridos para aprobar órdenes de compra y servicio.
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4" />
          Guardar
        </Button>
      </div>

      {/* Info */}
      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Las órdenes en <strong>USD</strong> se convierten a PEN usando el tipo de cambio de referencia para determinar el nivel. El nivel aplica a nuevas órdenes; las existentes conservan su nivel.
        </AlertDescription>
      </Alert>

      {/* Tipo de cambio referencia */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="space-y-1 flex-1 max-w-xs">
              <Label className="text-sm">Tipo de cambio de referencia (PEN/USD)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">1 USD =</span>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={config.tipoCambioRef}
                  onChange={e => setConfig(prev => ({ ...prev, tipoCambioRef: parseFloat(e.target.value) || 3.75 }))}
                  className="w-28 h-8"
                />
                <span className="text-sm text-muted-foreground">PEN</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Solo para determinar el nivel de aprobación de órdenes en USD. No afecta montos ni pagos.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Diagrama visual */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto pb-1">
        <span className="shrink-0">S/ 0</span>
        <div className="h-px flex-1 bg-green-400 min-w-8" />
        <Badge className="shrink-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">Nivel 1</Badge>
        <div className="h-px flex-1 bg-yellow-400 min-w-8" />
        <Badge className="shrink-0 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">Nivel 2</Badge>
        <div className="h-px flex-1 bg-red-400 min-w-8" />
        <Badge className="shrink-0 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0">Nivel 3</Badge>
        <div className="h-px w-4 bg-red-400" />
        <span className="shrink-0">∞</span>
      </div>

      {/* Niveles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {config.niveles.map((nivel, idx) => (
          <Card key={nivel.nivel} className={`border-2 transition-shadow ${nivelColors[idx]}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-lg">{NIVEL_ICONS[idx]}</span>
                <div className="flex-1">
                  <Input
                    value={nivel.label}
                    onChange={e => updateNivel(idx as 0|1|2, { label: e.target.value })}
                    className="h-7 text-sm font-semibold border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <Badge className={`text-xs shrink-0 ${nivelAprobacionColor(nivel.nivel)}`}>
                  {nivel.aprobadoresRequeridos} aprobador{nivel.aprobadoresRequeridos > 1 ? 'es' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Descripcion */}
              <Input
                value={nivel.descripcion}
                onChange={e => updateNivel(idx as 0|1|2, { descripcion: e.target.value })}
                className="h-7 text-xs bg-white dark:bg-input/30"
                placeholder="Descripción del nivel"
              />

              {/* Umbrales */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">RANGO DE MONTO (PEN)</Label>
                <div className="flex items-center gap-2">
                  <div className="space-y-1 flex-1">
                    <span className="text-xs text-muted-foreground">Desde</span>
                    <Input
                      value={`S/ ${nivel.montoMin.toLocaleString('es-PE')}`}
                      disabled
                      className="h-8 text-sm bg-white dark:bg-input/30"
                    />
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-5" />
                  <div className="space-y-1 flex-1">
                    <span className="text-xs text-muted-foreground">Hasta</span>
                    {nivel.montoMax === null ? (
                      <Input value="Sin límite" disabled className="h-8 text-sm bg-white dark:bg-input/30" />
                    ) : (
                      <Input
                        type="number"
                        min={nivel.montoMin + 1}
                        step={1000}
                        value={nivel.montoMax}
                        onChange={e => updateNivel(idx as 0|1|2, { montoMax: parseInt(e.target.value) || nivel.montoMax })}
                        className="h-8 text-sm bg-white dark:bg-input/30"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Nro de aprobadores */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">APROBADORES REQUERIDOS</Label>
                <div className="flex gap-1">
                  {[1, 2, 3].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => updateNivel(idx as 0|1|2, { aprobadoresRequeridos: n })}
                      className={`flex-1 h-8 rounded text-sm font-medium transition-colors ${nivel.aprobadoresRequeridos === n
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-muted hover:!bg-black hover:!text-white dark:hover:!bg-muted/80 dark:hover:!text-muted-foreground text-muted-foreground'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Roles */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">ROLES QUE PUEDEN APROBAR</Label>
                {roles.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Cargando roles...</p>
                )}
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {roles.map(rol => (
                    <div key={rol._dbId} className="flex items-center gap-2">
                      <Checkbox
                        id={`n${idx}-${rol._dbId}`}
                        checked={nivel.roles.includes(rol.nombre)}
                        onCheckedChange={checked => toggleRole(idx as 0|1|2, rol.nombre, Boolean(checked))}
                      />
                      <label htmlFor={`n${idx}-${rol._dbId}`} className="text-xs cursor-pointer flex-1">
                        {rol.nombre}
                        {rol.esSistema && <span className="ml-1 text-muted-foreground">(sistema)</span>}
                      </label>
                    </div>
                  ))}
                </div>
                {nivel.roles.length === 0 && (
                  <p className="text-xs text-yellow-600 flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    Sin roles asignados — nadie podrá aprobar
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview del flujo actual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Vista previa del flujo configurado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {config.niveles.map((nivel, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className={`px-3 py-1.5 rounded border text-xs ${nivelColors[idx]}`}>
                  <div className="font-medium">{nivel.label}</div>
                  <div className="text-muted-foreground">
                    {formatearUmbral(nivel.montoMin)} — {formatearUmbral(nivel.montoMax)}
                  </div>
                  <div className="text-muted-foreground">{nivel.aprobadoresRequeridos} aprobador{nivel.aprobadoresRequeridos > 1 ? 'es' : ''}</div>
                </div>
                {idx < 2 && <ArrowRight className="size-4 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="size-4" />
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}

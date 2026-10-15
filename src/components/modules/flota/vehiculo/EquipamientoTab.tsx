/**
 * Pestaña "Equipamiento" del vehículo: qué bodycam, radio, tablet o GPS tiene
 * instalado esta unidad, por número de serie (lo que Operaciones buscaba en el
 * Excel cuando el GORE preguntaba "qué bodycam tiene la camioneta 12").
 * Los cambios (instalar, retirar, entregar) se hacen desde Inventario › Unidades.
 */
import { useEffect, useState } from 'react';
import { Cpu, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { UnidadesCompacta } from '../../inventario/UnidadesCompacta';
import { cargarUnidadesDeVehiculo, type Unidad } from '../../../../lib/inventario/unidades';
import type { Vehiculo } from '../../../../lib/flota/vehiculos-config';

export function EquipamientoTab({ vehiculo, onNavigate }: { vehiculo: Vehiculo; onNavigate?: (r: string) => void }) {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    if (!vehiculo._dbId) { setLoading(false); return; }
    cargarUnidadesDeVehiculo(vehiculo._dbId)
      .then(u => { if (vivo) setUnidades(u); })
      .catch(() => { if (vivo) setUnidades([]); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [vehiculo._dbId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Cpu className="size-4" /> Equipamiento instalado</CardTitle>
        <CardDescription>Unidades con número de serie instaladas en {vehiculo.placa || vehiculo.id}. Se instalan y retiran desde Inventario › Unidades.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading
          ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</div>
          : <UnidadesCompacta unidades={unidades} titulo={`EQUIPAMIENTO INSTALADO · ${vehiculo.placa || vehiculo.id}`}
                              vacio="Este vehículo no tiene equipamiento registrado por serie."
                              onIrAUnidades={onNavigate ? () => onNavigate('/inventario/unidades') : undefined} />}
      </CardContent>
    </Card>
  );
}

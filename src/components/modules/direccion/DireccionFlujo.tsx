/**
 * Dirección › Flujo de caja: ingresos − egresos = neto y saldo acumulado por mes, real y previsto, con meses hacia
 * atrás y hacia adelante elegibles. Reutiliza el componente de Finanzas (función `flujo_caja`).
 */
import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Button } from '../../ui/button';
import { PageNav } from '../../shared/PageNav';
import { FlujoCajaMensual } from '../finanzas/FlujoCajaMensual';
import { DireccionNav } from './DireccionNav';

const OPCIONES = [
  { label: '3 atrás · 6 adelante', atras: 3, adelante: 6 },
  { label: '6 atrás · 6 adelante', atras: 6, adelante: 6 },
  { label: '12 atrás · 12 adelante', atras: 12, adelante: 12 },
  { label: 'Este año y el próximo', atras: new Date().getMonth(), adelante: 23 - new Date().getMonth() },
];

export function DireccionFlujo({ onNavigate }: { onNavigate?: (ruta: string) => void }) {
  const [opcion, setOpcion] = useState(0);
  const o = OPCIONES[opcion];
  return (
    <div className="space-y-5">
      <PageNav />
      <div className="flex items-center gap-3">
        <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center"><Wallet className="size-6 text-black dark:text-primary" /></div>
        <div>
          <h1 className="text-2xl font-semibold">Flujo de caja</h1>
          <p className="text-muted-foreground text-sm">Ingresos menos egresos por mes, real y previsto, con el saldo acumulado.</p>
        </div>
      </div>
      <DireccionNav actual="/direccion/flujo" onNavigate={onNavigate} />
      <div className="flex flex-wrap gap-1">
        {OPCIONES.map((x, i) => <Button key={x.label} size="sm" variant={opcion === i ? 'default' : 'outline'} onClick={() => setOpcion(i)}>{x.label}</Button>)}
      </div>
      <FlujoCajaMensual key={`${o.atras}-${o.adelante}`} atras={o.atras} adelante={o.adelante} />
    </div>
  );
}

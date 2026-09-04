/**
 * Formularios de fianza y de carta fianza.
 *
 * El monto afianzado NO se calcula a partir del monto de contrato por el
 * porcentaje. Un contrato puede estar cubierto por varias cartas: en GORE
 * Amazonas los 12M son el total del proyecto (11M de contrato más 1M+ de
 * documento equivalente) y por eso hay dos cartas, una de S/470,740 y otra de
 * S/20,661. Cada monto se teclea como figura en su carta; el porcentaje se
 * guarda como referencia y no alimenta ningún cálculo.
 *
 * Lo que NO se pide en el formulario de la carta: el fin y la fecha de
 * renovación. Los calcula la base (FIN = INICIO + PLAZO − 1, RENOVACIÓN =
 * FIN − 5), igual que las fórmulas del Excel. Se muestran mientras se escribe,
 * para que quien registra vea a qué se está comprometiendo, pero no se teclean.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { toast } from 'sonner';
import { useProyectos } from '../../../lib/proyectos/proyectos-store';
import {
  useFianzas, type Fianza, type CartaFianza, type EstadoCarta,
} from '../../../lib/fianzas/fianzas-store';

const aNumero = (v: string): number | null => {
  const t = v.trim().replace(/\s/g, '');
  if (!t) return null;
  const n = Number(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const fechaCorta = (iso: string) => {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/** Mismas fórmulas que la base, para la vista previa mientras se escribe. */
function calcular(inicio: string, plazo: number) {
  if (!inicio || !plazo || plazo < 1) return { fin: '', renovacion: '' };
  const base = new Date(inicio + 'T00:00:00');
  const fin = new Date(base); fin.setDate(fin.getDate() + plazo - 1);
  const ren = new Date(fin); ren.setDate(ren.getDate() - 5);
  return { fin: fin.toISOString().slice(0, 10), renovacion: ren.toISOString().slice(0, 10) };
}

// ── Fianza ─────────────────────────────────────────────────────────────────

export function FianzaForm({
  abierto, onOpenChange, fianza,
}: { abierto: boolean; onOpenChange: (v: boolean) => void; fianza?: Fianza | null }) {
  const { guardarFianza } = useFianzas();
  const { proyectos } = useProyectos();
  const [guardando, setGuardando] = useState(false);
  const [f, setF] = useState({
    concurso: '', nombreProyecto: '', entidad: '', consorcio: '',
    montoContrato: '', porcentaje: '', proyectoId: '', notas: '',
  });

  useEffect(() => {
    if (!abierto) return;
    setF({
      concurso: fianza?.concurso ?? '',
      nombreProyecto: fianza?.nombreProyecto ?? '',
      entidad: fianza?.entidad ?? '',
      consorcio: fianza?.consorcio ?? '',
      montoContrato: fianza?.montoContrato != null ? String(fianza.montoContrato) : '',
      porcentaje: fianza?.porcentaje != null ? String(fianza.porcentaje * 100) : '',
      proyectoId: fianza?.proyectoId ?? '',
      notas: fianza?.notas ?? '',
    });
  }, [abierto, fianza]);

  const guardar = async () => {
    if (!f.nombreProyecto.trim() || !f.entidad.trim()) {
      toast.error('El nombre del proyecto y la entidad son obligatorios');
      return;
    }
    const pct = aNumero(f.porcentaje);
    setGuardando(true);
    const err = await guardarFianza({
      ...(fianza?.id ? { id: fianza.id } : {}),
      concurso: f.concurso.trim() || null,
      nombreProyecto: f.nombreProyecto.trim(),
      entidad: f.entidad.trim(),
      consorcio: f.consorcio.trim() || null,
      montoContrato: aNumero(f.montoContrato),
      porcentaje: pct === null ? null : pct / 100,
      proyectoId: f.proyectoId || null,
      notas: f.notas.trim() || null,
    } as Partial<Fianza> & { nombreProyecto: string; entidad: string });
    setGuardando(false);
    if (err) { toast.error('No se pudo guardar: ' + err); return; }
    toast.success(fianza ? 'Fianza actualizada' : 'Fianza creada');
    onOpenChange(false);
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{fianza ? 'Editar fianza' : 'Nueva fianza'}</DialogTitle>
          <DialogDescription>
            El contrato afianzado. Las cartas y sus renovaciones se registran aparte,
            y cada una lleva su propio monto afianzado tal como figura en la carta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="fz-concurso">Concurso y/o contrato</Label>
            <Input id="fz-concurso" className="mt-1" value={f.concurso}
              onChange={e => setF(v => ({ ...v, concurso: e.target.value }))}
              placeholder="Ej: CONVENIO N° 033-2025-GR CUSCO (AMBULANCIAS)" />
          </div>
          <div>
            <Label htmlFor="fz-proyecto">Nombre del proyecto *</Label>
            <Input id="fz-proyecto" className="mt-1" value={f.nombreProyecto}
              onChange={e => setF(v => ({ ...v, nombreProyecto: e.target.value }))}
              placeholder="Ej: GORE CUSCO AMBULANCIAS" />
          </div>
          <div>
            <Label htmlFor="fz-entidad">Entidad *</Label>
            <Input id="fz-entidad" className="mt-1" value={f.entidad}
              onChange={e => setF(v => ({ ...v, entidad: e.target.value }))}
              placeholder="Ej: GOBIERNO REGIONAL DE CUSCO" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="fz-consorcio">Empresas y/o consorcio</Label>
            <Input id="fz-consorcio" className="mt-1" value={f.consorcio}
              onChange={e => setF(v => ({ ...v, consorcio: e.target.value }))}
              placeholder="Ej: MEMPHIS MAQUINARIAS S.A.C. - EIGR CONTRATISTAS S.R.L." />
          </div>
          <div>
            <Label htmlFor="fz-monto">Monto del contrato</Label>
            <Input id="fz-monto" className="mt-1" inputMode="decimal" value={f.montoContrato}
              onChange={e => setF(v => ({ ...v, montoContrato: e.target.value }))}
              placeholder="37303297.53" />
          </div>
          <div>
            <Label htmlFor="fz-pct">Porcentaje afianzado (%)</Label>
            <Input id="fz-pct" className="mt-1" inputMode="decimal" value={f.porcentaje}
              onChange={e => setF(v => ({ ...v, porcentaje: e.target.value }))}
              placeholder="4" />
            <p className="text-xs text-muted-foreground mt-1">
              Se registra tal como figura, no se usa para calcular nada.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label>Proyecto del ERP</Label>
            <div className="mt-1">
              <SearchableSelect
                value={f.proyectoId || null}
                onChange={v => setF(x => ({ ...x, proyectoId: v ?? '' }))}
                options={proyectos.map(p => ({ value: p._dbId, label: p.nombre }))}
                placeholder="Sin enlazar"
                searchPlaceholder="Buscar proyecto…"
                nullable
                nullLabel="Sin enlazar"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="fz-notas">Notas</Label>
            <Textarea id="fz-notas" className="mt-1" rows={2} value={f.notas}
              onChange={e => setF(v => ({ ...v, notas: e.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : fianza ? 'Guardar cambios' : 'Crear fianza'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Carta ──────────────────────────────────────────────────────────────────

export function CartaForm({
  abierto, onOpenChange, fianzaId, carta,
}: {
  abierto: boolean; onOpenChange: (v: boolean) => void;
  fianzaId: string; carta?: CartaFianza | null;
}) {
  const { guardarCarta, actualizarCarta } = useFianzas();
  const [guardando, setGuardando] = useState(false);
  const [c, setC] = useState({
    numero: '', aseguradora: '', tipo: 'FIEL CUMPLIMIENTO', inicio: '', plazo: '90',
    montoAfianzado: '', costoRenovacion: '', encaje: '',
    estado: 'vigente' as EstadoCarta, notas: '',
  });

  useEffect(() => {
    if (!abierto) return;
    setC({
      numero: carta?.numero ?? '',
      aseguradora: carta?.aseguradora ?? 'CESCE',
      tipo: carta?.tipo ?? 'FIEL CUMPLIMIENTO',
      inicio: carta?.inicio?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      plazo: carta ? String(carta.plazoDias) : '90',
      montoAfianzado: carta?.montoAfianzado != null ? String(carta.montoAfianzado) : '',
      costoRenovacion: carta?.costoRenovacion != null ? String(carta.costoRenovacion) : '',
      encaje: carta?.encaje != null ? String(carta.encaje) : '',
      estado: carta?.estado ?? 'vigente',
      notas: carta?.notas ?? '',
    });
  }, [abierto, carta]);

  const previa = useMemo(
    () => calcular(c.inicio, Number(c.plazo) || 0),
    [c.inicio, c.plazo],
  );

  const guardar = async () => {
    const plazo = Number(c.plazo);
    if (!c.numero.trim() || !c.inicio || !plazo || plazo < 1) {
      toast.error('Número, fecha de inicio y plazo son obligatorios');
      return;
    }
    setGuardando(true);
    const datos = {
      numero: c.numero.trim(),
      aseguradora: c.aseguradora.trim() || null,
      tipo: c.tipo.trim() || null,
      inicio: c.inicio,
      plazoDias: plazo,
      montoAfianzado: aNumero(c.montoAfianzado),
      costoRenovacion: aNumero(c.costoRenovacion),
      encaje: aNumero(c.encaje),
      estado: c.estado,
      notas: c.notas.trim() || null,
    };
    const err = carta
      ? await actualizarCarta(carta.id, datos)
      : await guardarCarta(fianzaId, datos);
    setGuardando(false);
    if (err) { toast.error('No se pudo guardar: ' + err); return; }
    toast.success(carta ? 'Carta actualizada' : 'Carta registrada');
    onOpenChange(false);
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{carta ? 'Editar carta fianza' : 'Nueva carta fianza'}</DialogTitle>
          <DialogDescription>
            El vencimiento y la fecha de renovación se calculan solos a partir del inicio y el plazo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ct-num">N° carta fianza *</Label>
            <Input id="ct-num" className="mt-1" value={c.numero}
              onChange={e => setC(v => ({ ...v, numero: e.target.value }))}
              placeholder="Ej: 15411-0429-2025-006" />
          </div>
          <div>
            <Label htmlFor="ct-aseg">Aseguradora</Label>
            <Input id="ct-aseg" className="mt-1" value={c.aseguradora}
              onChange={e => setC(v => ({ ...v, aseguradora: e.target.value }))}
              placeholder="CESCE" />
          </div>
          <div>
            <Label htmlFor="ct-inicio">Inicio *</Label>
            <Input id="ct-inicio" type="date" className="mt-1" value={c.inicio}
              onChange={e => setC(v => ({ ...v, inicio: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="ct-plazo">Plazo (días) *</Label>
            <Input id="ct-plazo" type="number" min={1} className="mt-1" value={c.plazo}
              onChange={e => setC(v => ({ ...v, plazo: e.target.value }))} />
          </div>

          <div className="sm:col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Vence: </span>
            <strong>{fechaCorta(previa.fin)}</strong>
            <span className="text-muted-foreground"> · Renovar antes de: </span>
            <strong>{fechaCorta(previa.renovacion)}</strong>
            <p className="text-xs text-muted-foreground mt-1">
              Calculado, no se escribe: fin = inicio + plazo − 1, renovación = fin − 5.
            </p>
          </div>

          <div>
            <Label htmlFor="ct-monto">Monto afianzado</Label>
            <Input id="ct-monto" className="mt-1" inputMode="decimal" value={c.montoAfianzado}
              onChange={e => setC(v => ({ ...v, montoAfianzado: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="ct-costo">Costo de renovación</Label>
            <Input id="ct-costo" className="mt-1" inputMode="decimal" value={c.costoRenovacion}
              onChange={e => setC(v => ({ ...v, costoRenovacion: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="ct-encaje">Encaje</Label>
            <Input id="ct-encaje" className="mt-1" inputMode="decimal" value={c.encaje}
              onChange={e => setC(v => ({ ...v, encaje: e.target.value }))} />
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={c.estado} onValueChange={(v: string) => setC(x => ({ ...x, estado: v as EstadoCarta }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vigente">Vigente</SelectItem>
                <SelectItem value="renovada">Renovada</SelectItem>
                <SelectItem value="devuelta">Devuelta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="ct-notas">Notas</Label>
            <Textarea id="ct-notas" className="mt-1" rows={2} value={c.notas}
              onChange={e => setC(v => ({ ...v, notas: e.target.value }))} />
          </div>
        </div>

        {!carta && c.estado === 'vigente' && (
          <p className="text-xs text-muted-foreground">
            Al guardarla como vigente, la carta vigente anterior de esta fianza pasa a
            «renovada»: solo una puede estar vigente a la vez.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : carta ? 'Guardar cambios' : 'Registrar carta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

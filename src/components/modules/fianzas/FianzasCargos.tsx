/**
 * Cargos de fianzas — la vista de Lisbet Monteza.
 *
 * A propósito NO muestra montos, encaje ni el tablero: su permiso es
 * `fianzas.cargos`, no `fianzas.ver`. Es el mismo criterio con el que Flota
 * entra a Recepciones sin ver el resto de Compras.
 */
import { useMemo, useState } from 'react';
import { FileText, Plus, Search, ExternalLink } from 'lucide-react';
import { PageNav } from '../../shared/PageNav';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../ui/dialog';
import { SearchableSelect } from '../../shared/SearchableSelect';
import { toast } from 'sonner';
import { usePermissions } from '../../../lib/rbac/usePermissions';
import { useFianzas } from '../../../lib/fianzas/fianzas-store';

const fecha = (iso: string | null) => {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

export function FianzasCargos() {
  const { fianzas, cargos, loading, registrarCargo } = useFianzas();
  const { can } = usePermissions();
  const puedeSubir = can('fianzas', 'cargos');

  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ fianzaId: '', cartaId: '', nombre: '', url: '' });

  const nombrePorFianza = useMemo(
    () => new Map(fianzas.map(f => [f.id, `${f.nombreProyecto} — ${f.entidad}`])),
    [fianzas],
  );

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return cargos
      .map(c => ({ ...c, fianza: nombrePorFianza.get(c.fianzaId) ?? '—' }))
      .filter(c => !q || c.nombre.toLowerCase().includes(q) || c.fianza.toLowerCase().includes(q));
  }, [cargos, busqueda, nombrePorFianza]);

  const cartasDeLaFianza = useMemo(
    () => fianzas.find(f => f.id === form.fianzaId)?.cartas ?? [],
    [fianzas, form.fianzaId],
  );

  const guardar = async () => {
    if (!form.fianzaId || !form.nombre.trim()) {
      toast.error('Elige la fianza y escribe el nombre del cargo');
      return;
    }
    setGuardando(true);
    const err = await registrarCargo({
      fianzaId: form.fianzaId,
      cartaId: form.cartaId || null,
      nombre: form.nombre.trim(),
      sharepointUrl: form.url.trim() || null,
    });
    setGuardando(false);
    if (err) { toast.error('No se pudo registrar: ' + err); return; }
    toast.success('Cargo registrado');
    setForm({ fianzaId: '', cartaId: '', nombre: '', url: '' });
    setAbierto(false);
  };

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <FileText className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Cargos de Fianzas</h2>
            <p className="text-muted-foreground mt-1">
              Constancias de entrega de las cartas fianza
            </p>
          </div>
        </div>
        {puedeSubir && (
          <Button onClick={() => setAbierto(true)}>
            <Plus className="size-4" /> Registrar cargo
          </Button>
        )}
      </div>

      <div className="relative sm:max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por proyecto o nombre del cargo…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{lista.length} cargo(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : lista.length === 0 ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Todavía no hay cargos registrados en el sistema.</p>
              <p>
                Los archivos siguen en SharePoint, en
                <span className="font-mono text-xs"> Administración / Fianzas / Cargos Fianzas</span>,
                organizados por entidad. Al registrarlos aquí quedan enlazados a su carta fianza.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {lista.map(c => (
                <li key={c.id} className="py-3 flex items-start gap-3">
                  <FileText className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {c.nombre}
                      {c.sharepointUrl && (
                        <a href={c.sharepointUrl} target="_blank" rel="noreferrer"
                          className="text-primary inline-flex items-center gap-1 text-xs underline">
                          abrir <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.fianza}</div>
                  </div>
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    {c.subidoPor ? `${c.subidoPor} · ` : ''}{fecha(c.subidoEn)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar cargo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fianza *</Label>
              <div className="mt-1">
                <SearchableSelect
                  value={form.fianzaId || null}
                  onChange={v => setForm(f => ({ ...f, fianzaId: v ?? '', cartaId: '' }))}
                  options={fianzas.map(f => ({
                    value: f.id,
                    label: `${f.nombreProyecto} — ${f.entidad}`,
                  }))}
                  placeholder="Elige la fianza…"
                  searchPlaceholder="Buscar…"
                />
              </div>
            </div>
            <div>
              <Label>Carta fianza (opcional)</Label>
              <div className="mt-1">
                <SearchableSelect
                  value={form.cartaId || null}
                  onChange={v => setForm(f => ({ ...f, cartaId: v ?? '' }))}
                  options={cartasDeLaFianza.map(c => ({
                    value: c.id,
                    label: `${c.numero} · inicia ${fecha(c.inicio)}`,
                  }))}
                  placeholder={form.fianzaId ? 'Elige la carta…' : 'Primero elige la fianza'}
                  searchPlaceholder="Buscar carta…"
                  disabled={!form.fianzaId}
                  nullable
                  nullLabel="Sin carta específica"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="cargo-nombre">Nombre del cargo *</Label>
              <Input
                id="cargo-nombre"
                className="mt-1"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Cargo fianza ambulancias 14.04"
              />
            </div>
            <div>
              <Label htmlFor="cargo-url">Enlace en SharePoint (opcional)</Label>
              <Input
                id="cargo-url"
                className="mt-1"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://memphisperu.sharepoint.com/…"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Por ahora el archivo se queda en SharePoint y aquí se guarda el enlace.
                La subida directa al sistema entra después.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

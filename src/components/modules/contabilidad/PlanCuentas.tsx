/**
 * Memphis ERP — Plan de Cuentas PCGE
 * Árbol jerárquico, búsqueda, inicialización y alta de cuentas personalizadas.
 */
import { useState, useMemo } from 'react';
import { Layers, Search, Plus, RefreshCw, ChevronRight, ChevronDown, Zap, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { usePlanCuentas, TIPO_CUENTA_LABELS, TIPO_CUENTA_COLORS, type TipoCuenta, type NaturalezaCuenta } from '../../../lib/contabilidad/plan-cuentas-store';
import { useConfirmAction } from '@/components/shared/ConfirmDialogProvider';

export function PlanCuentas() {
  const { cuentas, loading, inicializarPCGE, crearCuenta, toggleActivo, buscar } = usePlanCuentas();
  const confirmAction = useConfirmAction();
  const [query, setQuery] = useState('');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set(['1','2','3','4','5','6','7','8','9']));
  const [showInactivos, setShowInactivos] = useState(false);
  const [modalNueva, setModalNueva] = useState(false);
  const [inicializando, setInicializando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nueva, setNueva] = useState({ codigo: '', nombre: '', tipo: 'activo' as TipoCuenta, naturaleza: 'deudora' as NaturalezaCuenta, nivel: 1, esHoja: true });

  const filtradas = useMemo(() => {
    const lista = query ? buscar(query) : cuentas;
    return showInactivos ? lista : lista.filter(c => c.activo);
  }, [query, cuentas, buscar, showInactivos]);

  // Build tree — only when not searching
  const tree = useMemo(() => {
    if (query) return null;
    const raices = filtradas.filter(c => c.nivel === 1).sort((a,b) => a.codigo.localeCompare(b.codigo));
    return raices;
  }, [filtradas, query]);

  function getHijos(codigoPadre: string) {
    const nivel = codigoPadre.length + (codigoPadre.length <= 2 ? 2 : 1);
    return filtradas.filter(c => c.codigo.startsWith(codigoPadre) && c.codigo !== codigoPadre && c.nivel === Math.min(nivel, codigoPadre.length + 1))
      .sort((a,b) => a.codigo.localeCompare(b.codigo));
  }

  function toggle(codigo: string) {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo); else next.add(codigo);
      return next;
    });
  }

  async function handleInicializar() {
    const ok = await confirmAction({ title: 'Confirmar acción', description: '¿Inicializar el Plan de Cuentas PCGE estándar? Se agregarán 130+ cuentas.', confirmLabel: 'Inicializar' });
    if (!ok) return;
    setInicializando(true);
    try { await inicializarPCGE(); } finally { setInicializando(false); }
  }

  async function handleCrear() {
    if (!nueva.codigo || !nueva.nombre) return;
    setGuardando(true);
    try {
      await crearCuenta({ ...nueva });
      setModalNueva(false);
      setNueva({ codigo: '', nombre: '', tipo: 'activo', naturaleza: 'deudora', nivel: 1, esHoja: true });
    } finally { setGuardando(false); }
  }

  function CuentaRow({ codigo, depth = 0 }: { codigo: string; depth?: number }) {
    const cuenta = cuentas.find(c => c.codigo === codigo);
    if (!cuenta) return null;
    const hijos = getHijos(codigo);
    const expanded = expandidos.has(codigo);
    const hasHijos = hijos.length > 0 || !cuenta.esHoja;

    return (
      <>
        <div className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/40 group text-sm ${!cuenta.activo ? 'opacity-50' : ''}`}
          style={{ paddingLeft: `${8 + depth * 20}px` }}>
          {hasHijos ? (
            <button onClick={() => toggle(codigo)} className="size-5 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : (
            <div className="size-5 shrink-0" />
          )}
          <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{cuenta.codigo}</span>
          <span className="flex-1 truncate font-medium">{cuenta.nombre}</span>
          <Badge variant="secondary" className={`text-[10px] py-0 px-1.5 hidden sm:flex ${TIPO_CUENTA_COLORS[cuenta.tipo]}`}>
            {TIPO_CUENTA_LABELS[cuenta.tipo]}
          </Badge>
          {cuenta.aceptaMovimientos && (
            <span className="text-[10px] text-muted-foreground hidden md:block">Hoja</span>
          )}
          <button onClick={() => toggleActivo(cuenta.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity size-5 flex items-center justify-center text-muted-foreground hover:text-foreground">
            {cuenta.activo ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          </button>
        </div>
        {expanded && hijos.map(h => <CuentaRow key={h.codigo} codigo={h.codigo} depth={depth + 1} />)}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Layers className="size-5 text-primary" />Plan de Cuentas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{cuentas.filter(c=>c.activo).length} cuentas activas · PCGE Perú</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowInactivos(v=>!v)}>
            {showInactivos ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {showInactivos ? 'Ocultar inactivas' : 'Ver inactivas'}
          </Button>
          {cuentas.length === 0 && (
            <Button size="sm" variant="outline" onClick={handleInicializar} disabled={inicializando} className="gap-1.5">
              <Zap className="size-3.5" />{inicializando ? 'Inicializando…' : 'Inicializar PCGE'}
            </Button>
          )}
          <Button size="sm" onClick={() => setModalNueva(true)} className="gap-1.5">
            <Plus className="size-3.5" /> Nueva Cuenta
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por código o nombre…" className="pl-9 text-sm" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Cargando plan de cuentas…</div>
          ) : cuentas.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Layers className="size-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Sin cuentas. Inicializa el PCGE estándar o agrega manualmente.</p>
              <Button size="sm" onClick={handleInicializar} disabled={inicializando} className="gap-1.5">
                <Zap className="size-3.5" />{inicializando ? 'Inicializando…' : 'Inicializar PCGE Perú'}
              </Button>
            </div>
          ) : (
            <div className="py-1">
              {query ? (
                filtradas.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sin resultados para "{query}"</p>
                ) : (
                  filtradas.map(c => (
                    <div key={c.codigo} className={`flex items-center gap-2 py-1.5 px-3 hover:bg-muted/40 text-sm ${!c.activo ? 'opacity-50' : ''}`}>
                      <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{c.codigo}</span>
                      <span className="flex-1 truncate">{c.nombre}</span>
                      <Badge variant="secondary" className={`text-[10px] py-0 px-1.5 ${TIPO_CUENTA_COLORS[c.tipo]}`}>
                        {TIPO_CUENTA_LABELS[c.tipo]}
                      </Badge>
                    </div>
                  ))
                )
              ) : (
                tree?.map(raiz => <CuentaRow key={raiz.codigo} codigo={raiz.codigo} depth={0} />)
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal nueva cuenta */}
      <Dialog open={modalNueva} onOpenChange={setModalNueva}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nueva Cuenta Contable</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Código *</Label>
                <Input value={nueva.codigo} onChange={e => setNueva(v=>({...v, codigo: e.target.value}))}
                  placeholder="ej. 1011.01" className="text-sm font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nivel</Label>
                <Input type="number" min={1} max={6} value={nueva.nivel}
                  onChange={e => setNueva(v=>({...v, nivel: Number(e.target.value)}))} className="text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nombre *</Label>
              <Input value={nueva.nombre} onChange={e => setNueva(v=>({...v, nombre: e.target.value}))}
                placeholder="Nombre de la cuenta" className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={nueva.tipo} onValueChange={v => setNueva(p=>({...p, tipo: v as TipoCuenta}))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_CUENTA_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Naturaleza</Label>
                <Select value={nueva.naturaleza} onValueChange={v => setNueva(p=>({...p, naturaleza: v as NaturalezaCuenta}))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deudora">Deudora</SelectItem>
                    <SelectItem value="acreedora">Acreedora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalNueva(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCrear} disabled={!nueva.codigo || !nueva.nombre || guardando}>
              {guardando ? 'Guardando…' : 'Crear Cuenta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * ACCESOS AL PORTAL, DE VARIOS PROVEEDORES A LA VEZ.
 *
 * Hasta ahora había que entrar a la ficha de cada proveedor, habilitarlo,
 * copiar el enlace, abrir el correo y escribir los pasos a mano. Con 98
 * proveedores ya dados de alta, cada tanda era un día de trabajo.
 *
 * Aquí se marcan los que hagan falta, se generan todos los enlaces de una vez y
 * cada uno sale con su correo ya redactado: un botón abre Outlook con el
 * destinatario, el asunto y el texto puestos. El envío lo sigue haciendo una
 * persona desde su propia cuenta — el ERP no manda correos por su cuenta, y
 * mejor así: el proveedor contesta a quien le escribe.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Globe, Send, Copy, Mail, Loader2, CheckCircle2, AlertTriangle, Download, Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Checkbox } from '../../ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';
import { usePermissions } from '../../../lib/rbac/usePermissions';
import { exportToExcel } from '../../../lib/shared/export-utils';
import {
  asuntoPortal, cuerpoPortal, mailtoPortal, correoDelProveedor, puedeUsarPortal,
} from '../../../lib/proveedores/portal-mensaje';

interface Fila {
  id: string;
  codigo: string;
  razonSocial: string;
  ruc: string;
  email: string;
  habilitado: boolean;
  domiciliado: boolean;
}

interface Resultado {
  id: string;
  razonSocial: string;
  ruc: string;
  email: string;
  enlace?: string;
  error?: string;
}

type Filtro = 'pendientes' | 'habilitados' | 'todos';

export function PortalAccesosLote() {
  const { can } = usePermissions();
  const puedeGestionar = can('proveedores', 'editar') || can('proveedores', 'crear');

  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [trabajando, setTrabajando] = useState(false);
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 });
  const [resultados, setResultados] = useState<Resultado[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from('proveedores')
      .select('id, codigo, razon_social, ruc, email, email_portal, domiciliado, portal_habilitado')
      .order('razon_social');
    if (error) toast.error('No se pudo cargar el directorio: ' + error.message);
    setFilas((data ?? []).map((r: Record<string, unknown>): Fila => ({
      id: r.id as string,
      codigo: (r.codigo as string) ?? '',
      razonSocial: (r.razon_social as string) ?? '',
      ruc: (r.ruc as string) ?? '',
      email: correoDelProveedor({
        emailPortal: r.email_portal as string | null,
        email: r.email as string | null,
      }),
      habilitado: (r.portal_habilitado as boolean) ?? false,
      domiciliado: (r.domiciliado as boolean) ?? true,
    })));
    setCargando(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  /**
   * Solo se listan los que el portal admite: domiciliados y con RUC peruano de
   * 11 dígitos, porque el usuario del portal ES el RUC. Los demás no es que
   * fallen: es que no entran por ahí, y enseñarlos solo confunde.
   */
  const elegibles = useMemo(() => filas.filter(puedeUsarPortal), [filas]);

  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return elegibles.filter(f => {
      if (filtro === 'pendientes' && f.habilitado) return false;
      if (filtro === 'habilitados' && !f.habilitado) return false;
      if (!t) return true;
      return f.razonSocial.toLowerCase().includes(t)
        || f.ruc.includes(t)
        || f.codigo.toLowerCase().includes(t)
        || f.email.toLowerCase().includes(t);
    });
  }, [elegibles, busqueda, filtro]);

  /** Sin correo no hay a quién mandarle nada: se puede marcar, pero se avisa. */
  const marcadosSinCorreo = useMemo(
    () => visibles.filter(f => marcados.has(f.id) && !f.email).length,
    [visibles, marcados],
  );

  const alternar = (id: string) => setMarcados(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  const marcarTodosVisibles = (marcar: boolean) => setMarcados(prev => {
    const s = new Set(prev);
    visibles.forEach(f => { if (marcar) s.add(f.id); else s.delete(f.id); });
    return s;
  });

  const generar = async () => {
    const lote = elegibles.filter(f => marcados.has(f.id) && f.email);
    if (lote.length === 0) {
      toast.error('Marca al menos un proveedor que tenga correo registrado');
      return;
    }
    setTrabajando(true);
    setResultados([]);
    setProgreso({ hechos: 0, total: lote.length });

    const { data: s } = await supabase.auth.getSession();
    const salida: Resultado[] = [];

    // De uno en uno a propósito: cada alta crea una cuenta y pide un enlace a
    // GoTrue. En paralelo se come el límite de peticiones y empiezan a fallar
    // unas sí y otras no, que es lo peor que puede pasar en un lote.
    for (const f of lote) {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-proveedor-alta`,
          {
            method: 'POST',
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${s.session?.access_token ?? ''}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              proveedor_id: f.id,
              accion: f.habilitado ? 'reenviar' : 'alta',
              email: f.email,
            }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error || !data.enlace_contrasena) {
          salida.push({
            id: f.id, razonSocial: f.razonSocial, ruc: f.ruc, email: f.email,
            error: data.error ?? `Error ${res.status}`,
          });
        } else {
          salida.push({
            id: f.id, razonSocial: f.razonSocial, ruc: f.ruc, email: f.email,
            enlace: data.enlace_contrasena,
          });
        }
      } catch (e) {
        salida.push({
          id: f.id, razonSocial: f.razonSocial, ruc: f.ruc, email: f.email,
          error: e instanceof Error ? e.message : 'Fallo de red',
        });
      }
      setProgreso(p => ({ ...p, hechos: p.hechos + 1 }));
      setResultados([...salida]);
    }

    setTrabajando(false);
    const ok = salida.filter(r => r.enlace).length;
    const mal = salida.length - ok;
    if (mal === 0) toast.success(`${ok} accesos listos para enviar`);
    else toast.warning(`${ok} listos, ${mal} con problema`, {
      description: 'Los que fallaron salen marcados abajo con el motivo.',
    });
    void cargar();
  };

  const copiar = async (texto: string, queEs: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${queEs} copiado`);
    } catch {
      toast.error('No se pudo copiar; selecciona el texto a mano');
    }
  };

  const copiarTodo = () => {
    const bloques = resultados.filter(r => r.enlace).map(r =>
      [`PARA: ${r.email}`, `ASUNTO: ${asuntoPortal(r)}`, '',
        cuerpoPortal({ ...r, enlace: r.enlace! }), '', '─'.repeat(60), ''].join('\n'));
    void copiar(bloques.join('\n'), `${bloques.length} correos`);
  };

  const exportar = () => {
    exportToExcel(
      `accesos-portal-${new Date().toISOString().slice(0, 10)}`,
      resultados.map(r => ({
        proveedor: r.razonSocial,
        ruc: r.ruc,
        correo: r.email,
        enlace: r.enlace ?? '',
        problema: r.error ?? '',
      })),
      { proveedor: 'Proveedor', ruc: 'RUC (usuario)', correo: 'Correo', enlace: 'Enlace de contraseña', problema: 'Problema' },
    );
  };

  if (!puedeGestionar) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Esta pantalla crea cuentas de proveedor. Hace falta permiso de edición en Proveedores.
        </CardContent>
      </Card>
    );
  }

  const sinCorreo = elegibles.filter(f => !f.email).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Globe className="size-6" />
          Accesos al Portal de Proveedores
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Marca los proveedores, genera sus enlaces de una vez y envíales el correo ya escrito.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por razón social, RUC o correo…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
            <Select value={filtro} onValueChange={(v: string) => setFiltro(v as Filtro)}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendientes">Sin acceso todavía</SelectItem>
                <SelectItem value="habilitados">Ya habilitados</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => marcarTodosVisibles(true)} disabled={trabajando}>
              Marcar los {visibles.length}
            </Button>
            <Button variant="outline" onClick={() => setMarcados(new Set())} disabled={trabajando}>
              Quitar marcas
            </Button>
            <Button onClick={generar} disabled={trabajando || marcados.size === 0}>
              {trabajando
                ? <><Loader2 className="size-4 animate-spin" /> {progreso.hechos}/{progreso.total}</>
                : <><Send className="size-4" /> Generar accesos ({marcados.size})</>}
            </Button>
          </div>

          {sinCorreo > 0 && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" />
              {sinCorreo} {sinCorreo === 1 ? 'proveedor no tiene' : 'proveedores no tienen'} correo
              registrado. Sin correo no hay a quién mandarle el enlace: complétalo en su ficha.
            </p>
          )}
          {marcadosSinCorreo > 0 && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" />
              {marcadosSinCorreo} de los marcados no tienen correo y se saltarán.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {cargando ? 'Cargando…' : `${visibles.length} proveedores`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-y-auto divide-y">
            {visibles.map(f => (
              <label
                key={f.id}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/40"
              >
                <Checkbox
                  checked={marcados.has(f.id)}
                  onCheckedChange={() => alternar(f.id)}
                  disabled={trabajando}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{f.razonSocial}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {f.ruc}
                    {f.email
                      ? ` · ${f.email}`
                      : ' · sin correo registrado'}
                  </p>
                </div>
                {f.habilitado
                  ? <Badge variant="secondary" className="shrink-0">Habilitado</Badge>
                  : <Badge variant="outline" className="shrink-0">Sin acceso</Badge>}
              </label>
            ))}
            {!cargando && visibles.length === 0 && (
              <p className="px-4 py-8 text-sm text-muted-foreground text-center">
                Ningún proveedor coincide con lo buscado.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {resultados.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">
              Correos listos ({resultados.filter(r => r.enlace).length})
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copiarTodo}>
                <Copy className="size-4" /> Copiar todos
              </Button>
              <Button size="sm" variant="outline" onClick={exportar}>
                <Download className="size-4" /> Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Cada enlace es de un solo uso y vence en 24 horas. Envíalos hoy; si alguno caduca,
              vuelve a generarlo desde aquí.
            </p>
            {resultados.map(r => (
              <div
                key={r.id}
                className={`rounded-md border p-3 space-y-2 ${
                  r.error ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.razonSocial}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </div>
                  {r.error
                    ? <AlertTriangle className="size-4 text-red-600 shrink-0" />
                    : <CheckCircle2 className="size-4 text-green-600 shrink-0" />}
                </div>
                {r.error ? (
                  <p className="text-xs text-red-700 dark:text-red-400">{r.error}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" asChild>
                      <a href={mailtoPortal({ ...r, enlace: r.enlace! })}>
                        <Mail className="size-4" /> Abrir en correo
                      </a>
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => copiar(cuerpoPortal({ ...r, enlace: r.enlace! }), 'Texto del correo')}
                    >
                      <Copy className="size-4" /> Copiar texto
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => copiar(r.enlace!, 'Enlace')}
                    >
                      <Copy className="size-4" /> Solo el enlace
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

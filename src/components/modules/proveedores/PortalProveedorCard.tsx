/**
 * Gestión del acceso al Portal de Proveedores desde el detalle del proveedor.
 * Llama a la Edge Function portal-proveedor-alta (staff-only): habilitar,
 * reenviar enlace de contraseña y revocar. Sin SMTP: muestra el enlace para
 * que el comprador lo envíe al email real del proveedor.
 */
import { useCallback, useEffect, useState } from 'react';
import { Globe, Copy, Send, ShieldOff, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';

interface Props {
  proveedorDbId: string;
  ruc: string;
  emailSugerido?: string | null;
}

interface EstadoPortal {
  domiciliado: boolean;
  portalHabilitado: boolean;
  emailPortal: string | null;
}

export function PortalProveedorCard({ proveedorDbId, ruc, emailSugerido }: Props) {
  const [estado, setEstado] = useState<EstadoPortal | null>(null);
  const [email, setEmail] = useState('');
  const [enlace, setEnlace] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('proveedores')
      .select('domiciliado, portal_habilitado, email_portal')
      .eq('id', proveedorDbId)
      .maybeSingle();
    if (data) {
      setEstado({
        domiciliado: data.domiciliado ?? true,
        portalHabilitado: data.portal_habilitado ?? false,
        emailPortal: data.email_portal ?? null,
      });
      setEmail(data.email_portal ?? emailSugerido ?? '');
    }
  }, [proveedorDbId, emailSugerido]);

  useEffect(() => { cargar(); }, [cargar]);

  const llamar = async (accion: 'alta' | 'reenviar' | 'revocar') => {
    setTrabajando(true);
    setEnlace('');
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-proveedor-alta`, {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${s.session?.access_token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proveedor_id: proveedorDbId, accion, email: email || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        toast.error(data.error ?? `Error ${res.status}`);
        return;
      }
      toast.success(data.mensaje ?? 'Listo');
      if (data.enlace_contrasena) setEnlace(data.enlace_contrasena);
      cargar();
    } finally {
      setTrabajando(false);
    }
  };

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      toast.success('Enlace copiado — envíalo al correo del proveedor');
    } catch {
      toast.error('No se pudo copiar; selecciónalo manualmente');
    }
  };

  const rucValido = /^\d{11}$/.test(ruc ?? '');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Globe className="size-5" /> Portal de Proveedores
          </span>
          {estado && (
            estado.portalHabilitado
              ? <Badge>Habilitado</Badge>
              : <Badge variant="outline">Sin acceso</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!estado ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : !estado.domiciliado ? (
          <p className="text-sm text-muted-foreground">
            Proveedor <strong>no domiciliado</strong>: no usa el portal. Sus documentos del
            exterior los registra el equipo interno directamente sobre la orden.
          </p>
        ) : !rucValido ? (
          <p className="text-sm text-amber-600">
            El RUC actual ({ruc}) no es válido de 11 dígitos. Corrige el RUC del proveedor
            antes de habilitar su acceso al portal.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              El proveedor ingresa en <strong>erp.memphismaquinarias.com/portal</strong> con su
              RUC ({ruc}) y una contraseña que él mismo define mediante un enlace de un solo uso.
            </p>
            <div>
              <Label className="mb-1.5 block">Email real del proveedor (recibe el enlace y avisos)</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="facturacion@proveedor.com" />
            </div>
            <div className="flex flex-wrap gap-2">
              {!estado.portalHabilitado ? (
                <Button onClick={() => llamar('alta')} disabled={trabajando || !email}>
                  <Send className="size-4" /> {trabajando ? 'Habilitando…' : 'Habilitar portal'}
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => llamar('reenviar')} disabled={trabajando}>
                    <Send className="size-4" /> Regenerar enlace de contraseña
                  </Button>
                  <Button variant="outline" className="text-red-600 hover:!bg-red-600 hover:!text-white" onClick={() => llamar('revocar')} disabled={trabajando}>
                    <ShieldOff className="size-4" /> Revocar acceso
                  </Button>
                </>
              )}
            </div>
            {enlace && (
              <div className="rounded-md border border-green-300 bg-green-50 dark:bg-green-950/20 p-3 space-y-2">
                <p className="text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-green-600" />
                  Envía este enlace a <strong>{email}</strong> para que el proveedor defina su contraseña (expira en 24h):
                </p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={enlace} className="text-xs font-mono" onFocus={e => e.target.select()} />
                  <Button size="sm" variant="outline" onClick={copiarEnlace}><Copy className="size-4" /></Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

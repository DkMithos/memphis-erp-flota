// Portal de proveedores — alta/gestión de credenciales (Fase B).
// La ejecuta el personal interno de Memphis (staff autenticado del tenant).
// Crea la cuenta del proveedor (alias {ruc}@proveedores.memphismaquinarias.com),
// y genera el enlace de un solo uso para que el PROVEEDOR fije su contraseña
// (Memphis nunca ve ni define la contraseña). Sin SMTP propio: la función
// devuelve el enlace y el staff lo envía al email real del proveedor.
import { withSupabase } from 'npm:@supabase/server';

interface Body {
  proveedor_id: string;
  accion?: 'alta' | 'reenviar' | 'revocar';
  email?: string; // email real del proveedor (para registrar/actualizar)
}

const DOMINIO_ALIAS = 'proveedores.memphismaquinarias.com';
const REDIRECT_CLAVE = 'https://erp.memphismaquinarias.com/portal/clave';

// GoTrue Admin API por REST directo (errores legibles; el wrapper los oculta)
const SECRET = Deno.env.get('SUPABASE_SECRET_KEY')
  ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AUTH_URL = `${Deno.env.get('SUPABASE_URL')}/auth/v1/admin`;
async function gotrueAdmin(path: string, method: string, body?: unknown) {
  const res = await fetch(`${AUTH_URL}${path}`, {
    method,
    headers: {
      'apikey': SECRET,
      'Authorization': `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Método no permitido' }, { status: 405 });
    }

    // 1. El llamador debe ser staff interno (tiene tenant en el JWT y NO es proveedor)
    const { data: userRes } = await ctx.supabase.auth.getUser();
    const meta = userRes?.user?.app_metadata ?? {};
    const callerTenant = meta.tenant_id as string | undefined;
    if (meta.tipo === 'proveedor' || !callerTenant) {
      return Response.json({ error: 'Solo el personal interno puede gestionar accesos del portal' }, { status: 403 });
    }

    let body: Body;
    try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
    const accion = body.accion ?? 'alta';
    if (!body.proveedor_id) return Response.json({ error: 'Falta proveedor_id' }, { status: 400 });

    // 2. Proveedor válido, del mismo tenant, domiciliado y con RUC de 11 dígitos
    const { data: prov } = await ctx.supabaseAdmin
      .from('proveedores')
      .select('id, tenant_id, codigo, ruc, razon_social, email, email_portal, domiciliado, portal_habilitado, portal_user_id')
      .eq('id', body.proveedor_id)
      .maybeSingle();
    if (!prov || prov.tenant_id !== callerTenant) {
      return Response.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }
    if (!prov.domiciliado) {
      return Response.json({ error: `${prov.razon_social} es no domiciliado: sus documentos los gestiona el equipo interno (no usa el portal)` }, { status: 422 });
    }
    if (!/^\d{11}$/.test(prov.ruc ?? '')) {
      return Response.json({ error: `${prov.razon_social} no tiene RUC válido de 11 dígitos (actual: ${prov.ruc}). Corrija el RUC antes de habilitar el portal` }, { status: 422 });
    }

    const alias = `${prov.ruc}@${DOMINIO_ALIAS}`;

    // 3. Revocar acceso
    if (accion === 'revocar') {
      if (prov.portal_user_id) {
        await gotrueAdmin(`/users/${prov.portal_user_id}`, 'PUT', { ban_duration: '87600h' });
      }
      await ctx.supabaseAdmin.from('proveedores')
        .update({ portal_habilitado: false }).eq('id', prov.id);
      return Response.json({ ok: true, mensaje: `Acceso al portal revocado para ${prov.razon_social}` });
    }

    // 4. Email real (para el enlace de contraseña y avisos)
    const emailReal = (body.email ?? prov.email_portal ?? prov.email ?? '').trim();
    if (!emailReal || !emailReal.includes('@')) {
      return Response.json({ error: 'El proveedor no tiene email registrado. Indique el email real para enviarle el enlace de contraseña' }, { status: 422 });
    }

    // 5. Crear la cuenta si no existe (alta); si ya existe, solo regenerar enlace (reenviar)
    let userId = prov.portal_user_id as string | null;
    if (!userId) {
      const created = await gotrueAdmin('/users', 'POST', {
        email: alias,
        email_confirm: true,
        app_metadata: {
          tipo: 'proveedor',
          proveedor_id: prov.id,
          ruc: prov.ruc,
          // OJO: NO se incluye tenant_id — así auth_tenant_id() devuelve NULL y
          // ninguna política interna del ERP deja pasar al proveedor.
        },
        user_metadata: { razon_social: prov.razon_social, codigo: prov.codigo },
      });
      const yaExiste = created.status === 422 && /already|exists|registered/i.test(JSON.stringify(created.data));
      if (!created.ok && !yaExiste) {
        console.error('[portal-alta] createUser error:', created.status, JSON.stringify(created.data));
        return Response.json({ error: `No se pudo crear la cuenta (HTTP ${created.status}): ${created.data?.msg ?? created.data?.message ?? JSON.stringify(created.data)}` }, { status: 500 });
      }
      userId = created.data?.id ?? null;
    }

    // 6. Enlace de un solo uso para fijar contraseña (lo envía el staff al email real)
    const link = await gotrueAdmin('/generate_link', 'POST', {
      type: 'recovery',
      email: alias,
      redirect_to: REDIRECT_CLAVE,
    });
    if (!link.ok) {
      console.error('[portal-alta] generateLink error:', link.status, JSON.stringify(link.data));
      return Response.json({ error: `Cuenta lista pero no se pudo generar el enlace (HTTP ${link.status}): ${link.data?.msg ?? JSON.stringify(link.data)}` }, { status: 500 });
    }

    // 7. Marcar habilitado y guardar metadatos
    await ctx.supabaseAdmin.from('proveedores')
      .update({
        portal_habilitado: true,
        email_portal: emailReal,
        portal_user_id: userId ?? linkRes.user?.id ?? null,
      })
      .eq('id', prov.id);

    return Response.json({
      ok: true,
      proveedor: { codigo: prov.codigo, razon_social: prov.razon_social, ruc: prov.ruc },
      login_ruc: prov.ruc,
      email_portal: emailReal,
      enlace_contrasena: linkRes.properties?.action_link,
      mensaje: `Portal habilitado para ${prov.razon_social}. Envíe el enlace a ${emailReal} para que defina su contraseña (expira en 24h; puede regenerarlo con "reenviar").`,
    });
  }),
};

// Portal de talleres — alta/gestión de credenciales (Fase C).
// La ejecuta el personal interno de Memphis (staff autenticado del tenant).
// Crea la cuenta del taller (alias {codigo}@talleres.memphismaquinarias.com) y
// genera el enlace de un solo uso para que el TALLER fije su contraseña (Memphis
// nunca la ve). Identidad de login = codigo del taller (NO RUC: un taller puede
// no tener RUC). Sin SMTP propio: devuelve el enlace y el staff lo envía.
import { withSupabase } from 'npm:@supabase/server';

interface Body {
  taller_id: string;
  accion?: 'alta' | 'reenviar' | 'revocar';
  email?: string; // email real del taller (para el enlace de contraseña)
}

const DOMINIO_ALIAS = 'talleres.memphismaquinarias.com';
const REDIRECT_CLAVE = 'https://erp.memphismaquinarias.com/taller/clave';

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

    // 1. El llamador debe ser staff interno (tiene tenant en el JWT y NO es portal)
    const { data: userRes } = await ctx.supabase.auth.getUser();
    const meta = userRes?.user?.app_metadata ?? {};
    const callerTenant = meta.tenant_id as string | undefined;
    if (meta.tipo === 'proveedor' || meta.tipo === 'taller' || !callerTenant) {
      return Response.json({ error: 'Solo el personal interno puede gestionar accesos del portal' }, { status: 403 });
    }

    let body: Body;
    try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
    const accion = body.accion ?? 'alta';
    if (!body.taller_id) return Response.json({ error: 'Falta taller_id' }, { status: 400 });

    // 2. Taller válido, del mismo tenant
    const { data: taller, error: tallerErr } = await ctx.supabaseAdmin
      .from('talleres')
      .select('id, tenant_id, codigo, nombre, contacto_email, email_portal, portal_habilitado, portal_user_id')
      .eq('id', body.taller_id)
      .maybeSingle();
    // Un fallo de consulta (p.ej. columna inexistente) NO es "no encontrado":
    // se reporta tal cual para no esconder el problema real detras de un 404.
    if (tallerErr) {
      console.error('[taller-alta] consulta talleres:', tallerErr.message);
      return Response.json({ error: `Error consultando el taller: ${tallerErr.message}` }, { status: 500 });
    }
    if (!taller || taller.tenant_id !== callerTenant) {
      return Response.json({ error: 'Taller no encontrado' }, { status: 404 });
    }
    if (!taller.codigo) {
      return Response.json({ error: 'El taller no tiene código asignado' }, { status: 422 });
    }

    const alias = `${String(taller.codigo).toLowerCase()}@${DOMINIO_ALIAS}`;

    // 3. Revocar acceso
    if (accion === 'revocar') {
      if (taller.portal_user_id) {
        await gotrueAdmin(`/users/${taller.portal_user_id}`, 'PUT', { ban_duration: '87600h' });
      }
      await ctx.supabaseAdmin.from('talleres')
        .update({ portal_habilitado: false }).eq('id', taller.id);
      return Response.json({ ok: true, mensaje: `Acceso al portal revocado para ${taller.nombre}` });
    }

    // 4. Email real (para el enlace de contraseña)
    const emailReal = (body.email ?? taller.email_portal ?? taller.contacto_email ?? '').trim();
    if (!emailReal || !emailReal.includes('@')) {
      return Response.json({ error: 'El taller no tiene email registrado. Indique el email real para enviarle el enlace de contraseña' }, { status: 422 });
    }

    // 5. Crear la cuenta si no existe (alta); si ya existe, solo regenerar enlace
    let userId = taller.portal_user_id as string | null;
    if (!userId) {
      const created = await gotrueAdmin('/users', 'POST', {
        email: alias,
        email_confirm: true,
        app_metadata: {
          tipo: 'taller',
          taller_id: taller.id,
          codigo: taller.codigo,
          // OJO: SIN tenant_id — auth_tenant_id() devuelve NULL y ninguna política
          // interna del ERP deja pasar al taller.
        },
        user_metadata: { nombre: taller.nombre, codigo: taller.codigo },
      });
      const yaExiste = created.status === 422 && /already|exists|registered/i.test(JSON.stringify(created.data));
      if (!created.ok && !yaExiste) {
        console.error('[taller-alta] createUser error:', created.status, JSON.stringify(created.data));
        return Response.json({ error: `No se pudo crear la cuenta (HTTP ${created.status}): ${created.data?.msg ?? created.data?.message ?? JSON.stringify(created.data)}` }, { status: 500 });
      }
      userId = created.data?.id ?? null;
    }

    // 6. Enlace de un solo uso para fijar contraseña
    const link = await gotrueAdmin('/generate_link', 'POST', {
      type: 'recovery',
      email: alias,
      redirect_to: REDIRECT_CLAVE,
    });
    if (!link.ok) {
      console.error('[taller-alta] generateLink error:', link.status, JSON.stringify(link.data));
      return Response.json({ error: `Cuenta lista pero no se pudo generar el enlace (HTTP ${link.status}): ${link.data?.msg ?? JSON.stringify(link.data)}` }, { status: 500 });
    }

    // 7. Marcar habilitado y guardar metadatos
    await ctx.supabaseAdmin.from('talleres')
      .update({
        portal_habilitado: true,
        email_portal: emailReal,
        portal_user_id: userId ?? link.data?.user?.id ?? null,
      })
      .eq('id', taller.id);

    return Response.json({
      ok: true,
      taller: { codigo: taller.codigo, nombre: taller.nombre },
      login_codigo: taller.codigo,
      email_portal: emailReal,
      enlace_contrasena: link.data?.action_link ?? link.data?.properties?.action_link,
      mensaje: `Portal habilitado para ${taller.nombre}. Envíe el enlace a ${emailReal} para que defina su contraseña (expira en 24h; puede regenerarlo con "reenviar").`,
    });
  }),
};

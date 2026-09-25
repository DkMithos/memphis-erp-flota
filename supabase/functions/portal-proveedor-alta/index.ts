// Portal de proveedores — alta/gestión de credenciales (Fase B).
// La ejecuta el personal interno de Memphis (staff autenticado del tenant).
// Crea la cuenta del proveedor (alias {ruc}@proveedores.memphismaquinarias.com),
// y genera el enlace de un solo uso para que el PROVEEDOR fije su contraseña
// (Memphis nunca ve ni define la contraseña). El enlace sale por correo solo
// (correo-enviar → Microsoft Graph); si el correo falla, se devuelve el enlace
// para que el staff lo mande a mano.
import { withSupabase } from 'npm:@supabase/server';

interface Body {
  proveedor_id: string;
  accion?: 'alta' | 'reenviar' | 'revocar';
  email?: string; // email real del proveedor (para registrar/actualizar)
}

const DOMINIO_ALIAS = 'proveedores.memphismaquinarias.com';
// El proveedor recibe un CÓDIGO OPACO de Memphis (no el link de recovery de
// GoTrue, que los bots de previsualización quemaban con el primer GET). Esta
// página es HTML estático: bajarla no consume nada. La invitación solo se
// consume cuando una persona envía su contraseña (ver portal-fijar-clave).
const GUIA_URL = 'https://erp.memphismaquinarias.com/portal/guia-proveedores.pdf';
const INVITACION_BASE = 'https://erp.memphismaquinarias.com/portal/invitacion';
const INVITACION_HORAS = 72;

// Código opaco de alta entropía (32 bytes → base64url) y su hash sha256 (hex).
// En la BD solo se guarda el hash; el código en claro viaja únicamente al staff.
function nuevoCodigo(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('');
}

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

/** Manda el enlace de contraseña por la puerta única de correo del ERP. Nunca lanza. */
async function enviarEnlacePorCorreo(p: {
  tenantId: string; para: string; razonSocial: string; ruc: string; enlace: string; regenerado: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222;max-width:560px">
      <p>Estimados <b>${p.razonSocial}</b>,</p>
      <p>Memphis Maquinarias ${p.regenerado ? 'le vuelve a enviar' : 'le da'} acceso a su <b>Portal de Proveedores</b>, donde ve sus órdenes de compra y sube sus facturas (XML + PDF) para que entren directo a pago.</p>
      <p>Para crear su contraseña, abra este enlace (vale ${INVITACION_HORAS} horas y se usa una sola vez):</p>
      <p><a href="${p.enlace}" style="display:inline-block;background:#0A66C2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Crear mi contraseña</a></p>
      <p style="font-size:12px;color:#555">Si el botón no abre, copie este enlace en su navegador:<br>${p.enlace}</p>
      <p>Luego ingrese en <b>erp.memphismaquinarias.com/portal</b> con su RUC <b>${p.ruc}</b> y la contraseña que creó.</p>
      <p>Por cada factura debe subir <b>dos archivos con el mismo nombre</b>: el <b>XML</b> y el <b>PDF</b>. Indique el número de la orden de compra (OrderReference del XML) para que se asigne sola.</p>
      <p>Le adjuntamos la <b>Guía del Portal de Proveedores</b> (PDF) con el paso a paso. También puede verla en: <a href="${GUIA_URL}">${GUIA_URL}</a>.</p>
      <p style="color:#555">Compras — Memphis Maquinarias S.A.C.</p>
    </div>`;
  try {
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/correo-enviar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: p.tenantId, para: p.para,
        asunto: `Acceso al Portal de Proveedores de Memphis Maquinarias — RUC ${p.ruc}`,
        html,
        // La guía va adjunta (correo-enviar la descarga del ERP). Si no se pudiera, el correo sale igual con el enlace.
        adjuntos_url: [{ nombre: 'Guia-Portal-Proveedores-Memphis.pdf', url: GUIA_URL }],
      }),
      signal: AbortSignal.timeout(40000),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.ok) return { ok: true };
    return { ok: false, error: data.error ?? `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
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

    if (!userId) {
      return Response.json({ error: 'No se pudo determinar la cuenta del proveedor' }, { status: 500 });
    }

    // 6. Invitación opaca de un solo uso para fijar contraseña. Se invalidan las
    // invitaciones anteriores no usadas (al reenviar, solo vale la última).
    await ctx.supabaseAdmin.from('portal_invitaciones')
      .update({ consumida_en: new Date().toISOString() })
      .eq('proveedor_id', prov.id).is('consumida_en', null);

    const codigo = nuevoCodigo();
    const codeHash = await sha256hex(codigo);
    const expira = new Date(Date.now() + INVITACION_HORAS * 3600_000).toISOString();
    const { error: eInvit } = await ctx.supabaseAdmin.from('portal_invitaciones').insert({
      tenant_id: callerTenant,
      proveedor_id: prov.id,
      portal_user_id: userId,
      code_hash: codeHash,
      email_destino: emailReal,
      expira_en: expira,
      creada_por: userRes?.user?.id ?? null,
    });
    if (eInvit) {
      console.error('[portal-alta] insert invitacion error:', JSON.stringify(eInvit));
      return Response.json({ error: `Cuenta lista pero no se pudo generar el enlace: ${eInvit.message}` }, { status: 500 });
    }

    // 7. Marcar habilitado y guardar metadatos
    await ctx.supabaseAdmin.from('proveedores')
      .update({ portal_habilitado: true, email_portal: emailReal, portal_user_id: userId })
      .eq('id', prov.id);

    const enlace = `${INVITACION_BASE}?code=${codigo}`;

    // 8. El correo sale solo (correo-enviar → Microsoft Graph). Si no se puede
    // —falta el permiso Mail.Send, buzón mal configurado— se devuelve el enlace
    // igual para que el staff lo mande a mano, y el motivo para arreglarlo.
    const correo = await enviarEnlacePorCorreo({
      tenantId: callerTenant, para: emailReal, razonSocial: prov.razon_social, ruc: prov.ruc, enlace,
      regenerado: accion === 'reenviar',
    });

    return Response.json({
      ok: true,
      proveedor: { codigo: prov.codigo, razon_social: prov.razon_social, ruc: prov.ruc },
      login_ruc: prov.ruc,
      email_portal: emailReal,
      enlace_contrasena: enlace,
      correo_enviado: correo.ok,
      correo_error: correo.ok ? null : correo.error,
      mensaje: correo.ok
        ? `Portal habilitado para ${prov.razon_social}. El enlace para crear su contraseña ya salió a ${emailReal} (vence en ${INVITACION_HORAS}h).`
        : `Portal habilitado para ${prov.razon_social}, pero el correo no salió (${correo.error}). Envíe el enlace a ${emailReal} a mano; vence en ${INVITACION_HORAS}h.`,
    });
  }),
};

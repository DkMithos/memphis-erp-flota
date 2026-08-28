// Alta y gestión de usuarios internos de Memphis.
//
// Reemplaza el diálogo "Nuevo Usuario" de Administración, que usaba
// supabase.auth.signUp() desde el navegador. Ese camino tenía tres problemas:
//   1. signUp REEMPLAZA la sesión del navegador → el admin quedaba logueado
//      como el usuario recién creado.
//   2. Obligaba al admin a inventar y teclear la contraseña de cada persona.
//   3. Dependía del correo de confirmación, y no hay SMTP propio.
//
// Aquí la cuenta se crea con la Admin API (ya confirmada) y se devuelve un
// enlace de un solo uso para que la propia persona fije su contraseña.
// Memphis nunca la ve. Mismo patrón que portal-proveedor-alta / portal-taller-alta.
import { withSupabase } from 'npm:@supabase/server';

interface Body {
  accion?: 'alta' | 'reenviar' | 'desactivar' | 'reactivar';
  email: string;
  nombre?: string;
  cargo?: string;
  rol_id?: string;
}

const REDIRECT_CLAVE = 'https://erp.memphismaquinarias.com/clave';
const PERMISO_REQUERIDO = { modulo: 'admin', accion: 'gestionar_usuarios' };

// GoTrue Admin API por REST directo (devuelve errores legibles).
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

    // ── 1. El llamador debe ser staff interno del tenant ──────────────────
    const { data: userRes, error: userErr } = await ctx.supabase.auth.getUser();
    const caller = userRes?.user;
    if (userErr || !caller) {
      return Response.json({ error: 'Sesión inválida' }, { status: 401 });
    }
    const meta = caller.app_metadata ?? {};
    const callerId = caller.id;
    if (meta.tipo === 'proveedor' || meta.tipo === 'taller') {
      return Response.json(
        { error: 'Solo el personal interno puede gestionar usuarios' },
        { status: 403 },
      );
    }
    // El tenant sale del JWT; si esa cuenta es anterior al metadato, se busca su
    // perfil. Así un admin válido nunca queda fuera por un JWT viejo.
    let tenantId = meta.tenant_id as string | undefined;
    if (!tenantId) {
      const { data: perfil } = await ctx.supabaseAdmin
        .from('usuarios_tenant')
        .select('tenant_id')
        .eq('user_id', callerId)
        .eq('estado', 'activo')
        .maybeSingle();
      tenantId = perfil?.tenant_id as string | undefined;
    }
    if (!tenantId) {
      return Response.json(
        { error: 'Tu cuenta no está asociada a ninguna empresa' },
        { status: 403 },
      );
    }

    // ── 2. …y tener el permiso admin.gestionar_usuarios ───────────────────
    //     Dos consultas simples en lugar de un embed anidado: el embed de
    //     PostgREST devolvía una forma que la comprobación no reconocía.
    const { data: misRoles, error: rolesErr } = await ctx.supabaseAdmin
      .from('usuarios_roles')
      .select('rol_id')
      .eq('user_id', callerId)
      .eq('tenant_id', tenantId);
    if (rolesErr) {
      console.error('[usuarios-alta] roles:', rolesErr.message);
      return Response.json({ error: `Error verificando permisos: ${rolesErr.message}` }, { status: 500 });
    }
    const rolIds = (misRoles ?? []).map((r) => r.rol_id);
    let puede = false;
    if (rolIds.length) {
      const { data: permisos, error: permErr } = await ctx.supabaseAdmin
        .from('roles_permisos')
        .select('permisos!inner(modulo, accion)')
        .in('rol_id', rolIds);
      if (permErr) {
        console.error('[usuarios-alta] permisos:', permErr.message);
        return Response.json({ error: `Error verificando permisos: ${permErr.message}` }, { status: 500 });
      }
      puede = (permisos ?? []).some((row) => {
        const p = (row as { permisos?: { modulo?: string; accion?: string } }).permisos;
        return p?.modulo === PERMISO_REQUERIDO.modulo && p?.accion === PERMISO_REQUERIDO.accion;
      });
    }
    if (!puede) {
      return Response.json(
        { error: 'Se requiere el permiso admin.gestionar_usuarios' },
        { status: 403 },
      );
    }

    let body: Body;
    try { body = await req.json(); } catch {
      return Response.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const accion = body.accion ?? 'alta';
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Falta un email válido' }, { status: 400 });
    }

    // ── 3. El dominio debe ser uno de los autorizados del tenant (N21) ─────
    const { data: dominios } = await ctx.supabaseAdmin
      .from('tenant_email_domains')
      .select('dominio')
      .eq('tenant_id', tenantId);
    const permitidos = (dominios ?? []).map((d) => String(d.dominio).toLowerCase());
    const dominio = email.split('@')[1];
    if (permitidos.length && !permitidos.includes(dominio)) {
      return Response.json(
        { error: `El dominio "${dominio}" no está autorizado. Permitidos: ${permitidos.join(', ')}` },
        { status: 422 },
      );
    }

    const { data: existente } = await ctx.supabaseAdmin
      .from('usuarios_tenant')
      .select('user_id, nombre, estado, cargo')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .maybeSingle();

    // ── 4. Desactivar / reactivar ─────────────────────────────────────────
    if (accion === 'desactivar' || accion === 'reactivar') {
      if (!existente) {
        return Response.json({ error: 'El usuario no existe en este tenant' }, { status: 404 });
      }
      if (existente.user_id === callerId) {
        return Response.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 422 });
      }
      const desactivar = accion === 'desactivar';
      await gotrueAdmin(`/users/${existente.user_id}`, 'PUT', {
        ban_duration: desactivar ? '876000h' : 'none',
      });
      await ctx.supabaseAdmin
        .from('usuarios_tenant')
        .update({ estado: desactivar ? 'inactivo' : 'activo' })
        .eq('tenant_id', tenantId)
        .eq('email', email);
      return Response.json({
        ok: true,
        mensaje: `Acceso ${desactivar ? 'desactivado' : 'reactivado'} para ${email}`,
      });
    }

    // ── 5. Alta (o reenvío del enlace) ────────────────────────────────────
    const nombre = String(body.nombre ?? existente?.nombre ?? '').trim();
    if (accion === 'alta' && !nombre) {
      return Response.json({ error: 'Falta el nombre del usuario' }, { status: 400 });
    }

    let userId = existente?.user_id as string | null ?? null;

    if (!userId) {
      // Puede existir en auth pero no en este tenant (p.ej. alta a medias)
      const busca = await gotrueAdmin(`/users?filter=${encodeURIComponent(email)}`, 'GET');
      userId = busca.data?.users?.find(
        (u: { email?: string; id: string }) => String(u.email).toLowerCase() === email,
      )?.id ?? null;
    }

    if (!userId) {
      const creado = await gotrueAdmin('/users', 'POST', {
        email,
        email_confirm: true,
        // Sin password: la fija la propia persona con el enlace de abajo.
        app_metadata: { provider: 'email', providers: ['email'], tenant_id: tenantId },
        user_metadata: { nombre },
      });
      if (!creado.ok) {
        console.error('[usuarios-alta] createUser:', creado.status, JSON.stringify(creado.data));
        return Response.json(
          { error: `No se pudo crear la cuenta (HTTP ${creado.status}): ${creado.data?.msg ?? creado.data?.message ?? JSON.stringify(creado.data)}` },
          { status: 500 },
        );
      }
      userId = creado.data?.id ?? null;
    } else {
      // Ya existía: aseguramos que el JWT lleve el tenant correcto
      await gotrueAdmin(`/users/${userId}`, 'PUT', {
        app_metadata: { provider: 'email', providers: ['email'], tenant_id: tenantId },
      });
    }

    if (!userId) {
      return Response.json({ error: 'No se pudo determinar el id del usuario' }, { status: 500 });
    }

    // Perfil en el tenant (idempotente)
    const { error: perfilErr } = await ctx.supabaseAdmin
      .from('usuarios_tenant')
      .upsert(
        {
          tenant_id: tenantId,
          user_id: userId,
          nombre: nombre || email,
          email,
          // Si no se manda cargo, se conserva el que ya tenía (no se borra).
          cargo: body.cargo?.trim() || existente?.cargo || null,
          estado: 'activo',
        },
        { onConflict: 'tenant_id,user_id' },
      );
    if (perfilErr) {
      console.error('[usuarios-alta] usuarios_tenant:', perfilErr.message);
      return Response.json({ error: `Cuenta creada pero falló el perfil: ${perfilErr.message}` }, { status: 500 });
    }

    // Rol (opcional, idempotente)
    let rolAsignado: string | null = null;
    if (body.rol_id) {
      const { data: rol } = await ctx.supabaseAdmin
        .from('roles')
        .select('id, nombre')
        .eq('id', body.rol_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!rol) {
        return Response.json({ error: 'El rol indicado no existe en este tenant' }, { status: 422 });
      }
      const { error: rolErr } = await ctx.supabaseAdmin
        .from('usuarios_roles')
        .upsert(
          { tenant_id: tenantId, user_id: userId, rol_id: rol.id },
          { onConflict: 'tenant_id,user_id,rol_id' },
        );
      if (rolErr) {
        console.error('[usuarios-alta] usuarios_roles:', rolErr.message);
        return Response.json({ error: `Usuario creado pero falló el rol: ${rolErr.message}` }, { status: 500 });
      }
      rolAsignado = rol.nombre;
    }

    // Enlace de un solo uso para que fije su contraseña
    const link = await gotrueAdmin('/generate_link', 'POST', {
      type: 'recovery',
      email,
      redirect_to: REDIRECT_CLAVE,
    });
    if (!link.ok) {
      console.error('[usuarios-alta] generate_link:', link.status, JSON.stringify(link.data));
      return Response.json(
        { error: `Usuario listo pero no se pudo generar el enlace (HTTP ${link.status}): ${link.data?.msg ?? JSON.stringify(link.data)}` },
        { status: 500 },
      );
    }

    return Response.json({
      ok: true,
      usuario: { email, nombre: nombre || email, rol: rolAsignado },
      enlace_clave: link.data?.action_link ?? link.data?.properties?.action_link,
      mensaje: `Cuenta lista para ${email}. Envíale el enlace para que defina su contraseña (expira en 24h; puedes regenerarlo con "reenviar").`,
    });
  }),
};

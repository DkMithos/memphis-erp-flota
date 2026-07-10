// Portal de proveedores — ingesta de factura (Fase A).
// El proveedor autenticado sube su XML (UBL 2.1) + PDF opcional; validamos,
// amarramos a la OC y registramos en comprobantes_pago (estado 'recibida').
// La aceptación real es posterior (conformidad interna cruzando con recepción).
import { withSupabase } from 'npm:@supabase/server';
import { parseUBLInvoice } from './ubl.ts';

interface Body {
  xml: string;              // contenido del XML UBL 2.1
  pdf_base64?: string;      // PDF opcional (representación impresa)
  orden_compra_id?: string; // opcional: si el XML no trae OrderReference
}

const BUCKET = 'facturas-proveedores';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Método no permitido' }, { status: 405 });
    }

    // 1. Identidad del proveedor desde el JWT (app_metadata la setea el alta, Fase B)
    const { data: userRes } = await ctx.supabase.auth.getUser();
    const meta = userRes?.user?.app_metadata ?? {};
    if (meta.tipo !== 'proveedor' || !meta.proveedor_id) {
      return Response.json({ error: 'Solo proveedores habilitados pueden subir facturas' }, { status: 403 });
    }
    const proveedorId = meta.proveedor_id as string;
    const rucProveedor = String(meta.ruc ?? '');
    const tenantId = meta.tenant_id as string;

    // 2. Parsear el XML
    let body: Body;
    try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
    if (!body?.xml) return Response.json({ error: 'Falta el XML de la factura' }, { status: 400 });

    let f;
    try { f = parseUBLInvoice(body.xml); }
    catch (e) { return Response.json({ error: `XML no válido: ${(e as Error).message}` }, { status: 422 }); }

    const errores: string[] = [];

    // 3. Validación de identidad: el emisor debe ser el proveedor logueado
    if (f.rucEmisor && rucProveedor && f.rucEmisor !== rucProveedor) {
      errores.push(`El RUC emisor del XML (${f.rucEmisor}) no coincide con su RUC (${rucProveedor}).`);
    }

    // 4. Validación de receptor: debe ser Memphis (RUC del tenant, si está configurado)
    const { data: tenant } = await ctx.supabaseAdmin
      .from('tenants').select('ruc').eq('id', tenantId).maybeSingle();
    if (tenant?.ruc && f.rucReceptor && f.rucReceptor !== tenant.ruc) {
      errores.push(`El RUC receptor del XML (${f.rucReceptor}) no corresponde a la empresa.`);
    }

    // 5. Resolver la OC (por OrderReference del XML o por orden_compra_id del body)
    let ocQuery = ctx.supabaseAdmin
      .from('ordenes_compra')
      .select('id, numero, proveedor_id, estado, total, moneda')
      .eq('tenant_id', tenantId);
    ocQuery = body.orden_compra_id
      ? ocQuery.eq('id', body.orden_compra_id)
      : ocQuery.eq('numero', f.ordenCompra ?? '__sin_oc__');
    const { data: oc } = await ocQuery.maybeSingle();

    if (!oc) {
      errores.push(f.ordenCompra
        ? `No se encontró la orden ${f.ordenCompra}. Verifique el número o selecciónela manualmente.`
        : 'La factura no indica número de orden (OrderReference) y no se seleccionó una orden.');
    } else {
      if (oc.proveedor_id !== proveedorId) errores.push('La orden indicada no pertenece a su empresa.');
      if (['anulada', 'borrador'].includes(oc.estado)) errores.push(`La orden ${oc.numero} no admite facturación (estado: ${oc.estado}).`);
    }

    // 6. Factura duplicada (misma serie+número del mismo emisor)
    if (f.serie && f.numero) {
      const { data: dup } = await ctx.supabaseAdmin
        .from('comprobantes_pago')
        .select('id').eq('tenant_id', tenantId).eq('ruc_emisor', f.rucEmisor ?? '')
        .eq('serie', f.serie).eq('numero', f.numero).neq('estado_flujo', 'anulada').maybeSingle();
      if (dup) errores.push(`La factura ${f.numeroCompleto} ya fue registrada.`);
    }

    // 7. Saldo por facturar de la OC (facturación parcial)
    if (oc) {
      const { data: saldo } = await ctx.supabaseAdmin
        .from('v_oc_saldo_facturacion')
        .select('saldo_por_facturar').eq('orden_compra_id', oc.id).maybeSingle();
      const disponible = Number(saldo?.saldo_por_facturar ?? oc.total);
      if (f.total > disponible + 0.01) {
        errores.push(`La factura (${f.total.toFixed(2)}) supera el saldo por facturar de la orden ${oc.numero} (disponible ${disponible.toFixed(2)}).`);
      }
    }

    if (errores.length > 0) {
      return Response.json({ ok: false, parsed: f, errores }, { status: 422 });
    }

    // 8. Guardar archivos en Storage (bucket privado)
    const base = `${tenantId}/${proveedorId}/${oc!.id}/${f.serie}-${f.numero}`;
    const enc = new TextEncoder();
    const upXml = await ctx.supabaseAdmin.storage.from(BUCKET)
      .upload(`${base}.xml`, enc.encode(body.xml), { contentType: 'application/xml', upsert: true });
    let pdfPath: string | null = null;
    if (body.pdf_base64) {
      const bytes = Uint8Array.from(atob(body.pdf_base64), c => c.charCodeAt(0));
      const upPdf = await ctx.supabaseAdmin.storage.from(BUCKET)
        .upload(`${base}.pdf`, bytes, { contentType: 'application/pdf', upsert: true });
      if (!upPdf.error) pdfPath = `${base}.pdf`;
    }

    // 9. Registrar el comprobante (estado 'recibida' → pendiente de conformidad)
    const { data: inserted, error: insErr } = await ctx.supabaseAdmin
      .from('comprobantes_pago')
      .insert({
        tenant_id: tenantId,
        tipo: f.tipoComprobante,
        direccion: 'recibido',
        serie: f.serie,
        numero: f.numero,
        numero_completo: f.numeroCompleto,
        fecha_emision: f.fechaEmision,
        ruc_emisor: f.rucEmisor,
        razon_social_emisor: f.razonSocialEmisor,
        ruc_receptor: f.rucReceptor,
        razon_social_receptor: f.razonSocialReceptor,
        subtotal: f.subtotal,
        igv: f.igv,
        total: f.total,
        moneda: f.moneda,
        estado: 'activo',
        estado_flujo: 'recibida',
        proveedor_id: proveedorId,
        orden_compra_id: oc!.id,
        orden_compra_numero: oc!.numero,
        subido_por_proveedor: true,
        subido_por: userRes!.user!.id,
        xml_path: upXml.error ? null : `${base}.xml`,
        pdf_path: pdfPath,
      })
      .select('id, numero_completo, estado_flujo')
      .single();

    if (insErr) return Response.json({ error: `No se pudo registrar: ${insErr.message}` }, { status: 500 });

    return Response.json({
      ok: true,
      comprobante: inserted,
      orden: { numero: oc!.numero, id: oc!.id },
      mensaje: `Factura ${f.numeroCompleto} recibida y amarrada a la orden ${oc!.numero}. Queda pendiente de conformidad.`,
    });
  }),
};

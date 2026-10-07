-- ─────────────────────────────────────────────────────────────────────────────
-- LOTES DE PAGO · Sprint 1 (2026-10-07)
--
-- Reemplaza el circuito de tres Excel por correo (PAGOS → revisado → validado)
-- por un solo objeto dentro del ERP: el LOTE DE PAGO.
--
--   borrador ──(Compras: enviar a revisión)──▶ en_revision
--   en_revision ──(Contabilidad: validar)────▶ validado      (o devolver → borrador)
--   validado ──(Compras: enviar a tesorería)─▶ por_pagar
--   por_pagar ──(Tesorería: todas las líneas pagadas/excluidas)──▶ pagado
--   pagado ──(conciliación bancaria, sprint 3)──▶ conciliado
--   cualquiera salvo pagado/conciliado ──▶ anulado
--
-- Cada línea trae del ERP al proveedor, su cuenta (por moneda), proyecto, CDC,
-- OC y factura, y el ERP calcula solo:
--   · DETRACCIÓN: si la factura (XML) o el proveedor están sujetos, con la tasa
--     del código SUNAT, solo si el total supera el tope (S/ 700), sobre el TOTAL
--     del comprobante (no sobre el pago parcial), en soles enteros, y si la
--     factura es en dólares convertida al TC SUNAT de la fecha de emisión.
--     Esto es lo que el Excel no sabía hacer ("FALTA SACAR DETRACCIÓN EN DÓLARES").
--   · RETENCIÓN IGV 3 %: si Memphis es agente y el proveedor está marcado como
--     sujeto; excluyente con la detracción; sobre el importe pagado.
--   · RETENCIÓN 4ta 8 %: recibos por honorarios, salvo suspensión vigente.
--   · NETO a transferir = monto − detracción − retención (moneda de la factura).
--
-- Decisión de Kevin (2026-10-07): SOLO Contabilidad corrige tasas o condiciones
-- dentro del lote (`finanzas.lotes_validar`), siempre con motivo y en bitácora.
-- Supuestos mientras no se decida lo contrario: se permiten líneas sin
-- comprobante (adelantos, letras) marcadas y con alerta; saldos iniciales de
-- las cuentas en 0 hasta que Contabilidad los fije.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Permisos finos del circuito ------------------------------------------------
insert into permisos (modulo, accion, descripcion)
select v.modulo, v.accion, v.descripcion from (values
  ('finanzas', 'lotes_armar',   'Armar lotes de pago y enviarlos a revisión y a tesorería (Compras)'),
  ('finanzas', 'lotes_validar', 'Validar lotes de pago y corregir detracciones y retenciones (Contabilidad)'),
  ('finanzas', 'lotes_pagar',   'Marcar pagadas las líneas de un lote y adjuntar vouchers (Tesorería)')
) as v(modulo, accion, descripcion)
where not exists (select 1 from permisos p where p.modulo = v.modulo and p.accion = v.accion);

insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id
  from roles r
  join permisos p on p.modulo = 'finanzas'
 where (r.nombre = 'Administrador'                and p.accion in ('lotes_armar', 'lotes_validar', 'lotes_pagar'))
    or (r.nombre in ('Compras', 'Proyectos')      and p.accion = 'lotes_armar')
    or (r.nombre = 'Contabilidad'                 and p.accion = 'lotes_validar')
    or (r.nombre = 'Administración'               and p.accion = 'lotes_pagar')
on conflict do nothing;

-- 2. Parámetros tributarios (editables por Finanzas, no hardcodeados) ----------
insert into parametros_financieros (clave, valor, descripcion) values
  ('detraccion_tope',               700,  'Importe total del comprobante (S/) a partir del cual aplica la detracción (operaciones mayores a S/ 700)'),
  ('retencion_igv_tasa',            0.03, 'Tasa de retención del IGV cuando Memphis actúa como agente de retención'),
  ('retencion_igv_tope',            700,  'Importe total del comprobante (S/) a partir del cual aplica la retención del IGV'),
  ('retencion_rh_tasa',             0.08, 'Tasa de retención de 4ta categoría sobre recibos por honorarios'),
  ('retencion_rh_tope',             1500, 'Importe (S/) a partir del cual se retiene en recibos por honorarios'),
  ('agente_retencion',              1,    'Memphis es agente de retención del IGV (1 = sí, 0 = no)'),
  ('lotes_permitir_sin_comprobante', 1,   'Permitir líneas de pago sin comprobante en los lotes (adelantos, letras). 1 = sí')
on conflict (clave) do nothing;

-- 3. Códigos de detracción (Anexo 3, Res. 183-2004/SUNAT y modificatorias).
--    Contabilidad confirma y ajusta desde la tabla; el lote lee de aquí.
create table if not exists public.detraccion_codigos (
  codigo      text primary key,
  descripcion text not null,
  tasa        numeric(6,4) not null,
  vigente     boolean not null default true
);
insert into detraccion_codigos (codigo, descripcion, tasa) values
  ('001', 'Azúcar y melaza de caña', 0.10),
  ('003', 'Alcohol etílico', 0.10),
  ('004', 'Recursos hidrobiológicos', 0.04),
  ('005', 'Maíz amarillo duro', 0.04),
  ('008', 'Madera', 0.04),
  ('009', 'Arena y piedra', 0.10),
  ('010', 'Residuos, subproductos, desechos, recortes y desperdicios', 0.15),
  ('012', 'Intermediación laboral y tercerización', 0.12),
  ('014', 'Carnes y despojos comestibles', 0.04),
  ('016', 'Aceite de pescado', 0.10),
  ('017', 'Harina, polvo y pellets de pescado', 0.04),
  ('019', 'Arrendamiento de bienes muebles', 0.10),
  ('020', 'Mantenimiento y reparación de bienes muebles', 0.12),
  ('021', 'Movimiento de carga', 0.10),
  ('022', 'Otros servicios empresariales', 0.12),
  ('024', 'Comisión mercantil', 0.10),
  ('025', 'Fabricación de bienes por encargo', 0.10),
  ('026', 'Servicio de transporte de personas', 0.10),
  ('027', 'Servicio de transporte de carga', 0.04),
  ('030', 'Contratos de construcción', 0.04),
  ('031', 'Oro gravado con el IGV', 0.10),
  ('034', 'Minerales metálicos no auríferos', 0.10),
  ('035', 'Bienes exonerados del IGV', 0.015),
  ('036', 'Oro y demás minerales metálicos exonerados del IGV', 0.015),
  ('037', 'Demás servicios gravados con el IGV', 0.12),
  ('039', 'Minerales no metálicos', 0.10),
  ('040', 'Bien inmueble gravado con IGV', 0.04),
  ('041', 'Plomo', 0.15)
on conflict (codigo) do update set descripcion = excluded.descripcion, tasa = excluded.tasa;
alter table detraccion_codigos enable row level security;
drop policy if exists detraccion_codigos_leer on detraccion_codigos;
create policy detraccion_codigos_leer on detraccion_codigos for select using (true);
drop policy if exists detraccion_codigos_editar on detraccion_codigos;
create policy detraccion_codigos_editar on detraccion_codigos for all
  using (auth_tiene_permiso('contabilidad', 'editar') or auth_tiene_permiso('finanzas', 'lotes_validar'))
  with check (auth_tiene_permiso('contabilidad', 'editar') or auth_tiene_permiso('finanzas', 'lotes_validar'));

-- 4. Cuentas bancarias de Memphis --------------------------------------------
--    Hasta hoy `transacciones.cuenta_id` apuntaba a cuentas_contables y nadie
--    la usaba. Las cuentas reales son dos BBVA (806 soles, 830 dólares) más la
--    cuenta de detracciones del Banco de la Nación.
create table if not exists public.cuentas_bancarias (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id),
  nombre              text not null,
  banco               text not null,
  numero              text,
  cci                 text,
  moneda              text not null check (moneda in ('PEN', 'USD')),
  tipo                text not null default 'corriente' check (tipo in ('corriente', 'ahorro', 'detracciones')),
  saldo_inicial       numeric(14,2) not null default 0,
  saldo_inicial_fecha date not null default date '2026-01-01',
  activa              boolean not null default true,
  orden               int not null default 0,
  creado_en           timestamptz not null default now(),
  unique (tenant_id, nombre)
);
alter table cuentas_bancarias enable row level security;
drop policy if exists cuentas_bancarias_sel on cuentas_bancarias;
create policy cuentas_bancarias_sel on cuentas_bancarias for select
  using (tenant_id = auth_tenant_id() and (
    auth_tiene_permiso('finanzas', 'ver') or auth_tiene_permiso('finanzas', 'lotes_armar')
    or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('finanzas', 'lotes_pagar')));
drop policy if exists cuentas_bancarias_wr on cuentas_bancarias;
create policy cuentas_bancarias_wr on cuentas_bancarias for all
  using (tenant_id = auth_tenant_id() and auth_tiene_permiso('finanzas', 'editar'))
  with check (tenant_id = auth_tenant_id() and auth_tiene_permiso('finanzas', 'editar'));

insert into cuentas_bancarias (tenant_id, nombre, banco, numero, moneda, tipo, orden)
select t.id, v.nombre, v.banco, v.numero, v.moneda, v.tipo, v.orden
  from tenants t
  cross join (values
    ('BBVA Soles 806',                  'BBVA',               '00110178160100101806', 'PEN', 'corriente',    1),
    ('BBVA Dólares 830',                'BBVA',               '00110178160100101830', 'USD', 'corriente',    2),
    ('Banco de la Nación · Detracciones','Banco de la Nación', null,                   'PEN', 'detracciones', 3)
  ) as v(nombre, banco, numero, moneda, tipo, orden)
 where t.id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
on conflict (tenant_id, nombre) do nothing;

alter table transacciones add column if not exists cuenta_bancaria_id uuid references cuentas_bancarias(id);
create index if not exists transacciones_cuenta_bancaria_idx on transacciones (cuenta_bancaria_id, fecha);

-- Saldo por cuenta = saldo inicial + movimientos pagados desde esa fecha, en la
-- moneda de la cuenta (una detracción de una factura en dólares se deposita en
-- soles: se usa monto_soles cuando la cuenta es en soles).
create or replace view public.v_cuentas_bancarias_saldo as
select c.*,
       c.saldo_inicial + coalesce(sum(
         case when t.tipo = 'ingreso' then 1 when t.tipo = 'egreso' then -1 else 0 end *
         case when coalesce(t.moneda, 'PEN') = c.moneda then t.monto
              when c.moneda = 'PEN' then coalesce(t.monto_soles, t.monto * coalesce(t.tipo_cambio, 1))
              else t.monto / coalesce(nullif(t.tipo_cambio, 0), 1) end), 0) as saldo_actual,
       count(t.id) as movimientos,
       max(coalesce(t.fecha_pago, t.fecha)) as ultimo_movimiento
  from cuentas_bancarias c
  left join transacciones t
    on t.cuenta_bancaria_id = c.id and t.estado = 'pagada'
   and coalesce(t.fecha_pago, t.fecha) >= c.saldo_inicial_fecha
 group by c.id;

-- 5. Detracciones y retenciones: hoy exigían factura; una línea sin comprobante
--    (adelanto con detracción) también las necesita. Se enlazan al lote.
alter table detracciones alter column comprobante_id drop not null;
alter table detracciones alter column descripcion_bien_servicio drop not null;
alter table detracciones
  add column if not exists proveedor_id       uuid references proveedores(id),
  add column if not exists lote_item_id       uuid,
  add column if not exists moneda_origen      text,
  add column if not exists tipo_cambio        numeric(8,4),
  add column if not exists cuenta_bancaria_id uuid references cuentas_bancarias(id),
  add column if not exists transaccion_id     uuid references transacciones(id) on delete set null,
  add column if not exists periodo            text;
alter table retenciones_percepciones alter column comprobante_id drop not null;
alter table retenciones_percepciones
  add column if not exists proveedor_id   uuid references proveedores(id),
  add column if not exists lote_item_id   uuid,
  add column if not exists regimen        text check (regimen in ('igv', 'cuarta')),
  add column if not exists moneda         text,
  add column if not exists transaccion_id uuid references transacciones(id) on delete set null,
  add column if not exists periodo        text;

-- 6. El lote y sus líneas --------------------------------------------------------
create table if not exists public.lotes_pago (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id),
  numero                text not null,
  estado                text not null default 'borrador'
                        check (estado in ('borrador', 'en_revision', 'validado', 'por_pagar', 'pagado', 'conciliado', 'anulado')),
  fecha_prevista_pago   date,
  notas                 text,
  creado_por            uuid,
  creado_en             timestamptz not null default now(),
  enviado_revision_por  uuid, enviado_revision_en  timestamptz,
  validado_por          uuid, validado_en          timestamptz,
  enviado_tesoreria_por uuid, enviado_tesoreria_en timestamptz,
  pagado_en             timestamptz,
  conciliado_en         timestamptz,
  anulado_por           uuid, anulado_en           timestamptz,
  motivo_anulacion      text,
  unique (tenant_id, numero)
);

create table if not exists public.lotes_pago_items (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id),
  lote_id             uuid not null references lotes_pago(id) on delete cascade,
  orden               int not null default 0,
  -- de dónde sale la línea
  tipo_linea          text not null default 'factura'
                      check (tipo_linea in ('factura', 'orden', 'compromiso', 'adelanto', 'letra', 'sin_comprobante')),
  compromiso_id       uuid references flujo_compromisos(id) on delete set null,
  comprobante_id      uuid references comprobantes_pago(id) on delete set null,
  orden_compra_id     uuid references ordenes_compra(id) on delete set null,
  proveedor_id        uuid references proveedores(id),
  proveedor           text,
  ruc                 text,
  proyecto_id         uuid references proyectos(id),
  centro_costo_id     uuid references centros_costo(id),
  cdc                 text,
  concepto            text,
  referencia_doc      text,
  -- importe a pagar (bruto) en la moneda de la factura
  moneda              text not null default 'PEN' check (moneda in ('PEN', 'USD')),
  monto               numeric(14,2) not null check (monto > 0),
  tc                  numeric(8,4) not null default 1,
  fecha_tc            date,
  -- cuenta destino
  banco               text,
  cuenta              text,
  cci                 text,
  moneda_cuenta       text,
  cuenta_detraccion   text,
  -- detracción
  detraccion_aplica   boolean not null default false,
  detraccion_codigo   text,
  detraccion_tasa     numeric(6,4),
  detraccion_base     numeric(14,2),
  detraccion_soles    numeric(14,2) not null default 0,
  detraccion_monto    numeric(14,2) not null default 0,
  -- retención
  retencion_tipo      text not null default 'ninguna' check (retencion_tipo in ('ninguna', 'igv', 'cuarta')),
  retencion_tasa      numeric(6,4),
  retencion_monto     numeric(14,2) not null default 0,
  -- neto
  neto                numeric(14,2) not null default 0,
  neto_soles          numeric(14,2) not null default 0,
  alertas             text[] not null default '{}',
  -- corrección de Contabilidad
  ajustado            boolean not null default false,
  ajustado_por        uuid,
  ajustado_en         timestamptz,
  ajuste_motivo       text,
  -- pago
  estado              text not null default 'pendiente' check (estado in ('pendiente', 'pagada', 'excluida')),
  fecha_pago          date,
  cuenta_bancaria_id  uuid references cuentas_bancarias(id),
  numero_operacion    text,
  voucher_path        text,
  transaccion_id      uuid references transacciones(id) on delete set null,
  detraccion_id       uuid references detracciones(id) on delete set null,
  retencion_id        uuid references retenciones_percepciones(id) on delete set null,
  motivo_exclusion    text,
  notas               text,
  creado_en           timestamptz not null default now()
);
create index if not exists lotes_pago_items_lote_idx on lotes_pago_items (lote_id, orden);
create index if not exists lotes_pago_items_compromiso_idx on lotes_pago_items (compromiso_id);

create table if not exists public.lotes_pago_bitacora (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  lote_id   uuid not null references lotes_pago(id) on delete cascade,
  item_id   uuid references lotes_pago_items(id) on delete cascade,
  user_id   uuid,
  accion    text not null,
  detalle   jsonb,
  creado_en timestamptz not null default now()
);
create index if not exists lotes_pago_bitacora_lote_idx on lotes_pago_bitacora (lote_id, creado_en);

-- RLS: ve el lote quien ve Finanzas o tiene cualquiera de los tres permisos del
-- circuito. Las escrituras pasan por funciones SECURITY DEFINER que comprueban
-- el permiso y el estado; las políticas de escritura son el cinturón.
create or replace function public.lote_puede_ver() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_tiene_permiso('finanzas', 'ver') or auth_tiene_permiso('finanzas', 'lotes_armar')
      or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('finanzas', 'lotes_pagar');
$$;

alter table lotes_pago enable row level security;
alter table lotes_pago_items enable row level security;
alter table lotes_pago_bitacora enable row level security;
drop policy if exists lotes_pago_sel on lotes_pago;
create policy lotes_pago_sel on lotes_pago for select using (tenant_id = auth_tenant_id() and lote_puede_ver());
drop policy if exists lotes_pago_wr on lotes_pago;
create policy lotes_pago_wr on lotes_pago for all
  using (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'lotes_armar') or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('finanzas', 'lotes_pagar')))
  with check (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'lotes_armar') or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('finanzas', 'lotes_pagar')));
drop policy if exists lotes_pago_items_sel on lotes_pago_items;
create policy lotes_pago_items_sel on lotes_pago_items for select using (tenant_id = auth_tenant_id() and lote_puede_ver());
drop policy if exists lotes_pago_items_wr on lotes_pago_items;
create policy lotes_pago_items_wr on lotes_pago_items for all
  using (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'lotes_armar') or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('finanzas', 'lotes_pagar')))
  with check (tenant_id = auth_tenant_id() and (auth_tiene_permiso('finanzas', 'lotes_armar') or auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('finanzas', 'lotes_pagar')));
drop policy if exists lotes_pago_bitacora_sel on lotes_pago_bitacora;
create policy lotes_pago_bitacora_sel on lotes_pago_bitacora for select using (tenant_id = auth_tenant_id() and lote_puede_ver());

-- 7. Helpers ------------------------------------------------------------------------
create or replace function public.lote_param(p_clave text, p_defecto numeric) returns numeric
language sql stable set search_path = public as $$
  select coalesce((select valor from parametros_financieros where clave = p_clave), p_defecto);
$$;

create or replace function public.lote_bitacora(p_lote uuid, p_item uuid, p_accion text, p_detalle jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from lotes_pago where id = p_lote;
  insert into lotes_pago_bitacora (tenant_id, lote_id, item_id, user_id, accion, detalle)
  values (v_tenant, p_lote, p_item, auth.uid(), p_accion, p_detalle);
end $$;

create or replace function public.lote_notificar(p_lote uuid, p_tipo text, p_titulo text, p_mensaje text) returns void
language plpgsql security definer set search_path = public as $$
declare l record;
begin
  select tenant_id, numero into l from lotes_pago where id = p_lote;
  insert into notificaciones (tenant_id, tipo, titulo, mensaje, leida, entidad_tipo, entidad_id)
  values (l.tenant_id, p_tipo, p_titulo, p_mensaje, false, 'lote_pago', l.numero);
end $$;

-- Cuenta del proveedor para una moneda: primero el arreglo `cuentas_bancarias`
-- (una entrada por cuenta, tal como la exporta el Excel de pagos), luego las
-- columnas sueltas. La cuenta de detracciones se devuelve aparte.
create or replace function public.lote_cuenta_proveedor(p_proveedor uuid, p_moneda text) returns jsonb
language plpgsql stable set search_path = public as $$
declare p record; e record; c jsonb; v_cta jsonb; v_det text; v_mon text;
begin
  select * into p from proveedores where id = p_proveedor;
  if not found then return '{}'::jsonb; end if;
  v_mon := case when upper(p_moneda) in ('USD', 'DOLARES', 'DÓLARES') then 'USD' else 'PEN' end;
  for e in select value from jsonb_array_elements(coalesce(p.cuentas_bancarias, '[]'::jsonb)) loop
    c := e.value;
    if coalesce(c->>'cuenta', '') in ('', '-') then continue; end if;
    if (c->>'nombre') ~* 'detrac' then
      v_det := coalesce(v_det, c->>'cuenta');
      continue;
    end if;
    if v_cta is null and (
         (v_mon = 'USD' and (c->>'moneda') ~* 'd[oó]lar|usd')
      or (v_mon = 'PEN' and ((c->>'moneda') ~* 'sol|pen' or coalesce(c->>'moneda', '') = ''))) then
      v_cta := c;
    end if;
  end loop;
  if v_cta is null and coalesce(p.cuenta_bancaria, '') not in ('', '-') then
    v_cta := jsonb_build_object('nombre', p.banco, 'cuenta', p.cuenta_bancaria, 'cci', p.cci,
                                'moneda', case when upper(coalesce(p.moneda_cuenta, 'PEN')) in ('USD', 'DOLARES', 'DÓLARES') then 'USD' else 'PEN' end);
  end if;
  return jsonb_build_object(
    'banco',             v_cta->>'nombre',
    'cuenta',            v_cta->>'cuenta',
    'cci',               nullif(v_cta->>'cci', '-'),
    'moneda_cuenta',     case when v_cta is null then null
                              when (v_cta->>'moneda') ~* 'd[oó]lar|usd' then 'USD' else 'PEN' end,
    'cuenta_detraccion', v_det);
end $$;

-- Siguiente número de transacción (mismo formato que registrar_pago_compromiso).
create or replace function public.trx_siguiente_numero(p_tenant uuid, p_fecha date) returns text
language plpgsql set search_path = public as $$
declare v_anio text; v_num text;
begin
  v_anio := to_char(p_fecha, 'YYYY');
  select 'TRX-' || v_anio || '-' || lpad((coalesce(max(substring(numero from '^TRX-\d{4}-(\d+)$')::int), 0) + 1)::text, 4, '0')
    into v_num
    from transacciones where tenant_id = p_tenant and numero like 'TRX-' || v_anio || '-%';
  return v_num;
end $$;

-- 8. El cálculo de la línea ---------------------------------------------------------
-- Se llama al agregar, al cambiar el monto y al enviar a revisión. Si Contabilidad
-- ya ajustó la línea (`ajustado`), respeta su decisión sobre aplica/tasa/código y
-- solo vuelve a calcular importes, cuenta y alertas.
create or replace function public.lote_pago_recalcular(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  it record; prov record; comp record; cta jsonb;
  v_tc numeric; v_fecha_tc date; v_base numeric; v_base_soles numeric; v_monto_soles numeric;
  v_det_aplica boolean; v_det_codigo text; v_det_tasa numeric; v_det_soles numeric := 0; v_det_monto numeric := 0;
  v_ret_tipo text := 'ninguna'; v_ret_tasa numeric; v_ret_monto numeric := 0;
  v_es_rh boolean := false; v_alertas text[] := '{}';
  v_pendiente numeric; v_tope_det numeric; v_tope_igv numeric; v_tope_rh numeric;
begin
  select * into it from lotes_pago_items where id = p_item;
  if not found then return; end if;
  -- Sin filas, los records quedan con todos los campos en null (y asignados).
  select * into prov from proveedores where id = it.proveedor_id;
  select * into comp from comprobantes_pago where id = it.comprobante_id;

  -- Tipo de cambio: el de SUNAT de la fecha de emisión del comprobante (es el
  -- que manda para la detracción); sin comprobante, el del día.
  v_fecha_tc := coalesce(comp.fecha_emision, current_date);
  -- Un comprobante en dólares con tipo_cambio 1 (o nulo) no trae TC real: se usa el de SUNAT.
  v_tc := case when it.moneda = 'USD' then (case when coalesce(comp.tipo_cambio, 0) > 1 then comp.tipo_cambio else tc_vigente(v_fecha_tc) end) else 1 end;
  v_monto_soles := round(it.monto * v_tc, 2);

  -- Base de la detracción: el TOTAL del comprobante, no el pago parcial.
  v_base := coalesce(comp.total, it.monto);
  v_base_soles := round(v_base * v_tc, 2);
  v_tope_det := lote_param('detraccion_tope', 700);
  v_tope_igv := lote_param('retencion_igv_tope', 700);
  v_tope_rh  := lote_param('retencion_rh_tope', 1500);

  -- ¿Recibo por honorarios?
  v_es_rh := (comp.tipo in ('02', 'R1', 'R7'))
          or (comp.id is null and coalesce(prov.tipo, '') = 'persona_natural' and coalesce(it.referencia_doc, '') ~* '^(RH|R\s?H|RHE)')
          or (comp.id is null and coalesce(it.referencia_doc, '') ~* '^RH');

  -- Cuenta destino
  if it.proveedor_id is not null then
    cta := lote_cuenta_proveedor(it.proveedor_id, it.moneda);
  else
    cta := '{}'::jsonb;
  end if;

  -- ── Detracción ──────────────────────────────────────────────────────────────
  if it.ajustado then
    v_det_aplica := it.detraccion_aplica; v_det_codigo := it.detraccion_codigo; v_det_tasa := it.detraccion_tasa;
  else
    v_det_aplica := false;
    if comp.id is not null and coalesce(comp.tiene_detraccion, false) then
      v_det_aplica := true; v_det_codigo := comp.detraccion_codigo; v_det_tasa := comp.detraccion_tasa;
    elsif coalesce(prov.sujeto_detraccion, false) then
      v_det_aplica := true; v_det_codigo := prov.codigo_bien_servicio; v_det_tasa := prov.tasa_detraccion;
    end if;
    if v_det_aplica and v_det_tasa is null and v_det_codigo is not null then
      select tasa into v_det_tasa from detraccion_codigos where codigo = v_det_codigo;
    end if;
    if v_det_aplica and v_det_tasa is null then
      v_det_tasa := 0.12; v_det_codigo := coalesce(v_det_codigo, '037');
      v_alertas := array_append(v_alertas, 'Detracción sin tasa en el proveedor ni en la factura: se asumió 12 % (037). Contabilidad confirma.');
    end if;
    -- No aplica si el total no supera el tope
    if v_det_aplica and v_base_soles <= v_tope_det then
      v_det_aplica := false;
      v_alertas := array_append(v_alertas, format('Sin detracción: el total (S/ %s) no supera el tope de S/ %s.', to_char(v_base_soles, 'FM999G999G990D00'), to_char(v_tope_det, 'FM999G990')));
    end if;
    -- Ya depositada en un pago anterior de la misma factura
    if v_det_aplica and comp.id is not null and exists (select 1 from detracciones d where d.comprobante_id = comp.id and d.estado in ('pendiente', 'depositado')) then
      v_det_aplica := false;
      v_alertas := array_append(v_alertas, 'La detracción de esta factura ya se registró en un pago anterior.');
    end if;
  end if;
  if v_det_tasa is not null and v_det_tasa > 1 then v_det_tasa := v_det_tasa / 100; end if;
  if v_det_aplica then
    v_det_soles := round(v_base_soles * v_det_tasa, 0);            -- SUNAT: soles enteros
    v_det_monto := case when it.moneda = 'USD' then round(v_det_soles / v_tc, 2) else v_det_soles end;
    if it.moneda = 'USD' then
      v_alertas := array_append(v_alertas, format('Detracción en dólares: S/ %s al TC %s del %s, equivale a US$ %s.', to_char(v_det_soles, 'FM999G999G990'), v_tc, to_char(v_fecha_tc, 'DD/MM/YYYY'), to_char(v_det_monto, 'FM999G999G990D00')));
    end if;
    if v_det_monto >= it.monto then
      v_alertas := array_append(v_alertas, 'La detracción (sobre el total de la factura) es mayor o igual al importe de esta línea: revise el monto.');
    end if;
  end if;

  -- ── Retención ───────────────────────────────────────────────────────────────
  if it.ajustado then
    v_ret_tipo := it.retencion_tipo; v_ret_tasa := it.retencion_tasa;
  else
    if v_es_rh then
      if coalesce(prov.suspension_retencion_rh, false) and coalesce(prov.suspension_retencion_hasta, date '2000-01-01') >= current_date then
        v_alertas := array_append(v_alertas, format('Recibo por honorarios con suspensión de retención vigente hasta %s.', to_char(prov.suspension_retencion_hasta, 'DD/MM/YYYY')));
      elsif v_monto_soles > v_tope_rh then
        v_ret_tipo := 'cuarta'; v_ret_tasa := lote_param('retencion_rh_tasa', 0.08);
      else
        v_alertas := array_append(v_alertas, format('Recibo por honorarios por S/ %s: no supera el tope de S/ %s, sin retención.', to_char(v_monto_soles, 'FM999G999G990D00'), to_char(v_tope_rh, 'FM999G990')));
      end if;
    elsif lote_param('agente_retencion', 1) = 1 and coalesce(prov.sujeto_retencion, false) and not v_det_aplica then
      if v_base_soles > v_tope_igv then
        v_ret_tipo := 'igv'; v_ret_tasa := lote_param('retencion_igv_tasa', 0.03);
      else
        v_alertas := array_append(v_alertas, 'Proveedor sujeto a retención, pero el total no supera el tope: sin retención.');
      end if;
    end if;
  end if;
  if v_ret_tasa is not null and v_ret_tasa > 1 then v_ret_tasa := v_ret_tasa / 100; end if;
  if v_ret_tipo <> 'ninguna' then
    v_ret_monto := round(it.monto * coalesce(v_ret_tasa, 0), 2);   -- sobre lo que se paga
  end if;

  -- ── Alertas de datos ─────────────────────────────────────────────────────────
  if it.proveedor_id is null then
    v_alertas := array_append(v_alertas, 'Línea sin proveedor del directorio: no se puede resolver la cuenta.');
  elsif coalesce(cta->>'cuenta', '') = '' then
    v_alertas := array_append(v_alertas, 'El proveedor no tiene cuenta bancaria registrada para esta moneda.');
  else
    if (cta->>'moneda_cuenta') is distinct from it.moneda then
      v_alertas := array_append(v_alertas, format('La factura es en %s y la cuenta del proveedor en %s.', it.moneda, coalesce(cta->>'moneda_cuenta', '?')));
    end if;
    if coalesce(cta->>'cci', '') = '' and coalesce(cta->>'banco', '') !~* 'bbva' then
      v_alertas := array_append(v_alertas, 'Cuenta de otro banco sin CCI: la transferencia interbancaria lo necesita.');
    end if;
  end if;
  if v_det_aplica and coalesce(cta->>'cuenta_detraccion', '') = '' then
    v_alertas := array_append(v_alertas, 'Aplica detracción y el proveedor no tiene registrada su cuenta de detracciones del Banco de la Nación.');
  end if;
  if comp.id is null and it.tipo_linea in ('adelanto', 'letra', 'sin_comprobante', 'orden', 'compromiso') then
    v_alertas := array_append(v_alertas, 'Sin comprobante: pago a cuenta. Contabilidad lo cerrará contra la factura cuando llegue.');
  end if;
  if it.compromiso_id is not null then
    select greatest(coalesce(monto_presupuestado, monto_ejecutado, 0) - coalesce(monto_pagado, 0), 0) into v_pendiente from flujo_compromisos where id = it.compromiso_id;
    if v_pendiente is not null and it.monto > v_pendiente + 0.01 then
      v_alertas := array_append(v_alertas, format('El importe supera el saldo pendiente del compromiso (%s %s).', it.moneda, to_char(v_pendiente, 'FM999G999G990D00')));
    end if;
  end if;
  if prov.id is not null and not coalesce(prov.sujeto_detraccion, false) and not coalesce(prov.sujeto_retencion, false) and comp.id is null and not v_es_rh then
    v_alertas := array_append(v_alertas, 'El proveedor no tiene condición tributaria definida (detracción / retención): se asume que no aplica.');
  end if;

  update lotes_pago_items set
    tc = v_tc, fecha_tc = v_fecha_tc,
    proveedor = coalesce(proveedor, prov.razon_social), ruc = coalesce(ruc, prov.ruc),
    banco = cta->>'banco', cuenta = cta->>'cuenta', cci = cta->>'cci', moneda_cuenta = cta->>'moneda_cuenta',
    cuenta_detraccion = cta->>'cuenta_detraccion',
    detraccion_aplica = v_det_aplica, detraccion_codigo = case when v_det_aplica then v_det_codigo else detraccion_codigo end,
    detraccion_tasa = case when v_det_aplica then v_det_tasa else detraccion_tasa end,
    detraccion_base = case when v_det_aplica then v_base else null end,
    detraccion_soles = v_det_soles, detraccion_monto = v_det_monto,
    retencion_tipo = v_ret_tipo, retencion_tasa = case when v_ret_tipo <> 'ninguna' then v_ret_tasa else null end,
    retencion_monto = v_ret_monto,
    neto = round(monto - v_det_monto - v_ret_monto, 2),
    neto_soles = round((monto - v_det_monto - v_ret_monto) * v_tc, 2),
    alertas = v_alertas
  where id = p_item;
end $$;

-- 9. Operaciones del lote --------------------------------------------------------
create or replace function public.lote_pago_crear(p_fecha date default null, p_notas text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_num text; v_id uuid; v_anio text;
begin
  if not auth_tiene_permiso('finanzas', 'lotes_armar') then raise exception 'Sin permiso para armar lotes de pago (finanzas.lotes_armar)'; end if;
  v_tenant := auth_tenant_id();
  v_anio := to_char(coalesce(p_fecha, current_date), 'YYYY');
  select 'LP-' || v_anio || '-' || lpad((coalesce(max(substring(numero from '^LP-\d{4}-(\d+)$')::int), 0) + 1)::text, 3, '0')
    into v_num from lotes_pago where tenant_id = v_tenant and numero like 'LP-' || v_anio || '-%';
  insert into lotes_pago (tenant_id, numero, fecha_prevista_pago, notas, creado_por)
  values (v_tenant, v_num, p_fecha, p_notas, auth.uid()) returning id into v_id;
  perform lote_bitacora(v_id, null, 'crear', jsonb_build_object('numero', v_num));
  return v_id;
end $$;

-- Agrega compromisos pendientes (los de Cuentas por pagar) como líneas; el monto
-- es el saldo pendiente. Devuelve cuántas líneas se agregaron.
create or replace function public.lote_pago_agregar(p_lote uuid, p_compromisos uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare l record; c record; v_n int := 0; v_orden int; v_id uuid; v_pend numeric; v_tipo text; v_prov uuid; v_ref text;
begin
  if not auth_tiene_permiso('finanzas', 'lotes_armar') then raise exception 'Sin permiso para armar lotes de pago'; end if;
  select * into l from lotes_pago where id = p_lote;
  if not found then raise exception 'Lote no encontrado'; end if;
  if l.estado <> 'borrador' then raise exception 'Solo se agregan líneas a un lote en borrador (este está en %)', l.estado; end if;
  select coalesce(max(orden), 0) into v_orden from lotes_pago_items where lote_id = p_lote;
  for c in select f.* from flujo_compromisos f where f.id = any(p_compromisos) and f.tenant_id = l.tenant_id and f.sentido = 'pagar' loop
    if exists (select 1 from lotes_pago_items i join lotes_pago lp on lp.id = i.lote_id
                where i.compromiso_id = c.id and i.estado <> 'excluida' and lp.estado not in ('anulado', 'pagado', 'conciliado')) then
      continue;   -- ya está en otro lote vivo
    end if;
    v_pend := greatest(coalesce(c.monto_presupuestado, c.monto_ejecutado, 0) - coalesce(c.monto_pagado, 0), 0);
    if v_pend <= 0 then continue; end if;
    v_tipo := case when c.comprobante_id is not null then 'factura' when c.orden_compra_id is not null then 'orden' else 'compromiso' end;
    v_prov := c.proveedor_id;
    if v_prov is null and c.orden_compra_id is not null then select proveedor_id into v_prov from ordenes_compra where id = c.orden_compra_id; end if;
    if v_prov is null and c.proveedor is not null then
      select id into v_prov from proveedores where tenant_id = l.tenant_id and (upper(razon_social) = upper(c.proveedor) or upper(nombre_comercial) = upper(c.proveedor)) limit 1;
    end if;
    v_ref := c.referencia_doc;
    if v_ref is null and c.orden_compra_id is not null then select numero into v_ref from ordenes_compra where id = c.orden_compra_id; end if;
    v_orden := v_orden + 1;
    insert into lotes_pago_items (tenant_id, lote_id, orden, tipo_linea, compromiso_id, comprobante_id, orden_compra_id, proveedor_id, proveedor,
                                  proyecto_id, centro_costo_id, cdc, concepto, referencia_doc, moneda, monto)
    values (l.tenant_id, p_lote, v_orden, v_tipo, c.id, c.comprobante_id, c.orden_compra_id, v_prov, c.proveedor,
            c.proyecto_id, c.centro_costo_id, c.cdc, c.concepto, v_ref, coalesce(c.moneda, 'PEN'), round(v_pend, 2))
    returning id into v_id;
    perform lote_pago_recalcular(v_id);
    v_n := v_n + 1;
  end loop;
  if v_n > 0 then perform lote_bitacora(p_lote, null, 'agregar', jsonb_build_object('lineas', v_n)); end if;
  return v_n;
end $$;

-- Línea sin compromiso previo: adelanto, letra o pago sin comprobante.
create or replace function public.lote_pago_agregar_libre(
  p_lote uuid, p_proveedor uuid, p_monto numeric, p_moneda text, p_concepto text,
  p_tipo_linea text default 'adelanto', p_orden_compra uuid default null, p_proyecto uuid default null,
  p_centro_costo uuid default null, p_referencia text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare l record; v_id uuid; v_orden int; v_cc record; v_oc record;
begin
  if not auth_tiene_permiso('finanzas', 'lotes_armar') then raise exception 'Sin permiso para armar lotes de pago'; end if;
  if lote_param('lotes_permitir_sin_comprobante', 1) <> 1 then raise exception 'Las líneas sin comprobante están deshabilitadas (parámetro lotes_permitir_sin_comprobante)'; end if;
  select * into l from lotes_pago where id = p_lote;
  if not found or l.estado <> 'borrador' then raise exception 'El lote no está en borrador'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El importe debe ser mayor a cero'; end if;
  select proyecto_id, centro_costo_id, numero into v_oc from ordenes_compra where id = p_orden_compra;
  select codigo into v_cc from centros_costo where id = coalesce(p_centro_costo, v_oc.centro_costo_id);
  select coalesce(max(orden), 0) + 1 into v_orden from lotes_pago_items where lote_id = p_lote;
  insert into lotes_pago_items (tenant_id, lote_id, orden, tipo_linea, orden_compra_id, proveedor_id, proyecto_id, centro_costo_id, cdc,
                                concepto, referencia_doc, moneda, monto)
  values (l.tenant_id, p_lote, v_orden, p_tipo_linea, p_orden_compra, p_proveedor, coalesce(p_proyecto, v_oc.proyecto_id),
          coalesce(p_centro_costo, v_oc.centro_costo_id), v_cc.codigo, p_concepto, coalesce(p_referencia, v_oc.numero),
          case when upper(p_moneda) = 'USD' then 'USD' else 'PEN' end, round(p_monto, 2))
  returning id into v_id;
  perform lote_pago_recalcular(v_id);
  perform lote_bitacora(p_lote, v_id, 'agregar_libre', jsonb_build_object('tipo', p_tipo_linea, 'monto', p_monto, 'moneda', p_moneda));
  return v_id;
end $$;

create or replace function public.lote_pago_fijar_monto(p_item uuid, p_monto numeric) returns void
language plpgsql security definer set search_path = public as $$
declare it record; l record;
begin
  if not auth_tiene_permiso('finanzas', 'lotes_armar') then raise exception 'Sin permiso para armar lotes de pago'; end if;
  select * into it from lotes_pago_items where id = p_item;
  if not found then raise exception 'Línea no encontrada'; end if;
  select * into l from lotes_pago where id = it.lote_id;
  if l.estado not in ('borrador', 'en_revision') then raise exception 'El lote ya no admite cambios de importe'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El importe debe ser mayor a cero'; end if;
  update lotes_pago_items set monto = round(p_monto, 2) where id = p_item;
  perform lote_pago_recalcular(p_item);
  perform lote_bitacora(it.lote_id, p_item, 'fijar_monto', jsonb_build_object('antes', it.monto, 'despues', p_monto));
end $$;

create or replace function public.lote_pago_quitar(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it record; l record;
begin
  if not auth_tiene_permiso('finanzas', 'lotes_armar') then raise exception 'Sin permiso para armar lotes de pago'; end if;
  select * into it from lotes_pago_items where id = p_item;
  if not found then return; end if;
  select * into l from lotes_pago where id = it.lote_id;
  if l.estado <> 'borrador' then raise exception 'Solo se quitan líneas de un lote en borrador'; end if;
  delete from lotes_pago_items where id = p_item;
  perform lote_bitacora(it.lote_id, null, 'quitar', jsonb_build_object('concepto', it.concepto, 'monto', it.monto));
end $$;

-- Corrección de Contabilidad (única que puede, decisión de Kevin 2026-10-07).
create or replace function public.lote_pago_ajustar(
  p_item uuid, p_detraccion_aplica boolean, p_detraccion_codigo text, p_detraccion_tasa numeric,
  p_retencion_tipo text, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare it record; l record; v_tasa numeric;
begin
  if not auth_tiene_permiso('finanzas', 'lotes_validar') then raise exception 'Solo Contabilidad (finanzas.lotes_validar) corrige detracciones y retenciones'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 10 then raise exception 'Escriba el motivo de la corrección (mínimo 10 caracteres)'; end if;
  select * into it from lotes_pago_items where id = p_item;
  if not found then raise exception 'Línea no encontrada'; end if;
  select * into l from lotes_pago where id = it.lote_id;
  if l.estado not in ('borrador', 'en_revision') then raise exception 'El lote ya fue validado: no admite correcciones'; end if;
  if p_retencion_tipo not in ('ninguna', 'igv', 'cuarta') then raise exception 'Tipo de retención inválido'; end if;
  v_tasa := p_detraccion_tasa;
  if p_detraccion_aplica and v_tasa is null and p_detraccion_codigo is not null then
    select tasa into v_tasa from detraccion_codigos where codigo = p_detraccion_codigo;
  end if;
  update lotes_pago_items set
    ajustado = true, ajustado_por = auth.uid(), ajustado_en = now(), ajuste_motivo = p_motivo,
    detraccion_aplica = p_detraccion_aplica, detraccion_codigo = p_detraccion_codigo, detraccion_tasa = v_tasa,
    retencion_tipo = p_retencion_tipo,
    retencion_tasa = case p_retencion_tipo when 'igv' then lote_param('retencion_igv_tasa', 0.03)
                                           when 'cuarta' then lote_param('retencion_rh_tasa', 0.08) else null end
  where id = p_item;
  perform lote_pago_recalcular(p_item);
  perform lote_bitacora(it.lote_id, p_item, 'ajustar', jsonb_build_object(
    'motivo', p_motivo,
    'antes', jsonb_build_object('detraccion', it.detraccion_aplica, 'codigo', it.detraccion_codigo, 'tasa', it.detraccion_tasa, 'retencion', it.retencion_tipo),
    'despues', jsonb_build_object('detraccion', p_detraccion_aplica, 'codigo', p_detraccion_codigo, 'tasa', v_tasa, 'retencion', p_retencion_tipo)));
end $$;

-- Quitar la corrección y volver al cálculo automático.
create or replace function public.lote_pago_desajustar(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it record;
begin
  if not auth_tiene_permiso('finanzas', 'lotes_validar') then raise exception 'Solo Contabilidad puede deshacer una corrección'; end if;
  select * into it from lotes_pago_items where id = p_item;
  if not found then return; end if;
  update lotes_pago_items set ajustado = false, ajustado_por = null, ajustado_en = null, ajuste_motivo = null where id = p_item;
  perform lote_pago_recalcular(p_item);
  perform lote_bitacora(it.lote_id, p_item, 'desajustar', null);
end $$;

-- Cambios de estado con sus permisos y avisos.
create or replace function public.lote_pago_cambiar_estado(p_lote uuid, p_estado text, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare l record; v_n int; v_pen numeric; v_usd numeric; v_msg text; it record;
begin
  select * into l from lotes_pago where id = p_lote;
  if not found then raise exception 'Lote no encontrado'; end if;
  select count(*), coalesce(sum(case when moneda = 'PEN' then neto end), 0), coalesce(sum(case when moneda = 'USD' then neto end), 0)
    into v_n, v_pen, v_usd from lotes_pago_items where lote_id = p_lote and estado <> 'excluida';
  v_msg := format('%s línea(s) · neto S/ %s · US$ %s', v_n, to_char(v_pen, 'FM999G999G990D00'), to_char(v_usd, 'FM999G999G990D00'));

  if p_estado = 'en_revision' then
    if not auth_tiene_permiso('finanzas', 'lotes_armar') then raise exception 'Sin permiso para enviar a revisión'; end if;
    if l.estado <> 'borrador' then raise exception 'Solo un lote en borrador se envía a revisión'; end if;
    if v_n = 0 then raise exception 'El lote no tiene líneas'; end if;
    for it in select id from lotes_pago_items where lote_id = p_lote loop perform lote_pago_recalcular(it.id); end loop;
    update lotes_pago set estado = 'en_revision', enviado_revision_por = auth.uid(), enviado_revision_en = now() where id = p_lote;
    perform lote_notificar(p_lote, 'warning', 'Lote de pago por validar: ' || l.numero, v_msg || '. Contabilidad debe revisar detracciones y retenciones.');

  elsif p_estado = 'borrador' then
    if not (auth_tiene_permiso('finanzas', 'lotes_validar') or auth_tiene_permiso('finanzas', 'lotes_armar')) then raise exception 'Sin permiso'; end if;
    if l.estado not in ('en_revision', 'validado') then raise exception 'Solo se devuelve un lote en revisión o validado'; end if;
    update lotes_pago set estado = 'borrador', validado_por = null, validado_en = null where id = p_lote;
    perform lote_notificar(p_lote, 'info', 'Lote de pago devuelto a borrador: ' || l.numero, coalesce(p_motivo, 'Revisar observaciones de Contabilidad.'));

  elsif p_estado = 'validado' then
    if not auth_tiene_permiso('finanzas', 'lotes_validar') then raise exception 'Solo Contabilidad valida el lote (finanzas.lotes_validar)'; end if;
    if l.estado <> 'en_revision' then raise exception 'Solo se valida un lote en revisión'; end if;
    update lotes_pago set estado = 'validado', validado_por = auth.uid(), validado_en = now() where id = p_lote;
    perform lote_notificar(p_lote, 'success', 'Lote de pago validado por Contabilidad: ' || l.numero, v_msg || '. Compras puede enviarlo a tesorería.');

  elsif p_estado = 'por_pagar' then
    if not (auth_tiene_permiso('finanzas', 'lotes_armar') or auth_tiene_permiso('finanzas', 'lotes_validar')) then raise exception 'Sin permiso para enviar a tesorería'; end if;
    if l.estado <> 'validado' then raise exception 'Solo un lote validado se envía a tesorería'; end if;
    update lotes_pago set estado = 'por_pagar', enviado_tesoreria_por = auth.uid(), enviado_tesoreria_en = now() where id = p_lote;
    perform lote_notificar(p_lote, 'warning', 'Lote de pago listo para pagar: ' || l.numero, v_msg || '. Tesorería: exportar para el banco y marcar cada línea pagada.');

  elsif p_estado = 'pagado' then
    if not auth_tiene_permiso('finanzas', 'lotes_pagar') then raise exception 'Sin permiso de tesorería'; end if;
    if l.estado <> 'por_pagar' then raise exception 'El lote no está en pago'; end if;
    if exists (select 1 from lotes_pago_items where lote_id = p_lote and estado = 'pendiente') then raise exception 'Aún hay líneas pendientes de pago'; end if;
    update lotes_pago set estado = 'pagado', pagado_en = now() where id = p_lote;
    perform lote_notificar(p_lote, 'success', 'Lote de pago pagado: ' || l.numero, v_msg);

  elsif p_estado = 'anulado' then
    if not (auth_tiene_permiso('finanzas', 'lotes_armar') or auth_tiene_permiso('finanzas', 'lotes_validar')) then raise exception 'Sin permiso para anular'; end if;
    if l.estado in ('pagado', 'conciliado') then raise exception 'Un lote pagado no se anula'; end if;
    if exists (select 1 from lotes_pago_items where lote_id = p_lote and estado = 'pagada') then raise exception 'El lote tiene líneas pagadas: excluya las pendientes en vez de anular'; end if;
    if coalesce(length(trim(p_motivo)), 0) < 5 then raise exception 'Indique el motivo de la anulación'; end if;
    update lotes_pago set estado = 'anulado', anulado_por = auth.uid(), anulado_en = now(), motivo_anulacion = p_motivo where id = p_lote;
  else
    raise exception 'Cambio de estado no permitido: %', p_estado;
  end if;
  perform lote_bitacora(p_lote, null, 'estado:' || p_estado, jsonb_build_object('desde', l.estado, 'motivo', p_motivo));
end $$;

-- Tesorería: la línea se pagó en el banco. Nacen las transacciones (neto desde
-- la cuenta, detracción a la cuenta del BN, retención como obligación con
-- SUNAT), todas enlazadas al compromiso para que la factura se cierre por el
-- bruto; y los registros de detracción / retención con su constancia pendiente.
create or replace function public.lote_pago_marcar_pagada(
  p_item uuid, p_fecha date, p_cuenta uuid, p_numero_operacion text,
  p_voucher_path text default null, p_notas text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare it record; l record; cta record; v_trx uuid; v_det uuid; v_ret uuid; v_cta_bn uuid; v_num text; v_desc text;
begin
  if not auth_tiene_permiso('finanzas', 'lotes_pagar') then raise exception 'Sin permiso de tesorería (finanzas.lotes_pagar)'; end if;
  select * into it from lotes_pago_items where id = p_item;
  if not found then raise exception 'Línea no encontrada'; end if;
  select * into l from lotes_pago where id = it.lote_id;
  if l.estado <> 'por_pagar' then raise exception 'El lote no está en pago (estado %)', l.estado; end if;
  if it.estado <> 'pendiente' then raise exception 'La línea ya está %', it.estado; end if;
  if p_fecha is null then raise exception 'Indique la fecha del pago'; end if;
  select * into cta from cuentas_bancarias where id = p_cuenta and tenant_id = it.tenant_id;
  if not found then raise exception 'Cuenta bancaria de origen no válida'; end if;
  if cta.moneda <> it.moneda then raise exception 'La cuenta % es en % y la línea en %', cta.nombre, cta.moneda, it.moneda; end if;
  v_desc := coalesce(it.concepto, 'Pago') || coalesce(' · ' || it.referencia_doc, '') || ' · ' || l.numero;

  -- 1) Neto desde el banco
  v_num := trx_siguiente_numero(it.tenant_id, p_fecha);
  insert into transacciones (tenant_id, numero, tipo, categoria, subcategoria, estado, monto, moneda, tipo_cambio, fecha, fecha_pago, descripcion,
                             cuenta_bancaria_id, centro_costo_id, proyecto_id, referencia_numero, referencia_tipo, proveedor_nombre,
                             compromiso_id, comprobante_id, orden_compra_id, comprobante_url, creado_por, aprobado_por, aprobado_en)
  values (it.tenant_id, v_num, 'egreso', 'Pago a proveedores', it.tipo_linea, 'pagada', it.neto, it.moneda, it.tc, p_fecha, p_fecha, v_desc,
          p_cuenta, it.centro_costo_id, it.proyecto_id, p_numero_operacion, 'lote_pago', it.proveedor,
          it.compromiso_id, it.comprobante_id, it.orden_compra_id, p_voucher_path, auth.uid()::text, auth.uid()::text, now())
  returning id into v_trx;

  -- 2) Detracción: sale de la cuenta de detracciones del BN (depósito pendiente de constancia)
  if it.detraccion_aplica and it.detraccion_monto > 0 then
    select id into v_cta_bn from cuentas_bancarias where tenant_id = it.tenant_id and tipo = 'detracciones' and activa order by orden limit 1;
    insert into transacciones (tenant_id, numero, tipo, categoria, subcategoria, estado, monto, moneda, tipo_cambio, fecha, fecha_pago, descripcion,
                               cuenta_bancaria_id, centro_costo_id, proyecto_id, referencia_numero, referencia_tipo, proveedor_nombre,
                               compromiso_id, comprobante_id, orden_compra_id, creado_por, aprobado_por, aprobado_en)
    values (it.tenant_id, trx_siguiente_numero(it.tenant_id, p_fecha), 'egreso', 'Detracción SPOT', it.detraccion_codigo, 'pagada',
            it.detraccion_monto, it.moneda, it.tc, p_fecha, p_fecha, 'Detracción ' || coalesce(it.detraccion_codigo, '') || ' · ' || v_desc,
            v_cta_bn, it.centro_costo_id, it.proyecto_id, null, 'detraccion', it.proveedor,
            it.compromiso_id, it.comprobante_id, it.orden_compra_id, auth.uid()::text, auth.uid()::text, now());
    insert into detracciones (tenant_id, comprobante_id, proveedor_id, lote_item_id, codigo_bien_servicio, descripcion_bien_servicio, tasa,
                              base_detraccion, monto_detraccion, moneda_origen, tipo_cambio, estado, cuenta_bancaria_id, periodo)
    values (it.tenant_id, it.comprobante_id, it.proveedor_id, it.id, coalesce(it.detraccion_codigo, '037'),
            (select descripcion from detraccion_codigos where codigo = it.detraccion_codigo), it.detraccion_tasa,
            coalesce(it.detraccion_base, it.monto), it.detraccion_soles, it.moneda, it.tc, 'pendiente', v_cta_bn, to_char(p_fecha, 'YYYY-MM'))
    returning id into v_det;
  end if;

  -- 3) Retención: obligación con SUNAT (se paga con el PDT del mes), no sale del banco hoy
  if it.retencion_tipo <> 'ninguna' and it.retencion_monto > 0 then
    insert into transacciones (tenant_id, numero, tipo, categoria, subcategoria, estado, monto, moneda, tipo_cambio, fecha, fecha_pago, descripcion,
                               centro_costo_id, proyecto_id, referencia_tipo, proveedor_nombre, compromiso_id, comprobante_id, orden_compra_id,
                               creado_por, aprobado_por, aprobado_en)
    values (it.tenant_id, trx_siguiente_numero(it.tenant_id, p_fecha), 'egreso',
            case it.retencion_tipo when 'igv' then 'Retención IGV' else 'Retención 4ta categoría' end, it.retencion_tipo, 'pagada',
            it.retencion_monto, it.moneda, it.tc, p_fecha, p_fecha, 'Retención · ' || v_desc,
            it.centro_costo_id, it.proyecto_id, 'retencion', it.proveedor, it.compromiso_id, it.comprobante_id, it.orden_compra_id,
            auth.uid()::text, auth.uid()::text, now());
    insert into retenciones_percepciones (tenant_id, comprobante_id, proveedor_id, lote_item_id, tipo, regimen, tasa, base, monto, moneda, fecha, estado, periodo)
    values (it.tenant_id, it.comprobante_id, it.proveedor_id, it.id, 'retencion', it.retencion_tipo, it.retencion_tasa, it.monto, it.retencion_monto,
            it.moneda, p_fecha, 'pendiente', to_char(p_fecha, 'YYYY-MM'))
    returning id into v_ret;
  end if;

  update lotes_pago_items set estado = 'pagada', fecha_pago = p_fecha, cuenta_bancaria_id = p_cuenta, numero_operacion = p_numero_operacion,
         voucher_path = coalesce(p_voucher_path, voucher_path), transaccion_id = v_trx, detraccion_id = v_det, retencion_id = v_ret,
         notas = coalesce(p_notas, notas)
   where id = p_item;
  perform lote_bitacora(it.lote_id, p_item, 'pagar', jsonb_build_object('fecha', p_fecha, 'cuenta', cta.nombre, 'operacion', p_numero_operacion, 'neto', it.neto, 'moneda', it.moneda));

  -- Si fue la última, el lote queda pagado
  if not exists (select 1 from lotes_pago_items where lote_id = it.lote_id and estado = 'pendiente') then
    update lotes_pago set estado = 'pagado', pagado_en = now() where id = it.lote_id and estado = 'por_pagar';
    perform lote_notificar(it.lote_id, 'success', 'Lote de pago completado: ' || l.numero, 'Todas las líneas están pagadas o excluidas.');
  end if;
  return v_trx;
end $$;

-- Tesorería: una línea que al final no se pagó en este lote.
create or replace function public.lote_pago_excluir(p_item uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare it record; l record;
begin
  if not (auth_tiene_permiso('finanzas', 'lotes_pagar') or auth_tiene_permiso('finanzas', 'lotes_armar')) then raise exception 'Sin permiso'; end if;
  select * into it from lotes_pago_items where id = p_item;
  if not found or it.estado <> 'pendiente' then raise exception 'La línea no está pendiente'; end if;
  select * into l from lotes_pago where id = it.lote_id;
  if l.estado not in ('validado', 'por_pagar') then raise exception 'Solo se excluyen líneas de un lote validado o en pago'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 5 then raise exception 'Indique el motivo'; end if;
  update lotes_pago_items set estado = 'excluida', motivo_exclusion = p_motivo where id = p_item;
  perform lote_bitacora(it.lote_id, p_item, 'excluir', jsonb_build_object('motivo', p_motivo));
  if l.estado = 'por_pagar' and not exists (select 1 from lotes_pago_items where lote_id = it.lote_id and estado = 'pendiente') then
    update lotes_pago set estado = 'pagado', pagado_en = now() where id = it.lote_id;
  end if;
end $$;

-- Voucher subido después de marcar pagada (o reemplazo).
create or replace function public.lote_pago_fijar_voucher(p_item uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not auth_tiene_permiso('finanzas', 'lotes_pagar') then raise exception 'Sin permiso de tesorería'; end if;
  update lotes_pago_items set voucher_path = p_path where id = p_item;
  update transacciones t set comprobante_url = p_path from lotes_pago_items i where i.id = p_item and t.id = i.transaccion_id;
end $$;

-- 10. Vistas para las pantallas --------------------------------------------------------
create or replace view public.v_lotes_pago as
select l.*,
       coalesce(x.n, 0)                 as lineas,
       coalesce(x.pendientes, 0)        as lineas_pendientes,
       coalesce(x.pagadas, 0)           as lineas_pagadas,
       coalesce(x.con_alertas, 0)       as lineas_con_alertas,
       coalesce(x.ajustadas, 0)         as lineas_ajustadas,
       coalesce(x.bruto_pen, 0)         as bruto_pen,
       coalesce(x.bruto_usd, 0)         as bruto_usd,
       coalesce(x.neto_pen, 0)          as neto_pen,
       coalesce(x.neto_usd, 0)          as neto_usd,
       coalesce(x.detraccion_soles, 0)  as detraccion_soles,
       coalesce(x.retencion_pen, 0)     as retencion_pen,
       coalesce(x.retencion_usd, 0)     as retencion_usd,
       coalesce(x.neto_total_soles, 0)  as neto_total_soles,
       uc.email                         as creado_por_email,
       uv.email                         as validado_por_email
  from lotes_pago l
  left join lateral (
    select count(*) n,
           count(*) filter (where i.estado = 'pendiente') pendientes,
           count(*) filter (where i.estado = 'pagada') pagadas,
           count(*) filter (where cardinality(i.alertas) > 0 and i.estado <> 'excluida') con_alertas,
           count(*) filter (where i.ajustado) ajustadas,
           sum(i.monto) filter (where i.moneda = 'PEN' and i.estado <> 'excluida') bruto_pen,
           sum(i.monto) filter (where i.moneda = 'USD' and i.estado <> 'excluida') bruto_usd,
           sum(i.neto)  filter (where i.moneda = 'PEN' and i.estado <> 'excluida') neto_pen,
           sum(i.neto)  filter (where i.moneda = 'USD' and i.estado <> 'excluida') neto_usd,
           sum(i.detraccion_soles) filter (where i.estado <> 'excluida') detraccion_soles,
           sum(i.retencion_monto) filter (where i.moneda = 'PEN' and i.estado <> 'excluida') retencion_pen,
           sum(i.retencion_monto) filter (where i.moneda = 'USD' and i.estado <> 'excluida') retencion_usd,
           sum(i.neto_soles) filter (where i.estado <> 'excluida') neto_total_soles
      from lotes_pago_items i where i.lote_id = l.id) x on true
  left join auth.users uc on uc.id = l.creado_por
  left join auth.users uv on uv.id = l.validado_por;

create or replace view public.v_lotes_pago_items as
select i.*,
       p.codigo        as proyecto_codigo,
       cb.nombre       as cuenta_origen_nombre,
       dc.descripcion  as detraccion_descripcion,
       ua.email        as ajustado_por_email,
       c.numero_completo as comprobante_numero,
       c.total         as comprobante_total,
       c.fecha_emision as comprobante_fecha,
       c.fecha_vencimiento as comprobante_vence
  from lotes_pago_items i
  left join proyectos p on p.id = i.proyecto_id
  left join cuentas_bancarias cb on cb.id = i.cuenta_bancaria_id
  left join detraccion_codigos dc on dc.codigo = i.detraccion_codigo
  left join auth.users ua on ua.id = i.ajustado_por
  left join comprobantes_pago c on c.id = i.comprobante_id;

grant select on v_lotes_pago, v_lotes_pago_items, v_cuentas_bancarias_saldo to authenticated;

-- 11. Vouchers de pago: bucket privado, un folder por tenant.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vouchers-pagos', 'vouchers-pagos', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists vouchers_pagos_leer on storage.objects;
create policy vouchers_pagos_leer on storage.objects for select
  using (bucket_id = 'vouchers-pagos' and (storage.foldername(name))[1] = auth_tenant_id()::text and lote_puede_ver());
drop policy if exists vouchers_pagos_subir on storage.objects;
create policy vouchers_pagos_subir on storage.objects for insert
  with check (bucket_id = 'vouchers-pagos' and (storage.foldername(name))[1] = auth_tenant_id()::text and auth_tiene_permiso('finanzas', 'lotes_pagar'));
drop policy if exists vouchers_pagos_reemplazar on storage.objects;
create policy vouchers_pagos_reemplazar on storage.objects for update
  using (bucket_id = 'vouchers-pagos' and (storage.foldername(name))[1] = auth_tenant_id()::text and auth_tiene_permiso('finanzas', 'lotes_pagar'));

-- 12. Realtime: la campana debe enterarse de los cambios de estado del lote.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lotes_pago') then
    alter publication supabase_realtime add table lotes_pago;
  end if;
end $$;

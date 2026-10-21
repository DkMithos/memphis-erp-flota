-- 2026-10-21 · Viajes: el adelanto y la liquidación dejan de ser una anotación ("medio" + "referencia") y
-- generan el movimiento real donde sale o entra la plata:
--   · caja chica      → gasto en `gastos_caja_chica` (adelanto: categoría AUTORIZACIÓN DE VIAJE; reembolso:
--                       RENDICIÓN DE VIÁTICOS, como ya lo registraba Carolina a mano) o ingreso en
--                       `ingresos_caja_chica` (devolución del trabajador, tipo reembolso). Numeración, saldo de la
--                       caja, proyecto por CDC y bloqueo de caja cerrada los ponen los triggers de siempre.
--   · transferencia   → transacción TRX-AAAA-NNNN en la cuenta bancaria elegida (egreso o ingreso), con el n.º de
--                       operación en `referencia_numero`: Bancos la concilia solo contra el extracto.
--   · efectivo / planilla / lote de pago → solo anotación, como antes.
-- Los enlaces quedan en viaje_pasajeros.adelanto_transaccion_id / adelanto_caja_gasto_id y en
-- viaje_rendiciones.transaccion_id / caja_gasto_id / caja_ingreso_id (nueva). El número generado se agrega a la
-- referencia visible ("OPE 123 · GCC-2026-033").

alter table public.viaje_rendiciones add column if not exists caja_ingreso_id uuid references public.ingresos_caja_chica(id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'viaje_pasajeros_adelanto_transaccion_fk') then
    alter table public.viaje_pasajeros add constraint viaje_pasajeros_adelanto_transaccion_fk foreign key (adelanto_transaccion_id) references public.transacciones(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'viaje_pasajeros_adelanto_caja_gasto_fk') then
    alter table public.viaje_pasajeros add constraint viaje_pasajeros_adelanto_caja_gasto_fk foreign key (adelanto_caja_gasto_id) references public.gastos_caja_chica(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'viaje_rendiciones_transaccion_fk') then
    alter table public.viaje_rendiciones add constraint viaje_rendiciones_transaccion_fk foreign key (transaccion_id) references public.transacciones(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'viaje_rendiciones_caja_gasto_fk') then
    alter table public.viaje_rendiciones add constraint viaje_rendiciones_caja_gasto_fk foreign key (caja_gasto_id) references public.gastos_caja_chica(id) on delete set null;
  end if;
end $$;

-- Centro de costo del viaje: el propio, o el del proyecto.
create or replace function public.viaje_cdc(p_viaje uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(v.centro_costo_id, (select c.id from centros_costo c where c.tenant_id = v.tenant_id and c.proyecto_id = v.proyecto_id order by c.activo desc nulls last, c.creado_en limit 1))
  from viajes v where v.id = p_viaje
$$;

-- Movimiento de dinero de un viaje (egreso o ingreso) por caja chica o cuenta bancaria. Devuelve {gasto_id, ingreso_id, transaccion_id, numero}.
create or replace function public.viaje_movimiento_dinero(
  p_viaje uuid, p_sentido text, p_monto numeric, p_fecha date, p_medio text, p_referencia text, p_caja uuid, p_cuenta uuid,
  p_beneficiario text, p_concepto text, p_categoria_caja text, p_subcategoria_trx text, p_ref_tipo text, p_comprobante text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v record; v_caja record; v_cta record; v_cc_id uuid; v_cc text; v_email text; v_num text; v_gasto uuid; v_ingreso uuid; v_trx uuid; v_anio text;
begin
  select * into v from viajes where id = p_viaje;
  if not found then raise exception 'Viaje no encontrado'; end if;
  if coalesce(p_monto, 0) <= 0 then return '{}'::jsonb; end if;
  v_email := coalesce(auth.jwt() ->> 'email', auth.uid()::text);
  v_cc_id := viaje_cdc(p_viaje);
  select codigo into v_cc from centros_costo where id = v_cc_id;

  if p_medio = 'caja_chica' then
    if p_caja is null then raise exception 'Indique la caja chica'; end if;
    select * into v_caja from cajas_chicas where id = p_caja and tenant_id = v.tenant_id;
    if not found then raise exception 'Caja chica no encontrada'; end if;
    if v_caja.estado <> 'activo' then raise exception 'La caja % está cerrada', v_caja.nombre; end if;
    if p_sentido = 'egreso' then
      insert into gastos_caja_chica (tenant_id, caja_id, descripcion, categoria, monto, moneda, fecha, beneficiario, comprobante_numero, comprobante_tipo,
                                     estado, aprobado_por, realizado_por, notas, centro_costo, proyecto_id)
      values (v.tenant_id, p_caja, p_concepto, p_categoria_caja, p_monto, coalesce(v_caja.moneda, 'PEN'), p_fecha, p_beneficiario,
              coalesce(nullif(p_referencia, ''), p_comprobante), 'recibo', 'aprobado', v_email, v_email, 'Registrado desde Viajes · ' || v.numero, v_cc, v.proyecto_id)
      returning id, numero into v_gasto, v_num;
    else
      insert into ingresos_caja_chica (tenant_id, caja_id, descripcion, tipo, monto, moneda, fecha, origen, comprobante_numero, comprobante_tipo, centro_costo, estado)
      values (v.tenant_id, p_caja, p_concepto, 'reembolso', p_monto, coalesce(v_caja.moneda, 'PEN'), p_fecha, p_beneficiario,
              coalesce(nullif(p_referencia, ''), p_comprobante), 'recibo', v_cc, 'confirmado')
      returning id, numero into v_ingreso, v_num;
    end if;
  elsif p_medio in ('transferencia', 'deposito') and p_cuenta is not null then
    select * into v_cta from cuentas_bancarias where id = p_cuenta and tenant_id = v.tenant_id;
    if not found then raise exception 'Cuenta bancaria no encontrada'; end if;
    v_anio := to_char(p_fecha, 'YYYY');
    select 'TRX-' || v_anio || '-' || lpad((coalesce(max(substring(numero from '^TRX-\d{4}-(\d+)$')::int), 0) + 1)::text, 4, '0') into v_num
      from transacciones where tenant_id = v.tenant_id and numero like 'TRX-' || v_anio || '-%';
    insert into transacciones (tenant_id, numero, tipo, categoria, subcategoria, estado, monto, moneda, fecha, fecha_pago, descripcion,
                               cuenta_bancaria_id, centro_costo_id, proyecto_id, referencia_numero, referencia_tipo, proveedor_nombre, creado_por, aprobado_por, aprobado_en)
    values (v.tenant_id, v_num, p_sentido, 'Viáticos y pasajes', p_subcategoria_trx, 'pagada', p_monto, coalesce(v_cta.moneda, 'PEN'), p_fecha, p_fecha,
            p_concepto || ' · ' || p_beneficiario, p_cuenta, v_cc_id, v.proyecto_id, nullif(p_referencia, ''), p_ref_tipo, p_beneficiario,
            auth.uid()::text, auth.uid()::text, now())
    returning id into v_trx;
  end if;
  return jsonb_strip_nulls(jsonb_build_object('gasto_id', v_gasto, 'ingreso_id', v_ingreso, 'transaccion_id', v_trx, 'numero', v_num));
end $$;
revoke all on function public.viaje_movimiento_dinero(uuid, text, numeric, date, text, text, uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;

-- Administración entrega el adelanto. Se puede llamar más de una vez (varios adelantos).
drop function if exists public.viaje_registrar_adelanto(uuid, numeric, date, text, text);
create or replace function public.viaje_registrar_adelanto(
  p_pasajero uuid, p_monto numeric, p_fecha date default current_date, p_medio text default null, p_referencia text default null,
  p_caja uuid default null, p_cuenta uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pa record; v record; m jsonb;
begin
  if not auth_tiene_permiso('viajes', 'editar') then raise exception 'Sin permiso (viajes.editar)'; end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'Indica el monto'; end if;
  select * into pa from viaje_pasajeros where id = p_pasajero and tenant_id = auth_tenant_id();
  if not found then raise exception 'Viajero no encontrado'; end if;
  select * into v from viajes where id = pa.viaje_id;
  if v.estado not in ('aprobado', 'en_curso') then raise exception 'El viaje debe estar aprobado para entregar adelantos (está %)', v.estado; end if;
  m := viaje_movimiento_dinero(v.id, 'egreso', p_monto, p_fecha, p_medio, p_referencia, p_caja, p_cuenta, pa.nombre,
         'Adelanto de viáticos · viaje ' || v.numero || ' · ' || v.destino, 'AUTORIZACIÓN DE VIAJE', 'Adelanto de viáticos', 'viaje_adelanto', v.numero);
  update viaje_pasajeros
     set adelanto_entregado = adelanto_entregado + p_monto, adelanto_fecha = p_fecha, adelanto_medio = coalesce(p_medio, adelanto_medio),
         adelanto_referencia = concat_ws(' · ', adelanto_referencia, nullif(p_referencia, ''), m ->> 'numero'),
         adelanto_transaccion_id = coalesce((m ->> 'transaccion_id')::uuid, adelanto_transaccion_id),
         adelanto_caja_gasto_id = coalesce((m ->> 'gasto_id')::uuid, adelanto_caja_gasto_id)
   where id = p_pasajero;
  if v.estado = 'aprobado' then update viajes set estado = 'en_curso', actualizado_en = now() where id = v.id; end if;
  return m;
end $$;
revoke all on function public.viaje_registrar_adelanto(uuid, numeric, date, text, text, uuid, uuid) from public, anon;
grant execute on function public.viaje_registrar_adelanto(uuid, numeric, date, text, text, uuid, uuid) to authenticated, service_role;

-- Administración registra el reembolso pagado (egreso) o la devolución recibida (ingreso) → liquidada; cierra el viaje si todos rindieron.
drop function if exists public.rendicion_liquidar(uuid, text, text, date);
create or replace function public.rendicion_liquidar(
  p_rendicion uuid, p_medio text, p_referencia text default null, p_fecha date default current_date, p_caja uuid default null, p_cuenta uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; pa record; v record; m jsonb := '{}'::jsonb; v_monto numeric;
begin
  if not auth_tiene_permiso('viajes', 'editar') then raise exception 'Sin permiso (viajes.editar)'; end if;
  select * into r from viaje_rendiciones where id = p_rendicion and tenant_id = auth_tenant_id();
  if not found then raise exception 'Rendición no encontrada'; end if;
  if r.estado <> 'aprobada' then raise exception 'La rendición debe estar aprobada (está %)', r.estado; end if;
  select * into pa from viaje_pasajeros where id = r.pasajero_id;
  select * into v from viajes where id = r.viaje_id;
  v_monto := abs(coalesce(r.saldo, 0));
  if r.resultado = 'empresa_reembolsa' and v_monto > 0 then
    m := viaje_movimiento_dinero(v.id, 'egreso', v_monto, p_fecha, p_medio, p_referencia, p_caja, p_cuenta, pa.nombre,
           'Reembolso por rendición de viáticos ' || r.numero || ' · viaje ' || v.numero, 'RENDICIÓN DE VIÁTICOS', 'Reembolso de viáticos', 'viaje_reembolso', r.numero);
  elsif r.resultado = 'trabajador_devuelve' and v_monto > 0 then
    m := viaje_movimiento_dinero(v.id, 'ingreso', v_monto, p_fecha, p_medio, p_referencia, p_caja, p_cuenta, pa.nombre,
           'Devolución de viáticos ' || r.numero || ' · viaje ' || v.numero, 'RENDICIÓN DE VIÁTICOS', 'Devolución de viáticos', 'viaje_devolucion', r.numero);
  end if;
  update viaje_rendiciones
     set estado = 'liquidada', liquidada_en = p_fecha::timestamptz, liquidacion_medio = p_medio,
         liquidacion_referencia = nullif(concat_ws(' · ', nullif(p_referencia, ''), m ->> 'numero'), ''),
         liquidada_por = auth.uid(), actualizado_en = now(),
         transaccion_id = coalesce((m ->> 'transaccion_id')::uuid, transaccion_id),
         caja_gasto_id = coalesce((m ->> 'gasto_id')::uuid, caja_gasto_id),
         caja_ingreso_id = coalesce((m ->> 'ingreso_id')::uuid, caja_ingreso_id)
   where id = r.id;
  perform viaje_cerrar_si_corresponde(r.viaje_id);
  return m;
end $$;
revoke all on function public.rendicion_liquidar(uuid, text, text, date, uuid, uuid) from public, anon;
grant execute on function public.rendicion_liquidar(uuid, text, text, date, uuid, uuid) to authenticated, service_role;

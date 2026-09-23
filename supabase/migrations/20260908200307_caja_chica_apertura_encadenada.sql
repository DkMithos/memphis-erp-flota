-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260908200307  name: caja_chica_apertura_encadenada

-- Apertura de caja chica como la hace Administración: la caja nueva NACE con el
-- saldo de la anterior y esa anterior queda cerrada en el mismo acto.
--
-- Va en la base y no en la pantalla porque son cuatro escrituras que tienen que
-- ocurrir juntas o ninguna: crear la caja, arrastrar el saldo, sumar el depósito
-- inicial y cerrar la de origen. Hacerlo desde el navegador dejaría cajas a
-- medio abrir si se corta a la mitad.
--
-- Devuelve la fila de la caja nueva.
create or replace function fn_abrir_caja_chica(
  p_responsable     text,
  p_moneda          text,
  p_monto_adicional numeric default 0,
  p_caja_origen     uuid    default null,
  p_nombre          text    default null
)
returns cajas_chicas
language plpgsql
security invoker           -- manda el RLS del usuario, no el del dueño
set search_path = public
as $$
declare
  v_tenant   uuid;
  v_origen   cajas_chicas;
  v_correl   int;
  v_nombre   text;
  v_codigo   text;
  v_nueva    cajas_chicas;
  v_arrastre numeric := 0;
begin
  if p_moneda not in ('PEN', 'USD') then
    raise exception 'Moneda no válida: %', p_moneda;
  end if;
  if coalesce(p_monto_adicional, 0) < 0 then
    raise exception 'El monto adicional no puede ser negativo';
  end if;

  -- La caja de origen manda el tenant y la moneda; si no hay, se toma del JWT.
  if p_caja_origen is not null then
    select * into v_origen from cajas_chicas where id = p_caja_origen;
    if not found then
      raise exception 'La caja de origen no existe';
    end if;
    if v_origen.estado = 'cerrada' then
      raise exception 'La caja % ya está cerrada', v_origen.nombre;
    end if;
    if v_origen.moneda <> p_moneda then
      raise exception 'No se puede arrastrar saldo entre monedas distintas (% → %)',
        v_origen.moneda, p_moneda;
    end if;
    v_tenant := v_origen.tenant_id;
    v_arrastre := coalesce(v_origen.monto_disponible, 0);
  else
    v_tenant := auth_tenant_id();
  end if;

  if v_tenant is null then
    raise exception 'No se pudo determinar la empresa de la caja';
  end if;

  if coalesce(v_arrastre, 0) + coalesce(p_monto_adicional, 0) <= 0 then
    raise exception 'La caja nueva quedaría en cero: indica un monto adicional';
  end if;

  -- Correlativo por moneda, continuando la numeración de Administración.
  select coalesce(max((substring(nombre from 'CAJA ([0-9]+)'))::int), 0) + 1
    into v_correl
    from cajas_chicas
   where tenant_id = v_tenant and moneda = p_moneda;

  v_nombre := coalesce(nullif(btrim(p_nombre), ''),
                       format('CAJA %s %s', v_correl,
                              case when p_moneda = 'USD' then 'DÓLARES' else 'SOLES' end));
  v_codigo := format('ADMI%s-%s', lpad(v_correl::text, 3, '0'),
                     case when p_moneda = 'USD' then 'DOLARES' else 'SOLES' end);

  insert into cajas_chicas (tenant_id, nombre, codigo, moneda, responsable,
                            monto_asignado, monto_disponible, estado)
  values (v_tenant, v_nombre, v_codigo, p_moneda, p_responsable, 0, 0, 'activo')
  returning * into v_nueva;

  -- 1) El arrastre de la caja anterior, como primer movimiento.
  if v_arrastre <> 0 then
    insert into ingresos_caja_chica (tenant_id, caja_id, numero, descripcion, tipo,
                                     monto, moneda, fecha, origen, estado)
    values (v_tenant, v_nueva.id, '1',
            format('SALDO A FAVOR DE CAJA CHICA ANTERIOR (%s)', v_origen.nombre),
            'saldo_anterior', v_arrastre, p_moneda, current_date,
            v_origen.nombre, 'confirmado');
  end if;

  -- 2) El depósito con el que se refuerza la caja, si lo hay.
  if coalesce(p_monto_adicional, 0) > 0 then
    insert into ingresos_caja_chica (tenant_id, caja_id, numero, descripcion, tipo,
                                     monto, moneda, fecha, origen, estado)
    values (v_tenant, v_nueva.id, case when v_arrastre <> 0 then '2' else '1' end,
            'APERTURA DE CAJA', 'reposicion', p_monto_adicional, p_moneda,
            current_date, 'DEPÓSITO', 'confirmado');
  end if;

  -- 3) Recién ahora se cierra la de origen: si algo falló arriba, sigue abierta.
  if p_caja_origen is not null then
    update cajas_chicas set estado = 'cerrada' where id = p_caja_origen;
  end if;

  select * into v_nueva from cajas_chicas where id = v_nueva.id;
  return v_nueva;
end;
$$;

comment on function fn_abrir_caja_chica is
  'Abre una caja chica arrastrando el saldo de otra y cerrándola, en una sola transacción.';

grant execute on function fn_abrir_caja_chica(text, text, numeric, uuid, text) to authenticated;

-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260911171837  name: caja_chica_arrastra_tambien_la_deuda

-- LA CAJA SIGUIENTE HEREDA TAMBIÉN EL SALDO EN CONTRA
--
-- Carolina cerró CAJA 25 SOLES con -125.49 y no pudo encadenar la nueva. Dos
-- motivos, y el que ella sospechaba era el menos importante:
--
-- 1. LA CAJA YA ESTABA CERRADA. La función exigía que el origen estuviera
--    abierto porque cerrarlo era parte del acto de abrir la nueva. Pero cerrar
--    primero y abrir después es la secuencia natural de quien lleva la caja.
--    Ahora se admite un origen cerrado, siempre que su saldo no se haya
--    arrastrado ya a otra caja — el arrastre se hace una sola vez.
--
-- 2. EL SALDO NEGATIVO. El arrastre ya tomaba `monto_disponible` con su signo,
--    así que la deuda viajaba bien; lo que estorbaba era el guardián de "la
--    caja nueva quedaría en cero", que impedía abrir arrastrando solo deuda.
--    Ahora solo se rechaza cuando no hay NADA que mover: ni saldo ni depósito.
--
-- Y el movimiento se llamaba siempre "SALDO A FAVOR", que con un número en rojo
-- era mentira. Ahora se nombra según el signo.

create or replace function public.fn_abrir_caja_chica(
  p_responsable text,
  p_moneda text,
  p_monto_adicional numeric default 0,
  p_caja_origen uuid default null,
  p_nombre text default null
)
returns cajas_chicas
language plpgsql
set search_path to 'public'
as $function$
declare
  v_tenant     uuid;
  v_origen     cajas_chicas;
  v_correl     int;
  v_nombre     text;
  v_codigo     text;
  v_nueva      cajas_chicas;
  v_arrastre   numeric := 0;
  v_ya_cedido  boolean := false;
  v_etiqueta   text;
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
    if v_origen.moneda <> p_moneda then
      raise exception 'No se puede arrastrar saldo entre monedas distintas (% → %)',
        v_origen.moneda, p_moneda;
    end if;

    -- Un saldo se arrastra UNA sola vez. Si ya hay una caja que lo recibió,
    -- volver a hacerlo duplicaría el dinero (o la deuda).
    select exists (
      select 1 from ingresos_caja_chica
       where tipo = 'saldo_anterior' and origen = v_origen.nombre
    ) into v_ya_cedido;
    if v_ya_cedido then
      raise exception 'El saldo de % ya se arrastró a otra caja', v_origen.nombre;
    end if;

    v_tenant   := v_origen.tenant_id;
    v_arrastre := coalesce(v_origen.monto_disponible, 0);
  else
    v_tenant := auth_tenant_id();
  end if;

  if v_tenant is null then
    raise exception 'No se pudo determinar la empresa de la caja';
  end if;

  -- Solo se rechaza si no hay nada que mover. Abrir arrastrando únicamente una
  -- deuda es válido: es justo lo que hay que reflejar.
  if coalesce(v_arrastre, 0) = 0 and coalesce(p_monto_adicional, 0) = 0 then
    raise exception 'No hay nada que abrir: indica un monto adicional';
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

  -- 1) Lo que viene de la caja anterior, llamado por su nombre.
  if v_arrastre <> 0 then
    v_etiqueta := case when v_arrastre < 0
                       then 'DEUDA DE CAJA CHICA ANTERIOR (%s)'
                       else 'SALDO A FAVOR DE CAJA CHICA ANTERIOR (%s)' end;
    insert into ingresos_caja_chica (tenant_id, caja_id, numero, descripcion, tipo,
                                     monto, moneda, fecha, origen, estado)
    values (v_tenant, v_nueva.id, '1',
            format(v_etiqueta, v_origen.nombre),
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

  -- 3) Recién ahora se cierra la de origen, y solo si seguía abierta.
  if p_caja_origen is not null and v_origen.estado <> 'cerrada' then
    update cajas_chicas set estado = 'cerrada' where id = p_caja_origen;
  end if;

  select * into v_nueva from cajas_chicas where id = v_nueva.id;
  return v_nueva;
end;
$function$;

-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260909193451  name: caja_chica_numeracion_en_la_base

-- El número del movimiento se calculaba en el navegador contando los que había
-- en memoria (`length + 1`). Con la lista desactualizada o dos personas
-- registrando a la vez, sale el mismo número dos veces: ya pasó en CAJA 25
-- SOLES, que tiene dos GCC-2026-004 y ningún 003.
--
-- El correlativo pasa a la base, que es la única que puede garantizar que no se
-- repita. Se bloquea la fila de la caja mientras se calcula, así dos altas
-- simultáneas se ponen en fila en vez de pisarse.
--
-- El movimiento migrado del Excel lleva números sueltos ("3", "15"), así que el
-- correlativo se saca de los dígitos finales de cualquier formato.

create or replace function fn_siguiente_correlativo_caja(p_caja uuid, p_tabla text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
begin
  -- El bloqueo serializa a quienes registran en la MISMA caja a la vez.
  perform 1 from cajas_chicas where id = p_caja for update;

  if p_tabla = 'gastos' then
    select coalesce(max(nullif(regexp_replace(numero, '^.*?([0-9]+)$', '\1'), '')::int), 0)
      into v_max from gastos_caja_chica
     where caja_id = p_caja and numero ~ '[0-9]';
  else
    select coalesce(max(nullif(regexp_replace(numero, '^.*?([0-9]+)$', '\1'), '')::int), 0)
      into v_max from ingresos_caja_chica
     where caja_id = p_caja and numero ~ '[0-9]';
  end if;

  return coalesce(v_max, 0) + 1;
end;
$$;

create or replace function fn_numerar_gasto_caja()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo numera si no viene número: la carga masiva trae el del Excel y ese manda.
  if new.numero is null or btrim(new.numero) = '' then
    new.numero := 'GCC-' || to_char(coalesce(new.fecha, current_date), 'YYYY')
                  || '-' || lpad(fn_siguiente_correlativo_caja(new.caja_id, 'gastos')::text, 3, '0');
  end if;
  return new;
end;
$$;

create or replace function fn_numerar_ingreso_caja()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.numero is null or btrim(new.numero) = '' then
    new.numero := fn_siguiente_correlativo_caja(new.caja_id, 'ingresos')::text;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_numerar_gasto on gastos_caja_chica;
create trigger trg_numerar_gasto
  before insert on gastos_caja_chica
  for each row execute function fn_numerar_gasto_caja();

drop trigger if exists trg_numerar_ingreso on ingresos_caja_chica;
create trigger trg_numerar_ingreso
  before insert on ingresos_caja_chica
  for each row execute function fn_numerar_ingreso_caja();

-- El duplicado que ya existe: al segundo GCC-2026-004 se le da el 003, que
-- estaba libre. Así desaparece el número repetido y se cierra el hueco, sin
-- tocar los otros trece documentos.
update gastos_caja_chica g
   set numero = 'GCC-2026-003'
  from cajas_chicas c
 where c.id = g.caja_id and c.nombre = 'CAJA 25 SOLES'
   and g.numero = 'GCC-2026-004'
   and g.descripcion = 'COMPRA DE LAPTOP PARA NUEVO GERENTE GENERAL';

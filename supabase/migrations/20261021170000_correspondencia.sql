-- 2026-10-21 · CORRESPONDENCIA CON EL ESTADO (sprint 6, #10 del análisis de carpetas de Operaciones).
-- Reemplaza "SEGUIMIENTO CARTAS FALTANTES MEMPHIS.xlsx" (una hoja por proyecto; META = expediente o hito,
-- SUB META = etapa, y debajo cada carta/oficio/informe con emisor, receptor, fechas y número).
--   · correspondencia_hilos: el expediente (META) dentro del proyecto: "DOCUMENTO EQUIVALENTE", "VALORIZACIÓN N°02",
--     "ADENDA N°01"…; agrupa los documentos en orden y dice si sigue abierto.
--   · correspondencia: cada documento (carta, oficio, informe, memorándum, proveído, resolución…) o acción pendiente
--     ("PENDIENTE RESPUESTA DE ENTIDAD") con emisor/receptor, fecha del documento y de mesa de partes, plazo y
--     fecha límite, estado, a qué documento responde y el archivo.
-- Permisos: módulo `proyectos` (ver / crear / editar / eliminar / exportar). RLS por tenant.

create table if not exists public.correspondencia_hilos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  proyecto_id   uuid not null references public.proyectos(id) on delete cascade,
  titulo        text not null,
  descripcion   text,
  estado        text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  orden         int  not null default 0,
  origen_datos  text,
  creado_por    uuid,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists correspondencia_hilos_proyecto_idx on public.correspondencia_hilos(proyecto_id, orden);

create table if not exists public.correspondencia (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  proyecto_id       uuid not null references public.proyectos(id) on delete cascade,
  hilo_id           uuid references public.correspondencia_hilos(id) on delete set null,
  etapa             text,                                   -- SUB META del Excel
  numero_doc        text,                                   -- N° carta / oficio / informe (null en acciones pendientes)
  tipo              text not null default 'carta' check (tipo in ('carta','oficio','informe','memorandum','proveido','resolucion','dictamen','expediente','carta_notarial','accion','otro')),
  sentido           text not null default 'recibido' check (sentido in ('emitido','recibido','interno')),
  emisor            text,
  receptor          text,
  asunto            text not null,                          -- ACCIONES POR REALIZAR / HITO
  fecha_documento   date,                                   -- FECHA INGRESO
  fecha_recepcion   date,                                   -- FECHA RECEPCIÓN (mesa de partes)
  requiere_respuesta boolean not null default false,
  plazo_dias        int,
  fecha_limite      date,
  estado            text not null default 'registrado' check (estado in ('registrado','pendiente','respondido','cerrado')),
  responde_a        uuid references public.correspondencia(id) on delete set null,
  respondido_en     date,
  responsable_id    uuid,
  archivo_url       text,
  archivo_nombre    text,
  observaciones     text,
  origen_datos      text,
  fila_excel        int,
  orden             int not null default 0,
  creado_por        uuid,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
create index if not exists correspondencia_proyecto_idx on public.correspondencia(proyecto_id, orden);
create index if not exists correspondencia_hilo_idx on public.correspondencia(hilo_id);
create index if not exists correspondencia_estado_idx on public.correspondencia(tenant_id, estado, fecha_limite);
create index if not exists correspondencia_numero_idx on public.correspondencia(tenant_id, numero_doc);

-- fecha límite = fecha de recepción (o del documento) + plazo, si no la pusieron a mano; pendiente ⇔ requiere respuesta
create or replace function public.correspondencia_antes_de_guardar() returns trigger
language plpgsql as $$
begin
  if new.plazo_dias is not null and new.fecha_limite is null then
    new.fecha_limite := coalesce(new.fecha_recepcion, new.fecha_documento, current_date) + new.plazo_dias;
  end if;
  if new.estado = 'registrado' and new.requiere_respuesta then new.estado := 'pendiente'; end if;
  if new.estado = 'respondido' and new.respondido_en is null then new.respondido_en := current_date; end if;
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists correspondencia_antes_de_guardar on public.correspondencia;
create trigger correspondencia_antes_de_guardar before insert or update on public.correspondencia
  for each row execute function public.correspondencia_antes_de_guardar();

-- al responder: el documento al que responde pasa a respondido
create or replace function public.correspondencia_marca_respondido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.responde_a is not null and (tg_op = 'INSERT' or old.responde_a is distinct from new.responde_a) then
    update correspondencia set estado = 'respondido', respondido_en = coalesce(new.fecha_recepcion, new.fecha_documento, current_date)
     where id = new.responde_a and estado in ('registrado', 'pendiente');
  end if;
  return null;
end $$;
drop trigger if exists correspondencia_marca_respondido on public.correspondencia;
create trigger correspondencia_marca_respondido after insert or update of responde_a on public.correspondencia
  for each row execute function public.correspondencia_marca_respondido();

create or replace function public.correspondencia_hilos_touch() returns trigger language plpgsql as $$
begin new.actualizado_en := now(); return new; end $$;
drop trigger if exists correspondencia_hilos_touch on public.correspondencia_hilos;
create trigger correspondencia_hilos_touch before update on public.correspondencia_hilos
  for each row execute function public.correspondencia_hilos_touch();

-- RLS: leer por tenant; escribir con permiso proyectos.crear/editar/eliminar
alter table public.correspondencia_hilos enable row level security;
alter table public.correspondencia enable row level security;
drop policy if exists correspondencia_hilos_leer on public.correspondencia_hilos;
create policy correspondencia_hilos_leer on public.correspondencia_hilos for select to authenticated using (tenant_id = auth_tenant_id());
drop policy if exists correspondencia_hilos_escribir on public.correspondencia_hilos;
create policy correspondencia_hilos_escribir on public.correspondencia_hilos for all to authenticated
  using (tenant_id = auth_tenant_id() and (auth_tiene_permiso('proyectos', 'editar') or auth_tiene_permiso('proyectos', 'crear')))
  with check (tenant_id = auth_tenant_id() and (auth_tiene_permiso('proyectos', 'editar') or auth_tiene_permiso('proyectos', 'crear')));
drop policy if exists correspondencia_leer on public.correspondencia;
create policy correspondencia_leer on public.correspondencia for select to authenticated using (tenant_id = auth_tenant_id());
drop policy if exists correspondencia_insertar on public.correspondencia;
create policy correspondencia_insertar on public.correspondencia for insert to authenticated
  with check (tenant_id = auth_tenant_id() and (auth_tiene_permiso('proyectos', 'crear') or auth_tiene_permiso('proyectos', 'editar')));
drop policy if exists correspondencia_editar on public.correspondencia;
create policy correspondencia_editar on public.correspondencia for update to authenticated
  using (tenant_id = auth_tenant_id() and auth_tiene_permiso('proyectos', 'editar'))
  with check (tenant_id = auth_tenant_id() and auth_tiene_permiso('proyectos', 'editar'));
drop policy if exists correspondencia_borrar on public.correspondencia;
create policy correspondencia_borrar on public.correspondencia for delete to authenticated
  using (tenant_id = auth_tenant_id() and auth_tiene_permiso('proyectos', 'eliminar'));
grant select, insert, update, delete on public.correspondencia_hilos, public.correspondencia to authenticated;
grant all on public.correspondencia_hilos, public.correspondencia to service_role;

-- Vista con proyecto, hilo y semáforo del plazo
create or replace view public.v_correspondencia with (security_invoker = true) as
select c.*, p.codigo as proyecto_codigo, p.nombre as proyecto_nombre, h.titulo as hilo_titulo, h.estado as hilo_estado,
       r.numero_doc as responde_a_numero,
       case when c.estado in ('pendiente') and c.fecha_limite is not null then c.fecha_limite - current_date end as dias_para_vencer,
       (c.estado = 'pendiente' and c.fecha_limite is not null and c.fecha_limite < current_date) as vencida,
       (select count(*) from correspondencia x where x.responde_a = c.id) as respuestas
from correspondencia c
join proyectos p on p.id = c.proyecto_id
left join correspondencia_hilos h on h.id = c.hilo_id
left join correspondencia r on r.id = c.responde_a;
grant select on public.v_correspondencia to authenticated, service_role;

-- Importador del Excel (una hoja = un proyecto). Re-ejecutable: borra lo que vino antes del mismo origen para ese proyecto.
-- p_filas: [{meta, sub_meta, emisor, asunto, receptor, fecha_documento, fecha_recepcion, numero_doc, tipo, fila}] en el orden de la hoja.
create or replace function public.correspondencia_importar(p_proyecto uuid, p_origen text, p_filas jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; f jsonb; v_hilo uuid; v_orden int := 0; v_hilos int := 0; v_docs int := 0; v_pend int := 0;
        v_tipo text; v_sentido text; v_numero text; v_emisor text; v_asunto text; v_estado text; v_etapa text;
begin
  select tenant_id into v_tenant from proyectos where id = p_proyecto;
  if v_tenant is null then raise exception 'Proyecto no encontrado'; end if;
  delete from correspondencia where proyecto_id = p_proyecto and origen_datos = p_origen;
  delete from correspondencia_hilos where proyecto_id = p_proyecto and origen_datos = p_origen
     and not exists (select 1 from correspondencia c where c.hilo_id = correspondencia_hilos.id);
  for f in select * from jsonb_array_elements(p_filas) loop
    v_orden := v_orden + 1;
    if nullif(trim(f ->> 'meta'), '') is not null then
      insert into correspondencia_hilos (tenant_id, proyecto_id, titulo, orden, origen_datos)
      values (v_tenant, p_proyecto, trim(f ->> 'meta'), v_orden, p_origen) returning id into v_hilo;
      v_hilos := v_hilos + 1;
    end if;
    if nullif(trim(f ->> 'sub_meta'), '') is not null then v_etapa := trim(f ->> 'sub_meta'); end if;
    v_numero := nullif(trim(f ->> 'numero_doc'), '');
    v_emisor := nullif(trim(f ->> 'emisor'), '');
    v_asunto := coalesce(nullif(trim(f ->> 'asunto'), ''), nullif(trim(f ->> 'sub_meta'), ''), nullif(trim(f ->> 'meta'), ''), v_numero, '(sin asunto)');
    if v_numero is null and v_emisor is null and (f ->> 'tipo') is null and (f ->> 'asunto') is null then continue; end if;
    v_tipo := lower(regexp_replace(coalesce(f ->> 'tipo', ''), '\s+', ' ', 'g'));
    v_tipo := case
      when v_tipo like 'carta notarial%' then 'carta_notarial'
      when v_tipo like 'carta%' then 'carta'
      when v_tipo like 'oficio%' then 'oficio'
      when v_tipo like 'informe%' then 'informe'
      when v_tipo like 'memor%' then 'memorandum'
      when v_tipo like 'prove%' then 'proveido'
      when v_tipo like 'resoluc%' then 'resolucion'
      when v_tipo like 'dictamen%' then 'dictamen'
      when v_tipo like 'expediente%' then 'expediente'
      when v_numero is null then 'accion'
      else 'otro' end;
    v_estado := case when v_numero is null and v_tipo = 'accion' then 'pendiente' else 'registrado' end;
    if v_estado = 'pendiente' then v_pend := v_pend + 1; end if;
    v_sentido := case
      when upper(coalesce(v_emisor, '')) in ('EP', 'EJ', 'CO', 'COXI', 'C.O.', 'MEMPHIS', 'CONSORCIO') then 'emitido'
      when upper(coalesce(v_numero, '')) ~ '(MM-|OXI|CAP-|CMSA|CDO/|/JS)' then 'emitido'
      else 'recibido' end;
    insert into correspondencia (tenant_id, proyecto_id, hilo_id, etapa, numero_doc, tipo, sentido, emisor, receptor, asunto, fecha_documento, fecha_recepcion,
                                 requiere_respuesta, estado, origen_datos, fila_excel, orden)
    values (v_tenant, p_proyecto, v_hilo, v_etapa, v_numero, v_tipo, v_sentido, v_emisor, nullif(trim(f ->> 'receptor'), ''), left(v_asunto, 600),
            nullif(f ->> 'fecha_documento', '')::date, nullif(f ->> 'fecha_recepcion', '')::date,
            v_estado = 'pendiente', v_estado, p_origen, (f ->> 'fila')::int, v_orden);
    v_docs := v_docs + 1;
  end loop;
  return jsonb_build_object('hilos', v_hilos, 'documentos', v_docs, 'pendientes', v_pend);
end $$;
revoke all on function public.correspondencia_importar(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.correspondencia_importar(uuid, text, jsonb) to service_role;

comment on table public.correspondencia is 'Cartas, oficios e informes con el Estado por proyecto (reemplaza SEGUIMIENTO CARTAS FALTANTES MEMPHIS.xlsx).';
comment on table public.correspondencia_hilos is 'Expediente o hito (META del Excel) que agrupa la correspondencia de un proyecto.';

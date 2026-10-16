-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 5 (2/2) · Viajes, pasajes y viáticos (#9 del plan de carga).
-- Diseño: docs/DISENO-VIATICOS-Y-UNIDADES.md §1. Política: "Política de pasajes y
-- viáticos" v01 (vigente 05/01/2026, elaborada por Carolina Okamura).
--
-- Flujo que fijó Kevin (16/10/2026):
--   Viaje:      personal solicita → jefatura aprueba (viajes.aprobar) → Carolina da la
--               última aprobación (viajes.aprobar_final).
--   Viáticos:   van dentro de la solicitud del viaje (mismo circuito).
--   Rendición:  personal rinde → jefatura revisa y firma (viajes.aprobar) → Carolina
--               revisa y aprueba (viajes.aprobar_final); devolución o reembolso según saldo.
-- Topes de la política = TARIFAS (`viaticos_tarifas`), pero "siempre piden otros topes
-- y casi nunca se cumple": el tope se sugiere, se puede pedir más con justificación y
-- queda marcado `tope_excedido` para que quien aprueba lo vea; la aprobación de la
-- jefatura o Gerencia convalida el exceso (la política lo dice así).
--
-- Todo trabajador con sesión puede solicitar sus viajes y rendir (RLS por dueño); los
-- permisos del módulo `viajes` gobiernan ver-todo, editar (Administración: reservas y
-- adelantos), aprobar (jefatura), aprobar_final (Carolina), exportar y tarifas.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Permisos ────────────────────────────────────────────────────────────────
insert into permisos (modulo, accion, descripcion) values
  ('viajes', 'ver', 'Ver todos los viajes y rendiciones de la empresa'),
  ('viajes', 'crear', 'Solicitar viajes para otras personas (Administración)'),
  ('viajes', 'editar', 'Registrar reservas, adelantos y liquidaciones'),
  ('viajes', 'aprobar', 'Aprobación de jefatura (viajes y rendiciones)'),
  ('viajes', 'aprobar_final', 'Aprobación final de Administración (viajes y rendiciones)'),
  ('viajes', 'exportar', 'Exportar viajes y rendiciones'),
  ('viajes', 'tarifas', 'Mantener la tabla de tarifas de viáticos')
on conflict do nothing;

do $$ declare r record; p record; begin
  for r in select id, nombre from roles where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' loop
    for p in select id, accion from permisos where modulo = 'viajes' loop
      if r.nombre = 'Administrador'
         or (r.nombre = 'Administración' and p.accion in ('ver','crear','editar','aprobar_final','exportar','tarifas'))
         or (r.nombre = 'Gerencia' and p.accion in ('ver','aprobar','aprobar_final','exportar'))
         or (r.nombre = 'Proyectos' and p.accion in ('ver','aprobar'))
         or (r.nombre = 'Contabilidad' and p.accion in ('ver','exportar')) then
        insert into roles_permisos (rol_id, permiso_id) values (r.id, p.id) on conflict do nothing;
      end if;
    end loop;
  end loop;
end $$;

-- Rol "Personal": trabajador sin módulos del ERP; con un rol asignado pasa la puerta de acceso y usa la app móvil (/app).
insert into roles (tenant_id, nombre, descripcion, es_sistema)
select 'e4b16a80-8500-418e-afaa-0e976b7d9b13', 'Personal', 'Trabajador sin módulos del ERP: entra a la app móvil (/app) para solicitar viajes y rendir viáticos', false
where not exists (select 1 from roles where tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and nombre = 'Personal');

-- ── Tarifas (la política, editable) ─────────────────────────────────────────
create table if not exists public.viaticos_tarifas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  concepto text not null check (concepto in ('alimentacion','hospedaje','adelanto_sin_hospedaje','adelanto_con_hospedaje','movilidad','otro')),
  descripcion text not null,
  monto numeric(12,2) not null,
  moneda text not null default 'PEN',
  unidad text not null default 'dia' check (unidad in ('dia','noche','viaje')),
  requiere_sustento boolean not null default false,
  vigente_desde date not null default current_date,
  vigente_hasta date,
  activo boolean not null default true,
  notas text,
  creado_en timestamptz not null default now()
);
alter table public.viaticos_tarifas enable row level security;
drop policy if exists ti_viaticos_tarifas_ver on public.viaticos_tarifas;
create policy ti_viaticos_tarifas_ver on public.viaticos_tarifas for select using (tenant_id = (select auth_tenant_id()));
drop policy if exists ti_viaticos_tarifas_editar on public.viaticos_tarifas;
create policy ti_viaticos_tarifas_editar on public.viaticos_tarifas for all
  using (tenant_id = (select auth_tenant_id()) and auth_tiene_permiso('viajes', 'tarifas'))
  with check (tenant_id = (select auth_tenant_id()) and auth_tiene_permiso('viajes', 'tarifas'));
grant select, insert, update, delete on public.viaticos_tarifas to authenticated, service_role;

insert into viaticos_tarifas (tenant_id, concepto, descripcion, monto, unidad, requiere_sustento, vigente_desde, notas) values
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'alimentacion', 'Alimentación (desayuno S/30 + almuerzo S/70 + cena S/50)', 150, 'dia', false, '2026-01-05', 'Sin comprobante mientras no se exceda'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'hospedaje', 'Hospedaje por noche', 250, 'noche', true, '2026-01-05', 'Con comprobante de pago válido'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'adelanto_sin_hospedaje', 'Viáticos adelantados por día, sin hospedaje', 300, 'dia', false, '2026-01-05', null),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'adelanto_con_hospedaje', 'Viáticos adelantados por día, con hospedaje', 550, 'dia', false, '2026-01-05', null),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'movilidad', 'Movilidad, peajes y otros', 0, 'viaje', true, '2026-01-05', 'Solo con comprobante y si es necesario; sin tope fijo');

-- ── Viajes ──────────────────────────────────────────────────────────────────
create table if not exists public.viajes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  numero text not null,                                   -- NNN-MM-INICIALES-AAAA (política)
  proyecto_id uuid references proyectos(id),
  centro_costo_id uuid references centros_costo(id),
  motivo text not null,
  origen text not null default 'LIMA',
  destino text not null,
  fecha_salida date not null,
  fecha_retorno date not null,
  hora_salida time,
  hora_retorno time,
  medio_sugerido text,                                    -- aéreo / terrestre
  requiere_pasajes boolean not null default true,
  requiere_viaticos boolean not null default true,
  con_hospedaje boolean not null default true,
  estado text not null default 'solicitado'
    check (estado in ('solicitado','aprobado_jefatura','aprobado','rechazado','en_curso','rendido','cerrado','anulado')),
  solicitado_por uuid not null,
  solicitado_en timestamptz not null default now(),
  aprobado_jefatura_por uuid, aprobado_jefatura_en timestamptz, comentario_jefatura text,
  aprobado_por uuid, aprobado_en timestamptz, comentario_aprobacion text,
  rechazado_por uuid, rechazado_en timestamptz, motivo_rechazo text,
  cerrado_por uuid, cerrado_en timestamptz,
  presupuesto_viaticos numeric(12,2) not null default 0,   -- suma de viáticos solicitados
  tope_excedido boolean not null default false,
  justificacion_tope text,
  observaciones text,
  origen_datos text not null default 'erp',               -- erp · app · excel-control-viajes
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (tenant_id, numero)
);
create index if not exists viajes_estado_idx on public.viajes (tenant_id, estado);
create index if not exists viajes_solicitante_idx on public.viajes (solicitado_por);
create index if not exists viajes_proyecto_idx on public.viajes (proyecto_id);

create table if not exists public.viaje_pasajeros (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  viaje_id uuid not null references viajes(id) on delete cascade,
  user_id uuid,                                           -- usuario del ERP si lo tiene
  nombre text not null,
  dni text,
  cargo text,
  es_externo boolean not null default false,
  dias integer not null default 1,
  con_hospedaje boolean not null default true,
  tarifa_diaria numeric(12,2) not null default 0,
  viatico_calculado numeric(12,2) not null default 0,     -- tarifa × días
  viatico_solicitado numeric(12,2) not null default 0,    -- lo que se pide (puede exceder)
  viatico_aprobado numeric(12,2),
  cuenta_abono text,
  adelanto_entregado numeric(12,2) not null default 0,
  adelanto_fecha date, adelanto_medio text, adelanto_referencia text,
  adelanto_transaccion_id uuid, adelanto_caja_gasto_id uuid,
  notas text,
  creado_en timestamptz not null default now()
);
create index if not exists viaje_pasajeros_viaje_idx on public.viaje_pasajeros (viaje_id);
create index if not exists viaje_pasajeros_user_idx on public.viaje_pasajeros (user_id) where user_id is not null;

create table if not exists public.viaje_reservas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  viaje_id uuid not null references viajes(id) on delete cascade,
  pasajero_id uuid references viaje_pasajeros(id) on delete set null,
  codigo_reserva text,
  tipo text not null default 'aereo' check (tipo in ('aereo','terrestre','hospedaje','otro')),
  proveedor_id uuid references proveedores(id),
  empresa text,                                           -- aerolínea / agencia / hotel
  tramo text check (tramo in ('ida','vuelta','multitramo')),
  origen text, destino text,
  fecha_salida date, hora_salida time, fecha_llegada date, hora_llegada time,
  moneda text not null default 'PEN',
  costo numeric(12,2) not null default 0,
  tc numeric(8,4),
  costo_soles numeric(12,2) generated always as (round(costo * coalesce(tc, 1), 2)) stored,
  pago text not null default 'pendiente' check (pago in ('transferencia','tarjeta','efectivo','pendiente')),
  origen_pago text,                                       -- caja chica soles / BBVA / tarjeta…
  estado_pago text not null default 'pendiente' check (estado_pago in ('pendiente','pagado')),
  fecha_pago date,
  comprobante_id uuid references comprobantes_pago(id),
  transaccion_id uuid,
  caja_gasto_id uuid,
  observaciones text,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);
create index if not exists viaje_reservas_viaje_idx on public.viaje_reservas (viaje_id);

create table if not exists public.viaje_rendiciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  viaje_id uuid not null references viajes(id) on delete cascade,
  pasajero_id uuid not null references viaje_pasajeros(id) on delete cascade,
  numero text not null,                                   -- RD-AAAA-NNNN
  fecha date not null default current_date,
  estado text not null default 'borrador'
    check (estado in ('borrador','presentada','observada','revisada_jefatura','aprobada','liquidada')),
  entregado numeric(12,2) not null default 0,             -- adelantos recibidos
  gastado numeric(12,2) not null default 0,               -- suma de ítems (S/)
  saldo numeric(12,2) not null default 0,                 -- gastado − entregado (+ empresa reembolsa, − trabajador devuelve)
  resultado text check (resultado in ('empresa_reembolsa','trabajador_devuelve','cuadra')),
  tope_excedido boolean not null default false,
  justificacion text,
  presentada_en timestamptz,
  revisada_por uuid, revisada_en timestamptz, comentario_jefatura text,
  aprobada_por uuid, aprobada_en timestamptz, comentario_aprobacion text,
  observacion text,
  liquidada_en timestamptz, liquidacion_medio text, liquidacion_referencia text, liquidada_por uuid,
  transaccion_id uuid, caja_gasto_id uuid,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (tenant_id, numero),
  unique (viaje_id, pasajero_id)
);

create table if not exists public.viaje_rendicion_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  rendicion_id uuid not null references viaje_rendiciones(id) on delete cascade,
  fecha date not null default current_date,
  tipo_gasto text not null default 'alimentacion' check (tipo_gasto in ('alimentacion','hospedaje','movilidad','peaje','pasaje','otro')),
  descripcion text,
  comprobante_tipo text not null default 'sin_comprobante' check (comprobante_tipo in ('factura','boleta','recibo','ticket','sin_comprobante','otro')),
  comprobante_numero text,
  ruc text,
  proveedor_nombre text,
  moneda text not null default 'PEN',
  monto numeric(12,2) not null,
  tc numeric(8,4),
  monto_soles numeric(12,2) generated always as (round(monto * coalesce(tc, 1), 2)) stored,
  sustentado boolean not null default false,
  foto_path text,                                         -- bucket viajes-sustentos
  comprobante_id uuid references comprobantes_pago(id),
  aceptado boolean not null default true,
  observacion text,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);
create index if not exists viaje_rendicion_items_rend_idx on public.viaje_rendicion_items (rendicion_id);

-- ── Visibilidad ─────────────────────────────────────────────────────────────
-- Un viaje lo ve quien tiene viajes.ver, quien lo solicitó y quien viaja en él.
create or replace function public.viaje_puede_ver(p_viaje uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from viajes v
     where v.id = p_viaje and v.tenant_id = auth_tenant_id()
       and (auth_tiene_permiso('viajes', 'ver') or v.solicitado_por = auth.uid()
            or exists (select 1 from viaje_pasajeros p where p.viaje_id = v.id and p.user_id = auth.uid()))
  );
$$;
revoke all on function public.viaje_puede_ver(uuid) from public, anon;
grant execute on function public.viaje_puede_ver(uuid) to authenticated, service_role;

alter table public.viajes enable row level security;
alter table public.viaje_pasajeros enable row level security;
alter table public.viaje_reservas enable row level security;
alter table public.viaje_rendiciones enable row level security;
alter table public.viaje_rendicion_items enable row level security;

drop policy if exists viajes_ver on public.viajes;
create policy viajes_ver on public.viajes for select using (viaje_puede_ver(id));
drop policy if exists viajes_gestion on public.viajes;
create policy viajes_gestion on public.viajes for all
  using (tenant_id = (select auth_tenant_id()) and auth_tiene_permiso('viajes', 'editar'))
  with check (tenant_id = (select auth_tenant_id()) and auth_tiene_permiso('viajes', 'editar'));

drop policy if exists viaje_pasajeros_ver on public.viaje_pasajeros;
create policy viaje_pasajeros_ver on public.viaje_pasajeros for select using (viaje_puede_ver(viaje_id));
drop policy if exists viaje_pasajeros_gestion on public.viaje_pasajeros;
create policy viaje_pasajeros_gestion on public.viaje_pasajeros for all
  using (tenant_id = (select auth_tenant_id()) and auth_tiene_permiso('viajes', 'editar'))
  with check (tenant_id = (select auth_tenant_id()) and auth_tiene_permiso('viajes', 'editar'));

drop policy if exists viaje_reservas_ver on public.viaje_reservas;
create policy viaje_reservas_ver on public.viaje_reservas for select using (viaje_puede_ver(viaje_id));
drop policy if exists viaje_reservas_gestion on public.viaje_reservas;
create policy viaje_reservas_gestion on public.viaje_reservas for all
  using (tenant_id = (select auth_tenant_id()) and auth_tiene_permiso('viajes', 'editar'))
  with check (tenant_id = (select auth_tenant_id()) and auth_tiene_permiso('viajes', 'editar'));

drop policy if exists viaje_rendiciones_ver on public.viaje_rendiciones;
create policy viaje_rendiciones_ver on public.viaje_rendiciones for select using (viaje_puede_ver(viaje_id));
drop policy if exists viaje_rendiciones_gestion on public.viaje_rendiciones;
create policy viaje_rendiciones_gestion on public.viaje_rendiciones for all
  using (tenant_id = (select auth_tenant_id()) and auth_tiene_permiso('viajes', 'editar'))
  with check (tenant_id = (select auth_tenant_id()) and auth_tiene_permiso('viajes', 'editar'));

drop policy if exists viaje_rendicion_items_ver on public.viaje_rendicion_items;
create policy viaje_rendicion_items_ver on public.viaje_rendicion_items for select
  using (exists (select 1 from viaje_rendiciones r where r.id = rendicion_id and viaje_puede_ver(r.viaje_id)));
drop policy if exists viaje_rendicion_items_gestion on public.viaje_rendicion_items;
create policy viaje_rendicion_items_gestion on public.viaje_rendicion_items for all
  using (tenant_id = (select auth_tenant_id()) and auth_tiene_permiso('viajes', 'editar'))
  with check (tenant_id = (select auth_tenant_id()) and auth_tiene_permiso('viajes', 'editar'));

grant select, insert, update, delete on public.viajes, public.viaje_pasajeros, public.viaje_reservas, public.viaje_rendiciones, public.viaje_rendicion_items to authenticated, service_role;
revoke all on public.viajes, public.viaje_pasajeros, public.viaje_reservas, public.viaje_rendiciones, public.viaje_rendicion_items, public.viaticos_tarifas from anon;

-- ── Sustentos (fotos de comprobantes desde el celular) ──────────────────────
insert into storage.buckets (id, name, public) values ('viajes-sustentos', 'viajes-sustentos', false) on conflict (id) do nothing;
drop policy if exists viajes_sustentos_subir on storage.objects;
create policy viajes_sustentos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'viajes-sustentos' and (storage.foldername(name))[1] = (select auth_tenant_id())::text);
drop policy if exists viajes_sustentos_leer on storage.objects;
create policy viajes_sustentos_leer on storage.objects for select to authenticated
  using (bucket_id = 'viajes-sustentos' and (storage.foldername(name))[1] = (select auth_tenant_id())::text);
drop policy if exists viajes_sustentos_borrar on storage.objects;
create policy viajes_sustentos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'viajes-sustentos' and (storage.foldername(name))[1] = (select auth_tenant_id())::text
         and (owner = auth.uid() or auth_tiene_permiso('viajes', 'editar')));

-- ── Utilidades ──────────────────────────────────────────────────────────────
create or replace function public.viaje_iniciales(p_nombre text) returns text
language sql immutable set search_path = public as $$
  select coalesce(nullif(upper(string_agg(left(w, 1), '')), ''), 'XX')
    from (select unnest(regexp_split_to_array(trim(coalesce(p_nombre, '')), '\s+')) as w limit 4) x
   where w <> '';
$$;

create or replace function public.viaje_tarifa(p_tenant uuid, p_concepto text, p_fecha date default current_date) returns numeric
language sql stable set search_path = public as $$
  select monto from viaticos_tarifas
   where tenant_id = p_tenant and concepto = p_concepto and activo
     and vigente_desde <= p_fecha and (vigente_hasta is null or vigente_hasta >= p_fecha)
   order by vigente_desde desc limit 1;
$$;

create or replace function public.viaje_notificar(p_tenant uuid, p_tipo text, p_titulo text, p_mensaje text, p_viaje uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into notificaciones (tenant_id, tipo, titulo, mensaje, leida, entidad_tipo, entidad_id)
  values (p_tenant, p_tipo, p_titulo, p_mensaje, false, 'viaje', p_viaje::text);
exception when others then null; -- una notificación nunca tumba la operación
end $$;

-- ── Solicitar ───────────────────────────────────────────────────────────────
-- p: {proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, hora_salida, hora_retorno,
--     medio_sugerido, requiere_pasajes, requiere_viaticos, con_hospedaje, justificacion_tope, observaciones, origen_datos,
--     pasajeros: [{user_id, nombre, dni, cargo, es_externo, dias, con_hospedaje, viatico_solicitado, cuenta_abono, notas}]}
create or replace function public.viaje_solicitar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := auth_tenant_id(); v_uid uuid := auth.uid(); v_id uuid; v_num text; v_ini text; v_anio text; v_n int;
        q jsonb; v_dias int; v_tarifa numeric; v_calc numeric; v_sol numeric; v_total numeric := 0; v_excede boolean := false;
        v_nombre text; v_hosp boolean; v_proy uuid; v_cdc uuid; v_primero text;
begin
  if v_uid is null then raise exception 'Sin sesión'; end if;
  if coalesce(p->>'motivo', '') = '' then raise exception 'Falta el motivo del viaje'; end if;
  if coalesce(p->>'destino', '') = '' then raise exception 'Falta el destino'; end if;
  if (p->>'fecha_salida') is null or (p->>'fecha_retorno') is null then raise exception 'Faltan las fechas'; end if;
  if (p->>'fecha_retorno')::date < (p->>'fecha_salida')::date then raise exception 'El retorno no puede ser antes de la salida'; end if;
  if jsonb_array_length(coalesce(p->'pasajeros', '[]'::jsonb)) = 0 then raise exception 'Indica al menos un viajero'; end if;
  -- Solicitar para otros exige viajes.crear; para uno mismo no hace falta permiso.
  if not auth_tiene_permiso('viajes', 'crear') then
    if not exists (select 1 from jsonb_array_elements(p->'pasajeros') x where nullif(x->>'user_id', '')::uuid = v_uid) then
      raise exception 'Solo puedes solicitar viajes en los que viajas tú (Administración solicita para otros)';
    end if;
  end if;

  v_proy := nullif(p->>'proyecto_id', '')::uuid;
  v_cdc := nullif(p->>'centro_costo_id', '')::uuid;
  if v_proy is not null and v_cdc is null then
    select id into v_cdc from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_tenant order by codigo limit 1;
  end if;
  if v_proy is null and v_cdc is null then
    select id into v_cdc from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_tenant;  -- viajes de oficina
  end if;

  -- Número NNN-MM-INICIALES-AAAA: correlativo por iniciales del primer viajero y año (como el Excel de Administración).
  v_primero := p->'pasajeros'->0->>'nombre';
  v_ini := viaje_iniciales(v_primero);
  v_anio := to_char((p->>'fecha_salida')::date, 'YYYY');
  select coalesce(max(substring(numero from '^(\d+)-MM-')::int), 0) + 1 into v_n
    from viajes where tenant_id = v_tenant and numero like '%-MM-' || v_ini || '-' || v_anio;
  v_num := lpad(v_n::text, 3, '0') || '-MM-' || v_ini || '-' || v_anio;

  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, hora_salida, hora_retorno,
                      medio_sugerido, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, justificacion_tope, observaciones, origen_datos)
  values (v_tenant, v_num, v_proy, v_cdc, p->>'motivo', coalesce(nullif(p->>'origen', ''), 'LIMA'), p->>'destino',
          (p->>'fecha_salida')::date, (p->>'fecha_retorno')::date, nullif(p->>'hora_salida', '')::time, nullif(p->>'hora_retorno', '')::time,
          nullif(p->>'medio_sugerido', ''), coalesce((p->>'requiere_pasajes')::boolean, true), coalesce((p->>'requiere_viaticos')::boolean, true),
          coalesce((p->>'con_hospedaje')::boolean, true), 'solicitado', v_uid, nullif(p->>'justificacion_tope', ''), nullif(p->>'observaciones', ''),
          coalesce(nullif(p->>'origen_datos', ''), 'erp'))
  returning id into v_id;

  for q in select * from jsonb_array_elements(p->'pasajeros') loop
    v_nombre := trim(coalesce(q->>'nombre', ''));
    if v_nombre = '' then raise exception 'Un viajero no tiene nombre'; end if;
    v_hosp := coalesce((q->>'con_hospedaje')::boolean, coalesce((p->>'con_hospedaje')::boolean, true));
    v_dias := greatest(coalesce((q->>'dias')::int, ((p->>'fecha_retorno')::date - (p->>'fecha_salida')::date) + 1), 1);
    v_tarifa := case when coalesce((p->>'requiere_viaticos')::boolean, true)
                     then coalesce(viaje_tarifa(v_tenant, case when v_hosp then 'adelanto_con_hospedaje' else 'adelanto_sin_hospedaje' end, (p->>'fecha_salida')::date), 0)
                     else 0 end;
    v_calc := round(v_tarifa * v_dias, 2);
    v_sol := coalesce((q->>'viatico_solicitado')::numeric, v_calc);
    if v_sol > v_calc then v_excede := true; end if;
    v_total := v_total + v_sol;
    insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, dni, cargo, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, cuenta_abono, notas)
    values (v_tenant, v_id, nullif(q->>'user_id', '')::uuid, v_nombre, nullif(q->>'dni', ''), nullif(q->>'cargo', ''), coalesce((q->>'es_externo')::boolean, false),
            v_dias, v_hosp, v_tarifa, v_calc, v_sol, nullif(q->>'cuenta_abono', ''), nullif(q->>'notas', ''));
  end loop;

  if v_excede and coalesce(p->>'justificacion_tope', '') = '' then
    raise exception 'El viático pedido supera la tarifa de la política: escribe la justificación';
  end if;
  update viajes set presupuesto_viaticos = v_total, tope_excedido = v_excede where id = v_id;
  perform viaje_notificar(v_tenant, 'viaje_solicitado', 'Viaje por aprobar: ' || v_num,
                          (p->>'destino') || ' · ' || v_primero || ' · ' || to_char((p->>'fecha_salida')::date, 'DD/MM') || ' al ' || to_char((p->>'fecha_retorno')::date, 'DD/MM') ||
                          case when v_excede then ' · EXCEDE TARIFA' else '' end, v_id);
  return jsonb_build_object('id', v_id, 'numero', v_num, 'presupuesto_viaticos', v_total, 'tope_excedido', v_excede);
end $$;
revoke all on function public.viaje_solicitar(jsonb) from public, anon;
grant execute on function public.viaje_solicitar(jsonb) to authenticated, service_role;

-- ── Aprobar / rechazar / anular ─────────────────────────────────────────────
create or replace function public.viaje_aprobar(p_viaje uuid, p_comentario text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v record; v_uid uuid := auth.uid();
begin
  select * into v from viajes where id = p_viaje and tenant_id = auth_tenant_id();
  if not found then raise exception 'Viaje no encontrado'; end if;
  if v.estado = 'solicitado' then
    if not auth_tiene_permiso('viajes', 'aprobar') then raise exception 'La primera aprobación es de la jefatura (viajes.aprobar)'; end if;
    if v.solicitado_por = v_uid and not auth_tiene_permiso('viajes', 'aprobar_final') then raise exception 'No puedes aprobar tu propio viaje'; end if;
    update viajes set estado = 'aprobado_jefatura', aprobado_jefatura_por = v_uid, aprobado_jefatura_en = now(), comentario_jefatura = nullif(p_comentario, ''), actualizado_en = now() where id = p_viaje;
    perform viaje_notificar(v.tenant_id, 'viaje_jefatura_ok', 'Viaje ' || v.numero || ' aprobado por jefatura', 'Falta la aprobación final de Administración', p_viaje);
    return jsonb_build_object('estado', 'aprobado_jefatura');
  elsif v.estado = 'aprobado_jefatura' then
    if not auth_tiene_permiso('viajes', 'aprobar_final') then raise exception 'La aprobación final es de Administración (viajes.aprobar_final)'; end if;
    update viajes set estado = 'aprobado', aprobado_por = v_uid, aprobado_en = now(), comentario_aprobacion = nullif(p_comentario, ''), actualizado_en = now() where id = p_viaje;
    update viaje_pasajeros set viatico_aprobado = coalesce(viatico_aprobado, viatico_solicitado) where viaje_id = p_viaje;
    perform viaje_notificar(v.tenant_id, 'viaje_aprobado', 'Viaje ' || v.numero || ' aprobado', 'Administración puede comprar pasajes y entregar los adelantos', p_viaje);
    return jsonb_build_object('estado', 'aprobado');
  else
    raise exception 'El viaje está en estado % y no admite aprobación', v.estado;
  end if;
end $$;
revoke all on function public.viaje_aprobar(uuid, text) from public, anon;
grant execute on function public.viaje_aprobar(uuid, text) to authenticated, service_role;

create or replace function public.viaje_rechazar(p_viaje uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if not (auth_tiene_permiso('viajes', 'aprobar') or auth_tiene_permiso('viajes', 'aprobar_final')) then raise exception 'Sin permiso para rechazar'; end if;
  if coalesce(p_motivo, '') = '' then raise exception 'Escribe el motivo del rechazo'; end if;
  select * into v from viajes where id = p_viaje and tenant_id = auth_tenant_id();
  if not found then raise exception 'Viaje no encontrado'; end if;
  if v.estado not in ('solicitado', 'aprobado_jefatura') then raise exception 'El viaje ya no está en aprobación'; end if;
  update viajes set estado = 'rechazado', rechazado_por = auth.uid(), rechazado_en = now(), motivo_rechazo = p_motivo, actualizado_en = now() where id = p_viaje;
  perform viaje_notificar(v.tenant_id, 'viaje_rechazado', 'Viaje ' || v.numero || ' rechazado', p_motivo, p_viaje);
end $$;
revoke all on function public.viaje_rechazar(uuid, text) from public, anon;
grant execute on function public.viaje_rechazar(uuid, text) to authenticated, service_role;

create or replace function public.viaje_anular(p_viaje uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from viajes where id = p_viaje and tenant_id = auth_tenant_id();
  if not found then raise exception 'Viaje no encontrado'; end if;
  if not (auth_tiene_permiso('viajes', 'editar') or (v.solicitado_por = auth.uid() and v.estado in ('solicitado', 'aprobado_jefatura'))) then
    raise exception 'Solo quien solicitó (antes de la aprobación final) o Administración pueden anular';
  end if;
  if v.estado in ('cerrado', 'anulado') then raise exception 'El viaje ya está %', v.estado; end if;
  if exists (select 1 from viaje_pasajeros where viaje_id = p_viaje and adelanto_entregado > 0) then raise exception 'Tiene adelantos entregados: hay que rendirlos, no anular'; end if;
  update viajes set estado = 'anulado', observaciones = concat_ws(' · ', observaciones, 'Anulado: ' || coalesce(p_motivo, 'sin motivo')), actualizado_en = now() where id = p_viaje;
end $$;
revoke all on function public.viaje_anular(uuid, text) from public, anon;
grant execute on function public.viaje_anular(uuid, text) to authenticated, service_role;

-- Administración entrega el adelanto (caja chica o transferencia). Se puede llamar más de una vez (varios adelantos).
create or replace function public.viaje_registrar_adelanto(p_pasajero uuid, p_monto numeric, p_fecha date default current_date, p_medio text default null, p_referencia text default null) returns void
language plpgsql security definer set search_path = public as $$
declare pa record; v record;
begin
  if not auth_tiene_permiso('viajes', 'editar') then raise exception 'Sin permiso (viajes.editar)'; end if;
  if coalesce(p_monto, 0) = 0 then raise exception 'Indica el monto'; end if;
  select * into pa from viaje_pasajeros where id = p_pasajero and tenant_id = auth_tenant_id();
  if not found then raise exception 'Viajero no encontrado'; end if;
  select * into v from viajes where id = pa.viaje_id;
  if v.estado not in ('aprobado', 'en_curso') then raise exception 'El viaje debe estar aprobado para entregar adelantos (está %)', v.estado; end if;
  update viaje_pasajeros set adelanto_entregado = adelanto_entregado + p_monto, adelanto_fecha = p_fecha, adelanto_medio = coalesce(p_medio, adelanto_medio),
         adelanto_referencia = concat_ws(' · ', adelanto_referencia, nullif(p_referencia, '')) where id = p_pasajero;
  if v.estado = 'aprobado' then update viajes set estado = 'en_curso', actualizado_en = now() where id = v.id; end if;
end $$;
revoke all on function public.viaje_registrar_adelanto(uuid, numeric, date, text, text) from public, anon;
grant execute on function public.viaje_registrar_adelanto(uuid, numeric, date, text, text) to authenticated, service_role;

-- ── Rendición ───────────────────────────────────────────────────────────────
-- Guarda (crea o reemplaza) la rendición en borrador de un viajero, con sus ítems.
-- p: {viaje_id, pasajero_id, fecha, notas, items: [{fecha, tipo_gasto, descripcion, comprobante_tipo, comprobante_numero, ruc,
--     proveedor_nombre, moneda, monto, tc, sustentado, foto_path}]}
create or replace function public.rendicion_guardar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := auth_tenant_id(); v_uid uuid := auth.uid(); pa record; v record; r_id uuid; q jsonb; v_num text; v_anio text; v_n int; v_gast numeric := 0;
begin
  select * into pa from viaje_pasajeros where id = (p->>'pasajero_id')::uuid and tenant_id = v_tenant;
  if not found then raise exception 'Viajero no encontrado'; end if;
  select * into v from viajes where id = pa.viaje_id;
  if not (pa.user_id = v_uid or v.solicitado_por = v_uid or auth_tiene_permiso('viajes', 'editar')) then raise exception 'Solo el viajero (o Administración) puede rendir'; end if;
  if v.estado not in ('aprobado', 'en_curso', 'rendido') then raise exception 'El viaje debe estar aprobado para rendir (está %)', v.estado; end if;

  select id into r_id from viaje_rendiciones where viaje_id = v.id and pasajero_id = pa.id;
  if r_id is null then
    v_anio := to_char(current_date, 'YYYY');
    select coalesce(max(substring(numero from '^RD-\d{4}-(\d+)$')::int), 0) + 1 into v_n from viaje_rendiciones where tenant_id = v_tenant and numero like 'RD-' || v_anio || '-%';
    v_num := 'RD-' || v_anio || '-' || lpad(v_n::text, 4, '0');
    insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, notas)
    values (v_tenant, v.id, pa.id, v_num, coalesce(nullif(p->>'fecha', '')::date, current_date), 'borrador', nullif(p->>'notas', '')) returning id into r_id;
  else
    if exists (select 1 from viaje_rendiciones where id = r_id and estado not in ('borrador', 'observada')) then raise exception 'La rendición ya fue presentada; pide a Administración que la observe para corregirla'; end if;
    update viaje_rendiciones set fecha = coalesce(nullif(p->>'fecha', '')::date, fecha), notas = coalesce(nullif(p->>'notas', ''), notas), estado = 'borrador', actualizado_en = now() where id = r_id;
    delete from viaje_rendicion_items where rendicion_id = r_id;
  end if;

  for q in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    if coalesce((q->>'monto')::numeric, 0) <= 0 then continue; end if;
    insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, comprobante_numero, ruc, proveedor_nombre, moneda, monto, tc, sustentado, foto_path, creado_por)
    values (v_tenant, r_id, coalesce(nullif(q->>'fecha', '')::date, current_date), coalesce(nullif(q->>'tipo_gasto', ''), 'otro'), nullif(q->>'descripcion', ''),
            coalesce(nullif(q->>'comprobante_tipo', ''), 'sin_comprobante'), nullif(q->>'comprobante_numero', ''), nullif(q->>'ruc', ''), nullif(q->>'proveedor_nombre', ''),
            coalesce(nullif(q->>'moneda', ''), 'PEN'), (q->>'monto')::numeric,
            case when coalesce(nullif(q->>'moneda', ''), 'PEN') = 'USD' then coalesce((q->>'tc')::numeric, tc_vigente(coalesce(nullif(q->>'fecha', '')::date, current_date))) else 1 end,
            coalesce((q->>'sustentado')::boolean, coalesce(nullif(q->>'comprobante_tipo', ''), 'sin_comprobante') <> 'sin_comprobante'), nullif(q->>'foto_path', ''), v_uid);
  end loop;
  select coalesce(sum(monto_soles), 0) into v_gast from viaje_rendicion_items where rendicion_id = r_id;
  update viaje_rendiciones set gastado = v_gast, entregado = pa.adelanto_entregado, saldo = v_gast - pa.adelanto_entregado where id = r_id;
  return jsonb_build_object('id', r_id, 'gastado', v_gast, 'entregado', pa.adelanto_entregado, 'saldo', v_gast - pa.adelanto_entregado);
end $$;
revoke all on function public.rendicion_guardar(jsonb) from public, anon;
grant execute on function public.rendicion_guardar(jsonb) to authenticated, service_role;

create or replace function public.rendicion_presentar(p_rendicion uuid, p_justificacion text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; pa record; v record; v_alim numeric; v_hosp numeric; v_excede boolean := false; v_tope_alim numeric; v_tope_hosp numeric; v_res text;
begin
  select * into r from viaje_rendiciones where id = p_rendicion and tenant_id = auth_tenant_id();
  if not found then raise exception 'Rendición no encontrada'; end if;
  select * into pa from viaje_pasajeros where id = r.pasajero_id;
  select * into v from viajes where id = r.viaje_id;
  if not (pa.user_id = auth.uid() or v.solicitado_por = auth.uid() or auth_tiene_permiso('viajes', 'editar')) then raise exception 'Solo el viajero (o Administración) puede presentar la rendición'; end if;
  if r.estado not in ('borrador', 'observada') then raise exception 'La rendición ya está %', r.estado; end if;
  if not exists (select 1 from viaje_rendicion_items where rendicion_id = r.id) and pa.adelanto_entregado = 0 then raise exception 'La rendición no tiene gastos'; end if;

  -- topes de la política: alimentación por día y hospedaje por noche
  v_tope_alim := coalesce(viaje_tarifa(r.tenant_id, 'alimentacion', v.fecha_salida), 0) * pa.dias;
  v_tope_hosp := coalesce(viaje_tarifa(r.tenant_id, 'hospedaje', v.fecha_salida), 0);
  select coalesce(sum(monto_soles) filter (where tipo_gasto = 'alimentacion'), 0), coalesce(max(monto_soles) filter (where tipo_gasto = 'hospedaje'), 0)
    into v_alim, v_hosp from viaje_rendicion_items where rendicion_id = r.id;
  if (v_tope_alim > 0 and v_alim > v_tope_alim) or (v_tope_hosp > 0 and v_hosp > v_tope_hosp)
     or exists (select 1 from viaje_rendicion_items where rendicion_id = r.id and tipo_gasto in ('hospedaje','movilidad','peaje') and not sustentado) then
    v_excede := true;
  end if;
  if v_excede and coalesce(p_justificacion, r.justificacion, '') = '' then
    raise exception 'La rendición supera los topes de la política o tiene gastos sin sustento: escribe la justificación';
  end if;
  v_res := case when r.saldo > 0.005 then 'empresa_reembolsa' when r.saldo < -0.005 then 'trabajador_devuelve' else 'cuadra' end;
  update viaje_rendiciones set estado = 'presentada', presentada_en = now(), tope_excedido = v_excede, justificacion = coalesce(nullif(p_justificacion, ''), justificacion),
         resultado = v_res, observacion = null, actualizado_en = now() where id = r.id;
  update viajes set estado = 'rendido', actualizado_en = now() where id = v.id and estado in ('aprobado', 'en_curso');
  perform viaje_notificar(r.tenant_id, 'rendicion_presentada', 'Rendición ' || r.numero || ' por revisar', pa.nombre || ' · ' || v.numero || ' · S/ ' || to_char(r.gastado, 'FM999G999D00') ||
                          case when v_excede then ' · EXCEDE TOPES' else '' end, v.id);
  return jsonb_build_object('estado', 'presentada', 'resultado', v_res, 'saldo', r.saldo, 'tope_excedido', v_excede);
end $$;
revoke all on function public.rendicion_presentar(uuid, text) from public, anon;
grant execute on function public.rendicion_presentar(uuid, text) to authenticated, service_role;

-- Jefatura revisa y firma (p_ok) u observa (vuelve al viajero con el comentario).
create or replace function public.rendicion_revisar(p_rendicion uuid, p_ok boolean, p_comentario text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; v record;
begin
  if not auth_tiene_permiso('viajes', 'aprobar') then raise exception 'La revisión es de la jefatura (viajes.aprobar)'; end if;
  select * into r from viaje_rendiciones where id = p_rendicion and tenant_id = auth_tenant_id();
  if not found then raise exception 'Rendición no encontrada'; end if;
  if r.estado <> 'presentada' then raise exception 'La rendición está % y no admite revisión', r.estado; end if;
  select * into v from viajes where id = r.viaje_id;
  if p_ok then
    update viaje_rendiciones set estado = 'revisada_jefatura', revisada_por = auth.uid(), revisada_en = now(), comentario_jefatura = nullif(p_comentario, ''), actualizado_en = now() where id = r.id;
    perform viaje_notificar(r.tenant_id, 'rendicion_jefatura_ok', 'Rendición ' || r.numero || ' revisada por jefatura', 'Falta la aprobación de Administración', v.id);
    return jsonb_build_object('estado', 'revisada_jefatura');
  else
    if coalesce(p_comentario, '') = '' then raise exception 'Escribe qué hay que corregir'; end if;
    update viaje_rendiciones set estado = 'observada', revisada_por = auth.uid(), revisada_en = now(), observacion = p_comentario, actualizado_en = now() where id = r.id;
    perform viaje_notificar(r.tenant_id, 'rendicion_observada', 'Rendición ' || r.numero || ' observada', p_comentario, v.id);
    return jsonb_build_object('estado', 'observada');
  end if;
end $$;
revoke all on function public.rendicion_revisar(uuid, boolean, text) from public, anon;
grant execute on function public.rendicion_revisar(uuid, boolean, text) to authenticated, service_role;

create or replace function public.viaje_cerrar_si_corresponde(p_viaje uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- cerrado cuando todos los viajeros con viáticos tienen su rendición liquidada
  if not exists (select 1 from viaje_pasajeros pa where pa.viaje_id = p_viaje
                   and not exists (select 1 from viaje_rendiciones r where r.pasajero_id = pa.id and r.estado = 'liquidada')) then
    update viajes set estado = 'cerrado', cerrado_en = now(), cerrado_por = auth.uid(), actualizado_en = now() where id = p_viaje and estado <> 'cerrado';
  end if;
end $$;
revoke all on function public.viaje_cerrar_si_corresponde(uuid) from public, anon;
grant execute on function public.viaje_cerrar_si_corresponde(uuid) to authenticated, service_role;

-- Carolina aprueba (p_ok) u observa. Al aprobar queda fijado el resultado: empresa reembolsa / trabajador devuelve / cuadra.
create or replace function public.rendicion_aprobar(p_rendicion uuid, p_ok boolean, p_comentario text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; v record; pa record;
begin
  if not auth_tiene_permiso('viajes', 'aprobar_final') then raise exception 'La aprobación final es de Administración (viajes.aprobar_final)'; end if;
  select * into r from viaje_rendiciones where id = p_rendicion and tenant_id = auth_tenant_id();
  if not found then raise exception 'Rendición no encontrada'; end if;
  if r.estado not in ('revisada_jefatura', 'presentada') then raise exception 'La rendición está % y no admite aprobación final', r.estado; end if;
  if r.estado = 'presentada' and not auth_tiene_permiso('viajes', 'aprobar') then raise exception 'Primero debe revisarla la jefatura'; end if;
  select * into v from viajes where id = r.viaje_id;
  select * into pa from viaje_pasajeros where id = r.pasajero_id;
  if p_ok then
    update viaje_rendiciones set estado = case when r.resultado = 'cuadra' then 'liquidada' else 'aprobada' end, aprobada_por = auth.uid(), aprobada_en = now(),
           comentario_aprobacion = nullif(p_comentario, ''), liquidada_en = case when r.resultado = 'cuadra' then now() end, actualizado_en = now() where id = r.id;
    perform viaje_notificar(r.tenant_id, 'rendicion_aprobada', 'Rendición ' || r.numero || ' aprobada',
                            case r.resultado when 'empresa_reembolsa' then 'Reembolsar S/ ' || to_char(r.saldo, 'FM999G999D00') || ' a ' || pa.nombre
                                             when 'trabajador_devuelve' then pa.nombre || ' devuelve S/ ' || to_char(-r.saldo, 'FM999G999D00') else 'Cuadra con el adelanto' end, v.id);
    perform viaje_cerrar_si_corresponde(v.id);
    return jsonb_build_object('estado', case when r.resultado = 'cuadra' then 'liquidada' else 'aprobada' end, 'resultado', r.resultado, 'saldo', r.saldo);
  else
    if coalesce(p_comentario, '') = '' then raise exception 'Escribe qué hay que corregir'; end if;
    update viaje_rendiciones set estado = 'observada', aprobada_por = auth.uid(), aprobada_en = now(), observacion = p_comentario, actualizado_en = now() where id = r.id;
    perform viaje_notificar(r.tenant_id, 'rendicion_observada', 'Rendición ' || r.numero || ' observada por Administración', p_comentario, v.id);
    return jsonb_build_object('estado', 'observada');
  end if;
end $$;
revoke all on function public.rendicion_aprobar(uuid, boolean, text) from public, anon;
grant execute on function public.rendicion_aprobar(uuid, boolean, text) to authenticated, service_role;

-- Administración registra el reembolso pagado o la devolución recibida → liquidada; cierra el viaje si todos rindieron.
create or replace function public.rendicion_liquidar(p_rendicion uuid, p_medio text, p_referencia text default null, p_fecha date default current_date) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not auth_tiene_permiso('viajes', 'editar') then raise exception 'Sin permiso (viajes.editar)'; end if;
  select * into r from viaje_rendiciones where id = p_rendicion and tenant_id = auth_tenant_id();
  if not found then raise exception 'Rendición no encontrada'; end if;
  if r.estado <> 'aprobada' then raise exception 'La rendición debe estar aprobada (está %)', r.estado; end if;
  update viaje_rendiciones set estado = 'liquidada', liquidada_en = p_fecha::timestamptz, liquidacion_medio = p_medio, liquidacion_referencia = nullif(p_referencia, ''), liquidada_por = auth.uid(), actualizado_en = now() where id = r.id;
  perform viaje_cerrar_si_corresponde(r.viaje_id);
end $$;
revoke all on function public.rendicion_liquidar(uuid, text, text, date) from public, anon;
grant execute on function public.rendicion_liquidar(uuid, text, text, date) to authenticated, service_role;


-- Cierre manual por Administración (viajes sin viáticos, o históricos).
create or replace function public.viaje_cerrar(p_viaje uuid, p_notas text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not auth_tiene_permiso('viajes', 'editar') then raise exception 'Sin permiso (viajes.editar)'; end if;
  update viajes set estado = 'cerrado', cerrado_en = now(), cerrado_por = auth.uid(), observaciones = concat_ws(' · ', observaciones, nullif(p_notas, '')), actualizado_en = now()
   where id = p_viaje and tenant_id = auth_tenant_id() and estado in ('aprobado', 'en_curso', 'rendido');
  if not found then raise exception 'El viaje no está en un estado que se pueda cerrar'; end if;
end $$;
revoke all on function public.viaje_cerrar(uuid, text) from public, anon;
grant execute on function public.viaje_cerrar(uuid, text) to authenticated, service_role;

-- ── Vistas ──────────────────────────────────────────────────────────────────
create or replace view public.v_viajes with (security_invoker = true) as
select v.*, p.codigo as proyecto_codigo, p.nombre as proyecto_nombre, cc.codigo as cdc,
       us.nombre as solicitante, uj.nombre as jefatura_nombre, ua.nombre as aprobador_nombre,
       (select count(*) from viaje_pasajeros x where x.viaje_id = v.id) as viajeros,
       (select string_agg(x.nombre, ', ' order by x.creado_en) from viaje_pasajeros x where x.viaje_id = v.id) as viajeros_nombres,
       (select coalesce(sum(x.adelanto_entregado), 0) from viaje_pasajeros x where x.viaje_id = v.id) as adelantos,
       (select coalesce(sum(r.costo_soles), 0) from viaje_reservas r where r.viaje_id = v.id) as reservas_soles,
       (select coalesce(sum(r.costo_soles), 0) from viaje_reservas r where r.viaje_id = v.id and r.estado_pago = 'pagado') as reservas_pagadas_soles,
       (select coalesce(sum(r.gastado), 0) from viaje_rendiciones r where r.viaje_id = v.id and r.estado in ('presentada','revisada_jefatura','aprobada','liquidada')) as rendido,
       (select coalesce(sum(r.saldo), 0) from viaje_rendiciones r where r.viaje_id = v.id and r.estado in ('aprobada','liquidada')) as saldo_rendiciones,
       (select count(*) from viaje_rendiciones r where r.viaje_id = v.id and r.estado in ('presentada','revisada_jefatura')) as rendiciones_por_revisar,
       (select count(*) from viaje_rendiciones r where r.viaje_id = v.id and r.estado = 'aprobada') as rendiciones_por_liquidar
  from viajes v
  left join proyectos p on p.id = v.proyecto_id
  left join centros_costo cc on cc.id = v.centro_costo_id
  left join usuarios_tenant us on us.user_id = v.solicitado_por and us.tenant_id = v.tenant_id
  left join usuarios_tenant uj on uj.user_id = v.aprobado_jefatura_por and uj.tenant_id = v.tenant_id
  left join usuarios_tenant ua on ua.user_id = v.aprobado_por and ua.tenant_id = v.tenant_id;

create or replace view public.v_viaje_rendiciones with (security_invoker = true) as
select r.*, pa.nombre as viajero, pa.user_id as viajero_user_id, pa.viatico_aprobado, pa.adelanto_entregado,
       v.numero as viaje_numero, v.destino, v.fecha_salida, v.fecha_retorno, v.proyecto_id, p.codigo as proyecto_codigo, v.estado as viaje_estado,
       (select count(*) from viaje_rendicion_items i where i.rendicion_id = r.id) as items,
       (select count(*) from viaje_rendicion_items i where i.rendicion_id = r.id and not i.sustentado) as items_sin_sustento
  from viaje_rendiciones r
  join viaje_pasajeros pa on pa.id = r.pasajero_id
  join viajes v on v.id = r.viaje_id
  left join proyectos p on p.id = v.proyecto_id;

-- Costo de viajes por proyecto para el Proyecto 360: pasajes/hospedaje pagados por la empresa + rendiciones aprobadas
-- (lo gastado de verdad; los adelantos no se suman aparte porque la rendición los absorbe).
create or replace view public.v_gasto_viajes_proyecto with (security_invoker = true) as
select v.tenant_id, v.proyecto_id,
       count(distinct v.id) as viajes,
       coalesce(sum(res.pagado), 0) as pasajes_soles,
       coalesce(sum(ren.rendido), 0) as rendido_soles,
       coalesce(sum(res.pagado), 0) + coalesce(sum(ren.rendido), 0) as total_soles,
       coalesce(sum(adel.adelantos), 0) as adelantos_soles,
       count(distinct v.id) filter (where v.estado in ('solicitado','aprobado_jefatura','aprobado','en_curso','rendido')) as viajes_abiertos
  from viajes v
  left join lateral (select coalesce(sum(costo_soles), 0) as pagado from viaje_reservas r where r.viaje_id = v.id and r.estado_pago = 'pagado') res on true
  left join lateral (select coalesce(sum(gastado), 0) as rendido from viaje_rendiciones r where r.viaje_id = v.id and r.estado in ('aprobada','liquidada')) ren on true
  left join lateral (select coalesce(sum(adelanto_entregado), 0) as adelantos from viaje_pasajeros x where x.viaje_id = v.id) adel on true
 where v.estado not in ('rechazado', 'anulado') and v.proyecto_id is not null
 group by v.tenant_id, v.proyecto_id;

grant select on public.v_viajes, public.v_viaje_rendiciones, public.v_gasto_viajes_proyecto to authenticated, service_role;
revoke all on public.v_viajes, public.v_viaje_rendiciones, public.v_gasto_viajes_proyecto from anon;

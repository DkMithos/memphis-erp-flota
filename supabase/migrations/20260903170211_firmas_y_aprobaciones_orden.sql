-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260903170211  name: firmas_y_aprobaciones_orden

-- Firmas y trazabilidad de aprobación de órdenes.
--
-- Tres piezas:
--   firmas_usuario           la firma que cada persona registra, una sola vez.
--   orden_aprobaciones       cada aprobación que realmente ocurrió, con una COPIA
--                            de la firma en ese momento.
--   orden_solicitudes_edicion  el comprador pide editar una orden ya aprobada y
--                            el aprobador siguiente autoriza o rechaza.
--
-- Por qué la copia de la firma en cada aprobación y no una referencia: si alguien
-- cambia su firma más adelante, los documentos ya aprobados no deben cambiar.
-- Un documento financiero tiene que seguir mostrando lo que se firmó ese día.

create table if not exists firmas_usuario (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  -- PNG con fondo transparente, como data URI. Se guarda aquí y no en Storage
  -- porque son pocas, pequeñas, y así viajan con la fila sin una segunda llamada.
  imagen      text not null,
  nombre      text,
  actualizado_en timestamptz not null default now()
);

create table if not exists orden_aprobaciones (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  orden_id      uuid not null references ordenes_compra(id) on delete cascade,
  -- Etapa del flujo: comprador, operaciones, gerenciaOperaciones,
  -- gerenciaGeneral, finanzas. Se conservan los nombres del legado para que la
  -- migración no invente equivalencias.
  etapa         text not null,
  aprobado_por_email  text,
  aprobado_por_nombre text,
  aprobado_en   timestamptz,
  -- Copia de la firma tal como estaba al aprobar.
  firma         text,
  -- 'erp' si ocurrió aquí; 'oc-system' si viene del legado.
  origen        text not null default 'erp',
  creado_en     timestamptz not null default now(),
  unique (orden_id, etapa)
);

create table if not exists orden_solicitudes_edicion (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  orden_id      uuid not null references ordenes_compra(id) on delete cascade,
  solicitado_por  text not null,
  solicitado_en   timestamptz not null default now(),
  motivo        text not null,
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','aprobada','rechazada')),
  resuelto_por  text,
  resuelto_en   timestamptz,
  comentario_resolucion text,
  origen        text not null default 'erp',
  creado_en     timestamptz not null default now()
);

create index if not exists idx_orden_aprobaciones_orden on orden_aprobaciones(orden_id);
create index if not exists idx_orden_aprobaciones_tenant on orden_aprobaciones(tenant_id);
create index if not exists idx_solicitudes_edicion_orden on orden_solicitudes_edicion(orden_id);
create index if not exists idx_solicitudes_edicion_estado on orden_solicitudes_edicion(tenant_id, estado);

alter table firmas_usuario enable row level security;
alter table orden_aprobaciones enable row level security;
alter table orden_solicitudes_edicion enable row level security;

-- Cada persona ve y edita SOLO su propia firma. Nadie sube la firma de otro.
create policy firmas_usuario_propia on firmas_usuario
  for all using (user_id = auth.uid()) with check (user_id = auth.uid() and tenant_id = auth_tenant_id());

-- Las firmas ya estampadas en una aprobación sí son visibles para el tenant:
-- son parte del documento.
create policy orden_aprobaciones_tenant on orden_aprobaciones
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());

create policy solicitudes_edicion_tenant on orden_solicitudes_edicion
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());

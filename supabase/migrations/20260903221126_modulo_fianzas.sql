-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260903221126  name: modulo_fianzas

-- Módulo de Fianzas.
--
-- Dos tablas, pero conservando TODAS las columnas del Excel de Shirley: ella
-- pidió que su trabajo se mantenga tal cual, así que ningún dato de la hoja se
-- queda fuera. Si al verlo prefiere otra forma, se cambia el modelo.
--
--   fianzas        el contrato afianzado (una fila por contrato/entidad)
--   fianza_cartas  cada carta de la cadena: la original -000 y sus renovaciones
--   fianza_cargos  los PDF que hoy viven en "Cargos Fianzas/<ENTIDAD>/"
--
-- `fin` y `fecha_renovacion` son columnas calculadas, con las mismas fórmulas
-- del Excel (FIN = INICIO + PLAZO - 1, RENOVACIÓN = FIN - 5). Así no se pueden
-- teclear mal: en la hoja hay una carta cuyo fin es anterior a su inicio.

create table if not exists fianzas (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  concurso      text,                 -- CONSURSO Y/O CONTRATO
  nombre_proyecto text not null,      -- NOMBRE DEL PROYECTO
  proyecto_id   uuid references proyectos(id) on delete set null,
  consorcio     text,                 -- EMPRESAS Y/O CONSORCIO
  entidad       text not null,        -- ENTIDAD
  monto_contrato numeric(16,2),       -- MONTO CONTRATO
  porcentaje    numeric(6,4),         -- PORCENTAJE (0.04 = 4%)
  notas         text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (tenant_id, nombre_proyecto, entidad)
);

create table if not exists fianza_cartas (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  fianza_id     uuid not null references fianzas(id) on delete cascade,
  numero        text not null,        -- N° CARTA FIANZA
  aseguradora   text,                 -- PROVEEDOR (CESCE, AVLA)
  tipo          text default 'FIEL CUMPLIMIENTO',
  inicio        date not null,        -- INICIO
  plazo_dias    integer not null,     -- PLAZO
  -- FIN = INICIO + PLAZO - 1, igual que en el Excel
  fin           date generated always as (inicio + (plazo_dias - 1)) stored,
  -- RENOVACIÓN = FIN - 5
  fecha_renovacion date generated always as (inicio + (plazo_dias - 6)) stored,
  monto_afianzado numeric(16,2),      -- MONTO AFIANZADO
  costo_renovacion numeric(16,2),     -- COSTO DE RENOVACION
  encaje        numeric(16,2),        -- ENCAJE
  estado        text not null default 'vigente'
                check (estado in ('vigente','renovada','devuelta')),
  notas         text,
  migrado_de    text,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists fianza_cargos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  fianza_id     uuid not null references fianzas(id) on delete cascade,
  carta_id      uuid references fianza_cartas(id) on delete set null,
  nombre        text not null,
  storage_path  text,
  sharepoint_url text,
  subido_por    text,
  subido_en     timestamptz not null default now()
);

create index if not exists idx_fianza_cartas_fianza on fianza_cartas(fianza_id);
create index if not exists idx_fianza_cartas_renov on fianza_cartas(tenant_id, estado, fecha_renovacion);
create index if not exists idx_fianzas_tenant on fianzas(tenant_id);
create index if not exists idx_fianza_cargos_fianza on fianza_cargos(fianza_id);
create index if not exists idx_fianzas_proyecto on fianzas(proyecto_id);

alter table fianzas enable row level security;
alter table fianza_cartas enable row level security;
alter table fianza_cargos enable row level security;

create policy fianzas_tenant on fianzas
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy fianza_cartas_tenant on fianza_cartas
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());
create policy fianza_cargos_tenant on fianza_cargos
  for all using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());

-- Permisos del módulo. `fianzas.cargos` es el que se le da a Lisbet Monteza
-- SIN darle `fianzas.ver`: entra a los cargos y no ve montos ni el tablero.
-- Mismo patrón que `compras.recepcionar` para que Flota use Recepciones sin
-- ver el resto de Compras.
insert into permisos (modulo, accion, descripcion)
select v.modulo, v.accion, v.descripcion
from (values
  ('fianzas','ver','Ver fianzas y cartas fianza'),
  ('fianzas','crear','Registrar fianzas y cartas'),
  ('fianzas','editar','Modificar fianzas y cartas'),
  ('fianzas','eliminar','Anular o dar de baja una fianza'),
  ('fianzas','exportar','Exportar y actualizar el Excel de fianzas'),
  ('fianzas','cargos','Ver y subir los cargos de fianzas')
) as v(modulo, accion, descripcion)
where not exists (
  select 1 from permisos p where p.modulo = v.modulo and p.accion = v.accion
);

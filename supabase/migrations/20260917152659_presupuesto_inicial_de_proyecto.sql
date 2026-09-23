-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260917152659  name: presupuesto_inicial_de_proyecto

-- PRESUPUESTO INICIAL DE PROYECTO.
--
-- El presupuesto de un proyecto OXI es el árbol de partidas que Antonio costea
-- en Excel (equipos, vehículos, gastos administrativos), con su cantidad,
-- precio y proveedor. NO es el presupuesto operativo por categorías de Finanzas
-- (tablas `presupuestos`/`presupuesto_lineas`): eso es otra cosa y no se toca.
--
-- El valor está en comparar lo PRESUPUESTADO con lo que de verdad se lleva
-- COMPROMETIDO en órdenes —que ya cuadra al céntimo tras la revisión de
-- Operaciones— y ver el margen contra el importe del convenio. Amazonas no se
-- torció de un día para otro: se fue torciendo compra a compra, y con el
-- presupuesto cargado eso se ve al generar la orden, no seis meses después.
--
-- Decisiones de Antonio (16/09/2026) que fijan el cálculo:
--   · el cuadro resumen del Excel NO es referencia (además está roto);
--   · la base del margen es el importe del convenio;
--   · la ganancia por integración es un costo no realizado: no se emplea;
--   · el tipo de cambio es una celda fija, referencia presupuestal.

create table if not exists proyecto_presupuestos (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  proyecto_id    uuid not null references proyectos(id) on delete cascade,
  nombre         text not null,
  cui            text,
  -- Importes de la cabecera del Excel (referencia; el importe que manda para el
  -- margen es el convenio, que vive en `proyectos.monto_contrato`).
  importe_ejecucion   numeric(16,2),
  importe_referencial numeric(16,2),
  tipo_cambio    numeric(10,4) not null default 3.4,
  plazo_dias     int,
  moneda_base    text not null default 'PEN',
  fuente         text not null default 'plantilla-excel',
  estado         text not null default 'vigente' check (estado in ('borrador','vigente','cerrado')),
  creado_por     uuid,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (tenant_id, proyecto_id)
);

comment on table proyecto_presupuestos is
  'Presupuesto inicial de un proyecto (plantilla de Antonio). Uno por proyecto; se reemplaza al reimportar.';

create table if not exists proyecto_presupuesto_lineas (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  presupuesto_id uuid not null references proyecto_presupuestos(id) on delete cascade,
  item           text not null,          -- '2.1.4.2' — su posición en el árbol
  nivel          int  not null,          -- profundidad (segmentos del item)
  es_hoja        boolean not null default false,  -- línea de gasto real (con precio)
  descripcion    text,
  unidad         text,
  cantidad       numeric(16,4),
  precio_unitario numeric(16,4),
  moneda         text,
  precio_unitario_soles numeric(16,4),
  total_sin_igv  numeric(16,2),
  igv_tasa       numeric(5,4),           -- 0.18 o 0
  total_con_igv  numeric(16,2),
  proveedor_nota text,
  orden          int not null default 0, -- posición en el Excel, para pintarlo igual
  creado_en      timestamptz not null default now()
);

comment on column proyecto_presupuesto_lineas.es_hoja is
  'true = línea con precio (gasto real). Los totales de una partida se suman de sus hojas; las cabeceras no se suman para no duplicar.';

create index if not exists idx_ppl_presupuesto on proyecto_presupuesto_lineas(presupuesto_id, orden);

alter table proyecto_presupuestos       enable row level security;
alter table proyecto_presupuesto_lineas enable row level security;

drop policy if exists pp_tenant  on proyecto_presupuestos;
drop policy if exists ppl_tenant on proyecto_presupuesto_lineas;
create policy pp_tenant  on proyecto_presupuestos
  for select using (tenant_id = auth_tenant_id());
create policy ppl_tenant on proyecto_presupuesto_lineas
  for select using (tenant_id = auth_tenant_id());

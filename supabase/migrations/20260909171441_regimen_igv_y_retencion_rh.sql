-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260909171441  name: regimen_igv_y_retencion_rh

-- El ERP cobraba 18% de IGV SIEMPRE, sin excepción posible. En el histórico ya
-- hay 58 órdenes sin IGV (S/ 229,793.61): servicios del exterior (Anthropic,
-- Vercel, Google…) y recibos por honorarios de personas naturales. Richard no
-- podía emitir ninguna de esas desde el ERP.
--
-- El régimen es una propiedad del PROVEEDOR —de dónde factura y bajo qué
-- condición— y la compra lo hereda. Se puede ajustar por orden porque un mismo
-- proveedor puede vender algo gravado y algo exonerado.

alter table proveedores
  add column if not exists regimen_igv text not null default 'gravado';

alter table proveedores drop constraint if exists proveedores_regimen_igv_check;
alter table proveedores add constraint proveedores_regimen_igv_check
  check (regimen_igv in ('gravado', 'exonerado_amazonia', 'no_domiciliado', 'inafecto'));

comment on column proveedores.regimen_igv is
  'gravado = 18% · exonerado_amazonia = Ley 27037 · no_domiciliado = servicio del exterior · inafecto';

-- Los 6 no domiciliados ya marcados heredan su régimen: no se pregunta dos
-- veces lo mismo.
update proveedores set regimen_igv = 'no_domiciliado'
 where domiciliado is false and regimen_igv = 'gravado';

-- Retención de renta de 4ta categoría (recibos por honorarios).
-- La SUSPENSIÓN la concede SUNAT a la persona por un periodo y VENCE, así que
-- se guarda hasta cuándo vale: el riesgo real es que alguien la marque una vez
-- y siga marcada tres años después.
alter table proveedores
  add column if not exists suspension_retencion_rh    boolean not null default false,
  add column if not exists suspension_retencion_hasta date;

comment on column proveedores.suspension_retencion_hasta is
  'Vigencia de la constancia de suspensión. Vencida, la retención vuelve a aplicar.';

-- La compra guarda el régimen con el que se emitió, no el que el proveedor
-- tenga hoy: una orden de hace un año no puede cambiar porque el proveedor
-- cambie de régimen ahora.
alter table cotizaciones
  add column if not exists regimen_igv text not null default 'gravado';
alter table ordenes_compra
  add column if not exists regimen_igv text not null default 'gravado',
  add column if not exists aplica_retencion_rh boolean not null default false;

alter table cotizaciones drop constraint if exists cotizaciones_regimen_igv_check;
alter table cotizaciones add constraint cotizaciones_regimen_igv_check
  check (regimen_igv in ('gravado', 'exonerado_amazonia', 'no_domiciliado', 'inafecto'));
alter table ordenes_compra drop constraint if exists ordenes_compra_regimen_igv_check;
alter table ordenes_compra add constraint ordenes_compra_regimen_igv_check
  check (regimen_igv in ('gravado', 'exonerado_amazonia', 'no_domiciliado', 'inafecto'));

-- Sincerar el histórico: las órdenes que se emitieron sin IGV no eran gravadas.
-- Se marcan por lo que dice el proveedor, no adivinando.
update ordenes_compra o
   set regimen_igv = 'no_domiciliado'
  from proveedores p
 where p.id = o.proveedor_id and o.igv = 0 and p.domiciliado is false;

update ordenes_compra o
   set regimen_igv = 'inafecto'
  from proveedores p
 where p.id = o.proveedor_id and o.igv = 0 and coalesce(p.domiciliado, true)
   and p.ruc ~ '^(10|15)';

-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260910160823  name: proveedores_observaciones_y_contacto

-- EL ALTA DE PROVEEDOR GUARDABA MENOS DE LO QUE PEDÍA
--
-- 1. `observaciones` se enviaba en el INSERT y no existía: PostgREST respondía
--    400 y no se podía crear ningún proveedor. Richard se topó con esto al dar
--    de alta a un proveedor para una orden.
--
-- 2. El "Contacto Principal" del formulario (nombre, cargo, email, teléfono) es
--    obligatorio en pantalla y no se guardaba en ninguna parte — el propio
--    código lo decía: "no almacenado en DB todavía". Ya existía `contacto` con
--    el nombre de 114 proveedores migrados; se le suman las tres que faltaban
--    en vez de inventar una estructura nueva al lado.

alter table proveedores
  add column if not exists observaciones      text,
  add column if not exists contacto_cargo     text,
  add column if not exists contacto_email     text,
  add column if not exists contacto_telefono  text;

comment on column proveedores.contacto is
  'Nombre del contacto principal. Las tres columnas contacto_* lo completan.';
comment on column proveedores.cuentas_bancarias is
  'Cuentas del proveedor: [{nombre, cuenta, cci, moneda, tipoCuenta}]. '
  'Es la fuente buena — 114 proveedores la tienen. Las columnas planas '
  'banco/cuenta_bancaria/cci son del legado y solo cubren 6.';

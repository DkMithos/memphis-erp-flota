-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260916144048  name: requerimiento_guarda_proyecto_y_centro_costo

-- EL REQUERIMIENTO PERDÍA SU PROYECTO.
--
-- El formulario pide "Proyecto" y "Centro de Costo", y la tabla no tenía dónde
-- guardarlos: `centro_costo` es texto libre con el CÓDIGO, y de proyecto no
-- había ni columna. El store leía `row.proyecto_id` y `row.centro_costo_id`,
-- que no existían, así que siempre valían null. Todo lo que Compras elegía en
-- ese campo se tiraba en silencio — por eso al cruzar requerimientos contra
-- proyectos no cuadraba nada.
--
-- Se añaden las dos columnas y se rellenan con lo que ya se puede deducir del
-- código de texto. `centro_costo` (texto) NO se toca: es el registro de lo que
-- se escribió en su día y sirve de respaldo.

alter table requerimientos_compra
  add column if not exists centro_costo_id uuid references centros_costo(id),
  add column if not exists proyecto_id     uuid references proyectos(id);

create index if not exists idx_requerimientos_centro_costo on requerimientos_compra(centro_costo_id);
create index if not exists idx_requerimientos_proyecto      on requerimientos_compra(proyecto_id);

-- Relleno: el código de texto identifica el centro de costo.
update requerimientos_compra r
   set centro_costo_id = cc.id
  from centros_costo cc
 where cc.codigo = r.centro_costo
   and cc.tenant_id = r.tenant_id
   and r.centro_costo_id is null;

-- Y el centro de costo, cuando cuelga de un proyecto, da el proyecto.
update requerimientos_compra r
   set proyecto_id = cc.proyecto_id
  from centros_costo cc
 where cc.id = r.centro_costo_id
   and cc.proyecto_id is not null
   and r.proyecto_id is null;

comment on column requerimientos_compra.centro_costo_id is
  'Centro de costo imputado. `centro_costo` (texto) conserva el código tal como se escribió.';
comment on column requerimientos_compra.proyecto_id is
  'Proyecto al que se imputa. Se hereda del centro de costo cuando este cuelga de uno.';

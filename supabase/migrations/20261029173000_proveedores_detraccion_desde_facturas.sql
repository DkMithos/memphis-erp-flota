-- 2026-10-29 · Proveedores sujetos a detracción, deducido de sus propias facturas (pendiente del sprint 0 de lotes de pago).
-- Al construir los lotes (oct-2026) ningún proveedor tenía la marca y Contabilidad corregía cada línea. Con el SIRE 2024-2026
-- cargado ya hay evidencia: 91 proveedores tienen facturas recibidas con detracción, 37 de ellos sin la marca; y los 54 marcados
-- no tenían tasa. Regla: (1) factura con detracción → el proveedor es sujeto; (2) la tasa se fija SOLO cuando sus facturas la
-- muestran de forma consistente (una o dos tasas distintas y la moda es 4, 10 o 12 %); si varía (p. ej. Peruana de Motores,
-- 17 tasas distintas porque mezcla bienes y servicios) se deja en blanco y Contabilidad la fija por línea, como hasta hoy.
-- La marca es una alerta en el lote (no bloquea); Contabilidad sigue pudiendo corregir cada línea.
with evidencia as (
  select c.proveedor_id,
         count(*) as facturas,
         mode() within group (order by round(c.detraccion_monto / nullif(c.total, 0) * 100)) as tasa_moda,
         count(distinct round(c.detraccion_monto / nullif(c.total, 0) * 100)) as tasas_distintas
    from comprobantes_pago c
   where c.direccion = 'recibido' and c.tiene_detraccion and coalesce(c.detraccion_monto, 0) > 0 and coalesce(c.total, 0) > 0
     and c.proveedor_id is not null
   group by c.proveedor_id
)
update proveedores p
   set sujeto_detraccion = true,
       tasa_detraccion = coalesce(p.tasa_detraccion,
                                  case when e.tasas_distintas <= 2 and e.tasa_moda in (4, 10, 12) then e.tasa_moda end),
       modificado_en = now()
  from evidencia e
 where e.proveedor_id = p.id
   and (not p.sujeto_detraccion or p.tasa_detraccion is null);

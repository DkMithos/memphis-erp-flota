-- El formato PRO-FOR-004 trae dos bloques por partida: PLANIFICADO (presupuesto
-- inicial) y FINAL (precio y proveedor negociados). El plan es lo que se compara
-- con el gasto; el final se conserva porque es lo que Operaciones espera pagar.
alter table public.proyecto_presupuesto_lineas
  add column if not exists forma_pago            text,
  add column if not exists moneda_final          text,
  add column if not exists precio_unitario_final numeric,
  add column if not exists total_final           numeric,
  add column if not exists proveedor_final       text,
  add column if not exists forma_pago_final      text,
  add column if not exists fila_excel            int;
alter table public.proyecto_presupuestos
  add column if not exists tipo_cambio_final numeric,
  add column if not exists archivo_origen    text,
  add column if not exists formato           text;
comment on column public.proyecto_presupuestos.formato is 'plantilla-v1 (columnas sin/con IGV) | pro-for-004 (bloques planificado/final, precios con IGV, moneda en la fórmula)';

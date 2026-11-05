-- 2026-11-05 · Una nota de crédito puede llevar la misma serie-número que una factura del mismo emisor (PREMIUM REALTY:
-- factura E001-1 y NC E001-1). La unicidad correcta ya existe con tipo (comprobantes_pago_unico_por_emisor:
-- tenant + RUC + tipo + serie + número); el índice viejo sin tipo lo impedía y se elimina.
drop index if exists public.uq_comprobante_emisor_serie_num;

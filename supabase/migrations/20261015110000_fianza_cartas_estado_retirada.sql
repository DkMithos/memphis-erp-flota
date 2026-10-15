-- 2026-10-15 · El importador de fianzas nunca retiraba del ERP las cartas que desaparecían del Excel ("nada se borra"): cuando
-- Shirley corrigió el número de dos cartas, el ERP se quedó con la versión vieja Y la nueva, las dos "vigentes", y el tablero
-- sumaba S/ 1.5 M de más. Nuevo estado `retirada`: una carta que vino del Excel y ya no figura en él deja de contar como
-- vigente (no se borra: queda con la nota de cuándo dejó de estar). Las cartas sin origen pasan a tener el archivo como origen.
alter table public.fianza_cartas drop constraint if exists fianza_cartas_estado_check;
alter table public.fianza_cartas add constraint fianza_cartas_estado_check check (estado = any (array['vigente'::text, 'renovada'::text, 'devuelta'::text, 'retirada'::text]));
update public.fianza_cartas set migrado_de = 'STATUS DE FIANZAS ACTUALIZADO 2026.xlsx' where migrado_de is null and tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13';

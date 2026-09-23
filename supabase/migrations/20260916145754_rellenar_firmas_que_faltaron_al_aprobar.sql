-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260916145754  name: rellenar_firmas_que_faltaron_al_aprobar

-- FIRMAS QUE NUNCA SE CAPTURARON.
--
-- La firma se copia en el momento de aprobar: se lee `firmas_usuario` y se
-- guarda la imagen junto a la aprobación. Eso está bien —si alguien cambia su
-- rúbrica, la orden vieja debe seguir enseñando la que se firmó ese día— pero
-- tiene un agujero: quien aprobaba ANTES de registrar su firma dejaba la
-- aprobación sin imagen, y ya no había manera de arreglarlo desde el sistema.
--
-- Es lo que les pasó a Richard y Miguelangel: firmaron órdenes y subieron su
-- rúbrica después (13 y 14 de septiembre). Son 11 aprobaciones sin imagen, de
-- ellos dos, ambos con firma registrada hoy.
--
-- Esto no reescribe ninguna firma: solo rellena las que están en blanco.

update orden_aprobaciones a
   set firma = f.imagen
  from firmas_usuario f
  join profiles p on p.id = f.user_id
 where a.firma is null
   and lower(p.email) = lower(a.aprobado_por_email)
   and f.imagen is not null;

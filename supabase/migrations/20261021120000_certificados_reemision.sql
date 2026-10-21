-- 2026-10-21 · Reemisión de certificados: un participante puede tener certificados revocados (se conservan y su QR
-- sigue diciendo "revocado") y como máximo UNO vigente. Antes participante_id era unique y "reemitir" borraba el revocado.
do $$ declare r record; begin
  for r in select conname from pg_constraint
            where conrelid = 'public.certificados'::regclass and contype = 'u'
              and (select array_agg(attname::text) from pg_attribute where attrelid = conrelid and attnum = any(conkey)) = array['participante_id'] loop
    execute format('alter table public.certificados drop constraint %I', r.conname);
  end loop;
end $$;
create unique index if not exists certificados_participante_vigente_uniq
  on public.certificados(participante_id) where estado = 'emitido';
create index if not exists certificados_participante_idx on public.certificados(participante_id);
comment on index public.certificados_participante_vigente_uniq is 'Un solo certificado vigente por participante; los revocados se conservan para la verificación por QR.';

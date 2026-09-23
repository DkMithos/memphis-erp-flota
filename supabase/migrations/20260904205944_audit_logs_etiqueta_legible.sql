-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260904205944  name: audit_logs_etiqueta_legible

-- La etiqueta caía al UUID en las tablas que no usan `numero`/`codigo`/`nombre`
-- (fianzas usa `nombre_proyecto`, las cartas `numero`, los gastos `descripcion`).
-- Un registro de auditoría que dice "e0551dee-367b-…" no le sirve a nadie.

create or replace function fn_auditar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant   uuid;
  v_email    text;
  v_fila     jsonb;
  v_id       text;
  v_label    text;
  v_detalle  jsonb;
  v_antes    jsonb;
  v_despues  jsonb;
  k          text;
begin
  v_fila := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;

  v_tenant := coalesce(v_fila->>'tenant_id', '00000000-0000-0000-0000-000000000000')::uuid;

  -- El correo sale del JWT. Si viene de una Edge Function con la service key no
  -- hay JWT: queda como 'sistema', que es la verdad.
  v_email := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    'sistema'
  );

  v_id := v_fila->>'id';

  -- Primera columna legible que exista, en orden de utilidad.
  v_label := coalesce(
    v_fila->>'numero', v_fila->>'codigo', v_fila->>'nombre_proyecto',
    v_fila->>'nombre', v_fila->>'numero_completo', v_fila->>'descripcion',
    v_fila->>'email', v_id
  );
  if length(v_label) > 120 then
    v_label := left(v_label, 117) || '…';
  end if;

  if TG_OP = 'UPDATE' then
    v_antes := '{}'::jsonb;
    v_despues := '{}'::jsonb;
    for k in select jsonb_object_keys(to_jsonb(NEW)) loop
      if to_jsonb(OLD)->k is distinct from to_jsonb(NEW)->k
         and k not in ('modificado_en', 'actualizado_en', 'creado_en') then
        v_antes   := v_antes   || jsonb_build_object(k, to_jsonb(OLD)->k);
        v_despues := v_despues || jsonb_build_object(k, to_jsonb(NEW)->k);
      end if;
    end loop;
    if v_antes = '{}'::jsonb then
      return NEW;
    end if;
    v_detalle := jsonb_build_object('antes', v_antes, 'despues', v_despues);
  elsif TG_OP = 'DELETE' then
    v_detalle := jsonb_build_object('antes', to_jsonb(OLD));
  else
    v_detalle := jsonb_build_object('despues', to_jsonb(NEW));
  end if;

  insert into audit_logs (tenant_id, usuario_email, accion, entidad_tipo, entidad_id, entidad_label, detalle)
  values (v_tenant, v_email, v_accion_placeholder(), TG_TABLE_NAME, v_id, v_label, v_detalle);

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

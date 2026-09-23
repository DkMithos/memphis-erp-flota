-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260909174652  name: auditoria_no_bloquea_tablas_sin_tenant

-- `fn_auditar` saca el tenant de la propia fila y, si no lo encuentra, usa
-- 00000000-…-0000, que NO existe en `tenants`. En una tabla sin columna
-- tenant_id —como `roles_permisos`— eso hace fallar la clave foránea y el
-- INSERT/DELETE entero se revierte: era imposible dar o quitar un permiso a un
-- rol por ningún camino.
--
-- La auditoría no debe impedir la operación que audita. Ahora, cuando la fila
-- no dice a qué empresa pertenece, se intenta con la del usuario en sesión y,
-- si tampoco hay, simplemente NO se registra la línea de auditoría.
create or replace function fn_auditar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  -- Tenant de la fila; si la tabla no lo tiene, el del usuario en sesión.
  v_tenant := nullif(v_fila->>'tenant_id', '')::uuid;
  if v_tenant is null then
    begin
      v_tenant := auth_tenant_id();
    exception when others then
      v_tenant := null;
    end;
  end if;
  -- Sin tenant no hay dónde archivar la línea: se sigue sin auditar.
  if v_tenant is null then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  v_email := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    'sistema'
  );

  v_id := v_fila->>'id';

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
         and k not in ('modificado_en', 'actualizado_en', 'modificado_por') then
        v_antes   := v_antes   || jsonb_build_object(k, to_jsonb(OLD)->k);
        v_despues := v_despues || jsonb_build_object(k, to_jsonb(NEW)->k);
      end if;
    end loop;
    if v_antes = '{}'::jsonb then
      return NEW;   -- no cambió nada que valga la pena registrar
    end if;
    v_detalle := jsonb_build_object('antes', v_antes, 'despues', v_despues);
  else
    v_detalle := null;
  end if;

  insert into audit_logs (tenant_id, usuario_email, accion, entidad_tipo, entidad_id, entidad_label, detalle)
  values (v_tenant, v_email, lower(TG_OP), TG_TABLE_NAME, v_id, v_label, v_detalle);

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$function$;

-- Migración aplicada en producción vía Supabase (exportada al repo el 2026-09-23).
-- version: 20260904205915  name: audit_logs_triggers

-- Auditoría real: hasta hoy la tabla y la pantalla existían, pero con 0 filas y
-- 0 triggers. Con datos financieros y doce personas entrando, no tener rastro de
-- quién aprobó, modificó o anuló es una carencia de control, no un detalle.
--
-- Un solo trigger genérico sobre las tablas sensibles. Guarda únicamente los
-- campos que CAMBIARON, no la fila entera: así el registro se lee de un vistazo
-- y no se infla con 40 columnas iguales en cada update.

create or replace function fn_auditar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant   uuid;
  v_email    text;
  v_accion   text;
  v_id       text;
  v_label    text;
  v_detalle  jsonb;
  v_antes    jsonb;
  v_despues  jsonb;
  k          text;
begin
  v_tenant := coalesce(
    case when TG_OP = 'DELETE' then (to_jsonb(OLD)->>'tenant_id') else (to_jsonb(NEW)->>'tenant_id') end,
    '00000000-0000-0000-0000-000000000000'
  )::uuid;

  -- El correo sale del JWT. Si la acción viene de una Edge Function con la
  -- service key, no hay JWT: queda como 'sistema', que es la verdad.
  v_email := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    'sistema'
  );

  v_accion := lower(TG_OP);

  if TG_OP = 'DELETE' then
    v_id := to_jsonb(OLD)->>'id';
  else
    v_id := to_jsonb(NEW)->>'id';
  end if;

  -- Etiqueta legible: el número/código si la tabla lo tiene, si no el nombre.
  v_label := coalesce(
    case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end ->> 'numero',
    case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end ->> 'codigo',
    case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end ->> 'nombre',
    v_id
  );

  if TG_OP = 'UPDATE' then
    -- Solo lo que cambió, en antes/después.
    v_antes := '{}'::jsonb;
    v_despues := '{}'::jsonb;
    for k in select jsonb_object_keys(to_jsonb(NEW)) loop
      if to_jsonb(OLD)->k is distinct from to_jsonb(NEW)->k
         and k not in ('modificado_en', 'actualizado_en', 'creado_en') then
        v_antes   := v_antes   || jsonb_build_object(k, to_jsonb(OLD)->k);
        v_despues := v_despues || jsonb_build_object(k, to_jsonb(NEW)->k);
      end if;
    end loop;
    -- Un update que no cambió nada relevante no merece una fila de auditoría.
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
  values (v_tenant, v_email, v_accion, TG_TABLE_NAME, v_id, v_label, v_detalle);

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

-- Tablas sensibles: dinero, aprobaciones y permisos.
do $$
declare t text;
begin
  foreach t in array array[
    'ordenes_compra', 'orden_aprobaciones', 'orden_solicitudes_edicion',
    'gastos_caja_chica', 'ingresos_caja_chica', 'cajas_chicas',
    'comprobantes_pago', 'transacciones',
    'fianzas', 'fianza_cartas',
    'usuarios_roles', 'roles_permisos'
  ]
  loop
    execute format('drop trigger if exists trg_auditar on %I', t);
    execute format(
      'create trigger trg_auditar after insert or update or delete on %I
       for each row execute function fn_auditar()', t);
  end loop;
end $$;

create index if not exists idx_audit_logs_tenant_fecha on audit_logs(tenant_id, creado_en desc);
create index if not exists idx_audit_logs_entidad on audit_logs(entidad_tipo, entidad_id);

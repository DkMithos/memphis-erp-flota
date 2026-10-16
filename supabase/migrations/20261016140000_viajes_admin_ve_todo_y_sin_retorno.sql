-- 2026-10-16 (tarde) · Dos pedidos de Kevin:
-- 1) "El rol Administrador debe poder ver toda la información del sistema": vuelve a tener todos los permisos del módulo
--    viajes (deshace la parte del Administrador de 20261016120000; Contabilidad sigue sin ver viajes ajenos).
-- 2) "Hay viajes sin fecha de retorno": `viajes.fecha_retorno` pasa a ser opcional. Un viaje abierto calcula el viático con los
--    días que se indiquen (por defecto 1) y la rendición/los topes usan esos días. En el histórico, 11 viajes del Excel no
--    tenían retorno y se habían cargado con retorno = salida: quedan sin retorno.

insert into roles_permisos (rol_id, permiso_id)
select r.id, p.id from roles r, permisos p
 where r.tenant_id = 'e4b16a80-8500-418e-afaa-0e976b7d9b13' and r.nombre = 'Administrador' and p.modulo = 'viajes'
on conflict do nothing;

alter table public.viajes alter column fecha_retorno drop not null;

update viajes set fecha_retorno = null, cerrado_en = case when estado = 'cerrado' then cerrado_en else null end
 where origen_datos = 'excel-control-viajes' and numero in ('004-MM-GFMA-2026','005-MM-MACO-2026','006-MM-MACO-2026','007-MM-MACO-2026','002-MM-SMBS-2026',
   '008-MM-GADV-2026','012-MM-HJRZ-2026','007-MM-NRRR-2026','017-MM-GFAM-2026','008-MM-OTROS-2026','007-MM-JARZ-2026');

create or replace function public.viaje_solicitar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid := auth_tenant_id(); v_uid uuid := auth.uid(); v_id uuid; v_num text; v_ini text; v_anio text; v_n int;
        q jsonb; v_dias int; v_tarifa numeric; v_calc numeric; v_sol numeric; v_total numeric := 0; v_excede boolean := false;
        v_nombre text; v_hosp boolean; v_proy uuid; v_cdc uuid; v_primero text; v_sal date; v_ret date;
begin
  if v_uid is null then raise exception 'Sin sesión'; end if;
  if coalesce(p->>'motivo', '') = '' then raise exception 'Falta el motivo del viaje'; end if;
  if coalesce(p->>'destino', '') = '' then raise exception 'Falta el destino'; end if;
  if nullif(p->>'fecha_salida', '') is null then raise exception 'Falta la fecha de salida'; end if;
  v_sal := (p->>'fecha_salida')::date;
  v_ret := nullif(p->>'fecha_retorno', '')::date;          -- null = viaje abierto, sin fecha de retorno
  if v_ret is not null and v_ret < v_sal then raise exception 'El retorno no puede ser antes de la salida'; end if;
  if jsonb_array_length(coalesce(p->'pasajeros', '[]'::jsonb)) = 0 then raise exception 'Indica al menos un viajero'; end if;
  if not auth_tiene_permiso('viajes', 'crear') then
    if not exists (select 1 from jsonb_array_elements(p->'pasajeros') x where nullif(x->>'user_id', '')::uuid = v_uid) then
      raise exception 'Solo puedes solicitar viajes en los que viajas tú (Administración solicita para otros)';
    end if;
  end if;

  v_proy := nullif(p->>'proyecto_id', '')::uuid;
  v_cdc := nullif(p->>'centro_costo_id', '')::uuid;
  if v_proy is not null and v_cdc is null then
    select id into v_cdc from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_tenant order by codigo limit 1;
  end if;
  if v_proy is null and v_cdc is null then
    select id into v_cdc from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_tenant;
  end if;

  v_primero := p->'pasajeros'->0->>'nombre';
  v_ini := viaje_iniciales(v_primero);
  v_anio := to_char(v_sal, 'YYYY');
  select coalesce(max(substring(numero from '^(\d+)-MM-')::int), 0) + 1 into v_n
    from viajes where tenant_id = v_tenant and numero like '%-MM-' || v_ini || '-' || v_anio;
  v_num := lpad(v_n::text, 3, '0') || '-MM-' || v_ini || '-' || v_anio;

  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, hora_salida, hora_retorno,
                      medio_sugerido, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, justificacion_tope, observaciones, origen_datos)
  values (v_tenant, v_num, v_proy, v_cdc, p->>'motivo', coalesce(nullif(p->>'origen', ''), 'LIMA'), p->>'destino',
          v_sal, v_ret, nullif(p->>'hora_salida', '')::time, nullif(p->>'hora_retorno', '')::time,
          nullif(p->>'medio_sugerido', ''), coalesce((p->>'requiere_pasajes')::boolean, true), coalesce((p->>'requiere_viaticos')::boolean, true),
          coalesce((p->>'con_hospedaje')::boolean, true), 'solicitado', v_uid, nullif(p->>'justificacion_tope', ''), nullif(p->>'observaciones', ''),
          coalesce(nullif(p->>'origen_datos', ''), 'erp'))
  returning id into v_id;

  for q in select * from jsonb_array_elements(p->'pasajeros') loop
    v_nombre := trim(coalesce(q->>'nombre', ''));
    if v_nombre = '' then raise exception 'Un viajero no tiene nombre'; end if;
    v_hosp := coalesce((q->>'con_hospedaje')::boolean, coalesce((p->>'con_hospedaje')::boolean, true));
    v_dias := greatest(coalesce((q->>'dias')::int, case when v_ret is not null then (v_ret - v_sal) + 1 else 1 end), 1);
    v_tarifa := case when coalesce((p->>'requiere_viaticos')::boolean, true)
                     then coalesce(viaje_tarifa(v_tenant, case when v_hosp then 'adelanto_con_hospedaje' else 'adelanto_sin_hospedaje' end, v_sal), 0)
                     else 0 end;
    v_calc := round(v_tarifa * v_dias, 2);
    v_sol := coalesce((q->>'viatico_solicitado')::numeric, v_calc);
    if v_sol > v_calc then v_excede := true; end if;
    v_total := v_total + v_sol;
    insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, dni, cargo, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, cuenta_abono, notas)
    values (v_tenant, v_id, nullif(q->>'user_id', '')::uuid, v_nombre, nullif(q->>'dni', ''), nullif(q->>'cargo', ''), coalesce((q->>'es_externo')::boolean, false),
            v_dias, v_hosp, v_tarifa, v_calc, v_sol, nullif(q->>'cuenta_abono', ''), nullif(q->>'notas', ''));
  end loop;

  if v_excede and coalesce(p->>'justificacion_tope', '') = '' then
    raise exception 'El viático pedido supera la tarifa de la política: escribe la justificación';
  end if;
  update viajes set presupuesto_viaticos = v_total, tope_excedido = v_excede where id = v_id;
  perform viaje_notificar(v_tenant, 'viaje_solicitado', 'Viaje por aprobar: ' || v_num,
                          (p->>'destino') || ' · ' || v_primero || ' · ' || to_char(v_sal, 'DD/MM') || case when v_ret is not null then ' al ' || to_char(v_ret, 'DD/MM') else ' (sin retorno)' end ||
                          case when v_excede then ' · EXCEDE TARIFA' else '' end, v_id);
  return jsonb_build_object('id', v_id, 'numero', v_num, 'presupuesto_viaticos', v_total, 'tope_excedido', v_excede);
end $$;

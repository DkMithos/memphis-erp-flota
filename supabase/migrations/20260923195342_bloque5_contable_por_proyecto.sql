-- Bloque 5 — Contable por proyecto. La contabilidad estaba vacía (0 cuentas,
-- 0 periodos, 0 asientos, 0 registros). Ahora: el PCGE se siembra en la base,
-- el periodo se abre solo, la factura (recibida conforme / emitida) genera su
-- asiento con el centro de costo del proyecto en las líneas y su fila en el
-- registro de compras/ventas, el pago/cobro genera el asiento de tesorería,
-- y v_contable_proyecto responde "contablemente, ¿cómo va el proyecto?".

-- ── 0. Configuración contable por empresa (cuentas y momento) ─────────────
create table if not exists public.contabilidad_config (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  clave text not null,
  valor text not null,
  descripcion text,
  primary key (tenant_id, clave)
);
alter table public.contabilidad_config enable row level security;
drop policy if exists contabilidad_config_select on public.contabilidad_config;
create policy contabilidad_config_select on public.contabilidad_config for select to authenticated
  using (tenant_id in (select tenant_id from public.usuarios_tenant where user_id = auth.uid()));
grant select on public.contabilidad_config to authenticated;

create or replace function public.cta_cfg(p_tenant uuid, p_clave text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select valor from contabilidad_config where tenant_id = p_tenant and clave = p_clave),
    case p_clave
      when 'cta_compra_bienes'    then '603'
      when 'cta_compra_servicios' then '639'
      when 'cta_igv'              then '40111'
      when 'cta_proveedores'      then '4212'
      when 'cta_clientes'         then '1212'
      when 'cta_ventas'           then '7041'
      when 'cta_banco_mn'         then '1041'
      when 'cta_banco_me'         then '1042'
      when 'contabilizar_al'      then 'conforme'
    end);
$$;

insert into public.contabilidad_config (tenant_id, clave, valor, descripcion) values
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'contabilizar_al', 'conforme', 'Cuándo se contabiliza la factura recibida: conforme (validada por Compras) | recibida (al entrar) | manual'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'cta_compra_bienes', '603', 'Cuenta del gasto cuando la factura corresponde a bienes recibidos en almacén'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'cta_compra_servicios', '639', 'Cuenta del gasto para servicios y compras sin recepción en almacén'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'cta_igv', '40111', 'IGV crédito/débito fiscal'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'cta_proveedores', '4212', 'Facturas por pagar a proveedores'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'cta_clientes', '1212', 'Facturas por cobrar a clientes'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'cta_ventas', '7041', 'Ingresos por servicios (obras por impuestos)'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'cta_banco_mn', '1041', 'Banco moneda nacional'),
  ('e4b16a80-8500-418e-afaa-0e976b7d9b13', 'cta_banco_me', '1042', 'Banco moneda extranjera')
on conflict (tenant_id, clave) do nothing;

-- ── 1. PCGE en la base (misma lista que src/lib/contabilidad/fiscal-peru.ts) ──
create or replace function public.pcge_sembrar(p_tenant uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into plan_cuentas (tenant_id, codigo, nombre, tipo, naturaleza, nivel, es_hoja, acepta_movimientos, activo, es_estandar, saldo_inicial, saldo_actual)
  select p_tenant, v.codigo, v.nombre, v.tipo, v.naturaleza, length(v.codigo), v.hoja, v.hoja, true, true, 0, 0
  from (values
    ('1','Activo Disponible y Exigible','activo','deudora',false),
    ('10','Efectivo y Equivalentes de Efectivo','activo','deudora',false),
    ('101','Caja','activo','deudora',false),
    ('1011','Caja – Moneda Nacional','activo','deudora',true),
    ('1012','Caja – Moneda Extranjera','activo','deudora',true),
    ('104','Cuentas Corrientes en Inst. Financieras','activo','deudora',false),
    ('1041','Ctas. Corrientes Operativas – MN','activo','deudora',true),
    ('1042','Ctas. Corrientes Operativas – ME','activo','deudora',true),
    ('106','Depósitos en Inst. Financieras','activo','deudora',false),
    ('1061','Depósitos a Plazo – MN','activo','deudora',true),
    ('108','Otros Equivalentes de Efectivo','activo','deudora',true),
    ('11','Inversiones al Valor Razonable','activo','deudora',false),
    ('111','Inversiones Mantenidas para Negociación','activo','deudora',true),
    ('12','Cuentas por Cobrar Comerciales – Terceros','activo','deudora',false),
    ('121','Facturas, Boletas y otros Comprob. x Cobrar','activo','deudora',false),
    ('1212','Emitidas en Cartera','activo','deudora',true),
    ('1213','En Descuento','activo','deudora',true),
    ('123','Letras por Cobrar','activo','deudora',true),
    ('13','Ctas. por Cobrar Comerciales – Relacionadas','activo','deudora',false),
    ('131','Facturas y Otros Comprob. x Cobrar','activo','deudora',true),
    ('14','Cuentas por Cobrar al Personal','activo','deudora',false),
    ('141','Préstamos','activo','deudora',true),
    ('142','Anticipos','activo','deudora',true),
    ('16','Cuentas por Cobrar Diversas – Terceros','activo','deudora',false),
    ('161','Préstamos a Terceros','activo','deudora',true),
    ('165','Venta de Activo Inmovilizado','activo','deudora',true),
    ('167','Tributos por Aplicar','activo','deudora',true),
    ('168','Otras Cuentas por Cobrar Diversas','activo','deudora',true),
    ('17','Cuentas por Cobrar Diversas – Relacionadas','activo','deudora',true),
    ('18','Servicios y Otros Contratados por Anticipado','activo','deudora',false),
    ('181','Costos Financieros','activo','deudora',true),
    ('182','Seguros','activo','deudora',true),
    ('189','Otros Servicios Contratados x Anticipado','activo','deudora',true),
    ('19','Estimación de Cuentas de Cobranza Dudosa','activo','acreedora',false),
    ('191','Ctas. x Cobrar Comerciales – Terceros','activo','acreedora',true),
    ('2','Activo Realizable','activo','deudora',false),
    ('20','Mercaderías','activo','deudora',false),
    ('201','Mercaderías Manufacturadas','activo','deudora',true),
    ('24','Materias Primas','activo','deudora',true),
    ('25','Materiales Auxiliares, Suministros y Repuestos','activo','deudora',false),
    ('251','Materiales Auxiliares','activo','deudora',true),
    ('252','Suministros','activo','deudora',true),
    ('253','Repuestos','activo','deudora',true),
    ('28','Existencias por Recibir','activo','deudora',true),
    ('29','Desvalorización de Existencias','activo','acreedora',true),
    ('3','Activo Inmovilizado','activo','deudora',false),
    ('30','Inversiones Mobiliarias','activo','deudora',true),
    ('31','Inversiones Inmobiliarias','activo','deudora',true),
    ('32','Activos Adquiridos en Arrendamiento Financiero','activo','deudora',true),
    ('33','Inmuebles, Maquinaria y Equipo','activo','deudora',false),
    ('331','Terrenos','activo','deudora',true),
    ('332','Edificaciones','activo','deudora',true),
    ('333','Maquinaria y Equipos de Explotación','activo','deudora',true),
    ('334','Unidades de Transporte','activo','deudora',true),
    ('335','Muebles y Enseres','activo','deudora',true),
    ('336','Equipos Diversos','activo','deudora',true),
    ('337','Herramientas y Unidades de Reemplazo','activo','deudora',true),
    ('338','Unidades por Recibir','activo','deudora',true),
    ('34','Intangibles','activo','deudora',false),
    ('343','Programas de Computadora (Software)','activo','deudora',true),
    ('346','Fórmulas, Diseños y Prototipos','activo','deudora',true),
    ('36','Desvalorización de Activo Inmovilizado','activo','acreedora',true),
    ('37','Activo Diferido','activo','deudora',false),
    ('371','Impuesto a la Renta Diferido','activo','deudora',true),
    ('39','Depreciación, Amortización y Agotamiento Acumulados','activo','acreedora',false),
    ('391','Depreciación Acumulada','activo','acreedora',false),
    ('3913','Inmuebles, Maquinaria y Equipo – Costo','activo','acreedora',true),
    ('392','Amortización Acumulada','activo','acreedora',true),
    ('4','Pasivo','pasivo','acreedora',false),
    ('40','Tributos, Contraprestaciones y Aportes','pasivo','acreedora',false),
    ('401','Gobierno Central','pasivo','acreedora',false),
    ('4011','Impuesto General a las Ventas','pasivo','acreedora',false),
    ('40111','IGV – Cuenta Propia','pasivo','acreedora',true),
    ('40112','IGV – Cuenta de Terceros','pasivo','acreedora',true),
    ('4017','Impuesto a la Renta','pasivo','acreedora',false),
    ('40171','Renta de Tercera Categoría','pasivo','acreedora',true),
    ('40172','Renta de Cuarta Categoría','pasivo','acreedora',true),
    ('40173','Renta de Quinta Categoría','pasivo','acreedora',true),
    ('4018','Impuesto Selectivo al Consumo','pasivo','acreedora',true),
    ('4019','Otros Impuestos y Contraprestaciones','pasivo','acreedora',true),
    ('403','Instituciones Públicas','pasivo','acreedora',false),
    ('4031','ESSALUD','pasivo','acreedora',true),
    ('4032','ONP','pasivo','acreedora',true),
    ('41','Remuneraciones y Participaciones por Pagar','pasivo','acreedora',false),
    ('411','Remuneraciones por Pagar','pasivo','acreedora',true),
    ('415','Beneficios Sociales de los Trabajadores','pasivo','acreedora',true),
    ('419','Otras Remuneraciones y Participaciones','pasivo','acreedora',true),
    ('42','Cuentas por Pagar Comerciales – Terceros','pasivo','acreedora',false),
    ('421','Facturas, Boletas y Otros Comprob. x Pagar','pasivo','acreedora',false),
    ('4212','Emitidas','pasivo','acreedora',true),
    ('4213','En Trámite','pasivo','acreedora',true),
    ('423','Letras por Pagar','pasivo','acreedora',true),
    ('43','Cuentas por Pagar Comerciales – Relacionadas','pasivo','acreedora',true),
    ('44','Cuentas por Pagar a los Accionistas','pasivo','acreedora',true),
    ('45','Obligaciones Financieras','pasivo','acreedora',false),
    ('451','Préstamos de Instituciones Financieras','pasivo','acreedora',false),
    ('4511','Préstamos – MN','pasivo','acreedora',true),
    ('4512','Préstamos – ME','pasivo','acreedora',true),
    ('452','Contratos de Arrendamiento Financiero','pasivo','acreedora',true),
    ('46','Cuentas por Pagar Diversas – Terceros','pasivo','acreedora',false),
    ('461','Reclamaciones de Terceros','pasivo','acreedora',true),
    ('469','Otras Cuentas por Pagar Diversas','pasivo','acreedora',true),
    ('47','Cuentas por Pagar Diversas – Relacionadas','pasivo','acreedora',true),
    ('48','Provisiones','pasivo','acreedora',false),
    ('481','Provisión para Litigios','pasivo','acreedora',true),
    ('489','Otras Provisiones','pasivo','acreedora',true),
    ('5','Patrimonio','patrimonio','acreedora',false),
    ('50','Capital','patrimonio','acreedora',false),
    ('501','Capital Social','patrimonio','acreedora',true),
    ('52','Capital Adicional','patrimonio','acreedora',true),
    ('55','Acciones de Inversión','patrimonio','acreedora',true),
    ('56','Resultados No Realizados','patrimonio','acreedora',true),
    ('57','Excedente de Revaluación','patrimonio','acreedora',true),
    ('58','Reservas','patrimonio','acreedora',false),
    ('581','Reserva Legal','patrimonio','acreedora',true),
    ('589','Otras Reservas','patrimonio','acreedora',true),
    ('59','Resultados Acumulados','patrimonio','acreedora',false),
    ('591','Utilidades No Distribuidas','patrimonio','acreedora',true),
    ('592','Pérdidas Acumuladas','patrimonio','deudora',true),
    ('6','Gastos por Naturaleza','gasto','deudora',false),
    ('60','Compras','costo','deudora',false),
    ('601','Mercaderías','costo','deudora',true),
    ('603','Materiales Auxiliares, Suministros y Repuestos','costo','deudora',true),
    ('606','Suministros Diversos','costo','deudora',true),
    ('609','Costos Vinculados con las Compras','costo','deudora',true),
    ('61','Variación de Existencias','costo','deudora',false),
    ('611','Mercaderías','costo','deudora',true),
    ('613','Materiales Auxiliares, Suministros y Repuestos','costo','deudora',true),
    ('62','Gastos de Personal, Directores y Gerentes','gasto','deudora',false),
    ('621','Remuneraciones','gasto','deudora',true),
    ('622','Otras Remuneraciones','gasto','deudora',true),
    ('627','Seguridad y Previsión Social','gasto','deudora',false),
    ('6271','ESSALUD','gasto','deudora',true),
    ('6272','ONP','gasto','deudora',true),
    ('628','Compensación por Tiempo de Servicios','gasto','deudora',true),
    ('629','Beneficios Sociales de los Trabajadores','gasto','deudora',true),
    ('63','Gastos de Servicios Prestados por Terceros','gasto','deudora',false),
    ('631','Transporte, Correos y Gastos de Viaje','gasto','deudora',true),
    ('632','Asesoría y Consultoría','gasto','deudora',true),
    ('633','Producción Encargada a Terceros','gasto','deudora',true),
    ('634','Mantenimiento y Reparaciones','gasto','deudora',true),
    ('635','Alquileres','gasto','deudora',true),
    ('636','Servicios Básicos','gasto','deudora',false),
    ('6361','Energía Eléctrica','gasto','deudora',true),
    ('6362','Gas','gasto','deudora',true),
    ('6363','Agua','gasto','deudora',true),
    ('6364','Teléfono','gasto','deudora',true),
    ('6365','Internet y TV Cable','gasto','deudora',true),
    ('637','Publicidad, Publicaciones, Relaciones Públ.','gasto','deudora',true),
    ('638','Servicios de Seguridad y Vigilancia','gasto','deudora',true),
    ('639','Otros Servicios Prestados por Terceros','gasto','deudora',true),
    ('64','Gastos por Tributos','gasto','deudora',false),
    ('641','Gobierno Central','gasto','deudora',true),
    ('642','Gobierno Regional y Local','gasto','deudora',true),
    ('65','Otros Gastos de Gestión','gasto','deudora',false),
    ('651','Seguros','gasto','deudora',true),
    ('652','Regalías','gasto','deudora',true),
    ('655','Costo Neto de Enajenación de Activos','gasto','deudora',true),
    ('656','Suministros','gasto','deudora',true),
    ('659','Otros Gastos de Gestión','gasto','deudora',true),
    ('66','Pérdida por Medición de Activos No Fin.','gasto','deudora',true),
    ('67','Gastos Financieros','gasto','deudora',false),
    ('671','Gastos en Operaciones de Endeudamiento','gasto','deudora',false),
    ('6711','Intereses','gasto','deudora',true),
    ('6712','Comisiones y Portes','gasto','deudora',true),
    ('677','Pérdida por Diferencia de Cambio','gasto','deudora',true),
    ('68','Valuación y Deterioro de Activos y Provisiones','gasto','deudora',false),
    ('681','Depreciación','gasto','deudora',false),
    ('6813','Depreciación de Inmuebles, Maq. y Equipo','gasto','deudora',true),
    ('682','Amortización de Intangibles','gasto','deudora',true),
    ('69','Costo de Ventas','costo','deudora',false),
    ('691','Mercaderías','costo','deudora',true),
    ('692','Productos Terminados','costo','deudora',true),
    ('7','Ingresos','ingreso','acreedora',false),
    ('70','Ventas','ingreso','acreedora',false),
    ('701','Mercaderías','ingreso','acreedora',false),
    ('7011','Mercaderías – Terceros','ingreso','acreedora',true),
    ('704','Prestación de Servicios','ingreso','acreedora',false),
    ('7041','Servicios – Terceros','ingreso','acreedora',true),
    ('705','Fletes y Otros Ingresos por Gestión','ingreso','acreedora',true),
    ('706','Alquileres','ingreso','acreedora',true),
    ('707','Comisiones','ingreso','acreedora',true),
    ('709','Devoluciones sobre Ventas','ingreso','deudora',true),
    ('71','Variación de la Producción Almacenada','ingreso','acreedora',true),
    ('75','Otros Ingresos de Gestión','ingreso','acreedora',false),
    ('751','Servicios en Beneficio del Personal','ingreso','acreedora',true),
    ('759','Otros Ingresos de Gestión','ingreso','acreedora',true),
    ('76','Ganancia por Medición de Activos No Fin.','ingreso','acreedora',true),
    ('77','Ingresos Financieros','ingreso','acreedora',false),
    ('771','Ganancia por Instrumentos Financieros','ingreso','acreedora',true),
    ('772','Rendimientos Ganados','ingreso','acreedora',false),
    ('7722','Ctas. Ctes. en Inst. Financieras','ingreso','acreedora',true),
    ('776','Diferencia de Cambio','ingreso','acreedora',true),
    ('778','Otros Ingresos Financieros','ingreso','acreedora',true),
    ('79','Cargas Imputables a Ctas. de Costos y Gastos','ingreso','acreedora',false),
    ('791','Cargas Imputables a Ctas. de Costos','ingreso','acreedora',true),
    ('9','Contabilidad Analítica de Explotación','gasto','deudora',false),
    ('94','Gastos Administrativos','gasto','deudora',false),
    ('941','Gastos de Personal Administrativo','gasto','deudora',true),
    ('942','Gastos de Servicios Administrativos','gasto','deudora',true),
    ('943','Gastos de Gestión Administrativa','gasto','deudora',true),
    ('95','Gastos de Ventas','gasto','deudora',false),
    ('951','Gastos de Personal de Ventas','gasto','deudora',true),
    ('952','Gastos de Publicidad y Marketing','gasto','deudora',true),
    ('96','Gastos de Producción','gasto','deudora',true),
    ('97','Gastos Financieros Analíticos','gasto','deudora',true),
    ('98','Gastos por Tributos Analíticos','gasto','deudora',true),
    ('0','Cuentas de Orden','orden','deudora',false),
    ('01','Bienes y Valores Entregados en Garantía','orden','deudora',true),
    ('02','Bienes y Valores Recibidos en Garantía','orden','acreedora',true),
    ('05','Bienes Entregados en Custodia','orden','deudora',true),
    ('06','Bienes Recibidos en Custodia','orden','acreedora',true)
  ) as v(codigo, nombre, tipo, naturaleza, hoja)
  on conflict (tenant_id, codigo) do nothing;
  get diagnostics n = row_count;
  -- padre = el prefijo más largo que exista
  update plan_cuentas c set cuenta_padre_codigo = (
    select p.codigo from plan_cuentas p where p.tenant_id = c.tenant_id and p.codigo <> c.codigo and c.codigo like p.codigo || '%'
     order by length(p.codigo) desc limit 1)
   where c.tenant_id = p_tenant and c.cuenta_padre_codigo is null and length(c.codigo) > 1;
  return n;
end $$;
select public.pcge_sembrar('e4b16a80-8500-418e-afaa-0e976b7d9b13');

-- ── 2. Periodo contable: se abre solo; si está cerrado, no se contabiliza ahí ──
create or replace function public.periodo_contable_para(p_tenant uuid, p_fecha date) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_estado text; v_anio int := extract(year from p_fecha); v_mes int := extract(month from p_fecha);
begin
  select id, estado into v_id, v_estado from periodos_contables where tenant_id = p_tenant and anio = v_anio and mes = v_mes;
  if v_id is null then
    insert into periodos_contables (tenant_id, anio, mes, nombre, estado)
    values (p_tenant, v_anio, v_mes,
      (array['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'])[v_mes] || ' ' || v_anio, 'abierto')
    returning id into v_id;
  elsif v_estado = 'cerrado' then
    raise exception 'El periodo %/% está cerrado: no se puede contabilizar con esa fecha', v_anio, lpad(v_mes::text, 2, '0');
  end if;
  return v_id;
end $$;

-- ── 3. Asiento genérico: cabecera + líneas balanceadas, con CDC ──────────
-- lineas: jsonb [{cuenta:'639', debe:100, haber:0, cdc:uuid|null, glosa:text, ruc:text, nombre:text}]
create or replace function public.asiento_crear(
  p_tenant uuid, p_fecha date, p_glosa text, p_tipo text, p_moneda text, p_tc numeric,
  p_doc_tipo text, p_doc_serie text, p_doc_numero text, p_ruc text, p_nombre text,
  p_origen_modulo text, p_origen_ref text, p_lineas jsonb, p_creado_por uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_periodo uuid; v_num text; v_id uuid; v_debe numeric := 0; v_haber numeric := 0; l jsonb; c record; i int := 0; v_anio text;
begin
  v_periodo := periodo_contable_para(p_tenant, p_fecha);
  for l in select * from jsonb_array_elements(p_lineas) loop
    v_debe := v_debe + coalesce((l->>'debe')::numeric, 0);
    v_haber := v_haber + coalesce((l->>'haber')::numeric, 0);
  end loop;
  if abs(v_debe - v_haber) > 0.01 then
    raise exception 'Asiento desbalanceado: debe % / haber %', v_debe, v_haber;
  end if;
  v_anio := to_char(p_fecha, 'YYYY');
  select 'AST-' || v_anio || '-' || lpad((coalesce(max(substring(numero from '^AST-\d{4}-(\d+)$')::int), 0) + 1)::text, 6, '0') into v_num
    from asientos_contables where tenant_id = p_tenant and numero like 'AST-' || v_anio || '-%';
  insert into asientos_contables (tenant_id, numero, periodo_id, fecha, glosa, tipo, estado, moneda, tipo_cambio, total_debe, total_haber,
    doc_tipo, doc_serie, doc_numero, ruc_tercero, nombre_tercero, origen_modulo, origen_referencia, creado_por)
  values (p_tenant, v_num, v_periodo, p_fecha, p_glosa, p_tipo, 'validado', coalesce(p_moneda, 'PEN'), coalesce(p_tc, 1), round(v_debe, 2), round(v_haber, 2),
    p_doc_tipo, p_doc_serie, p_doc_numero, p_ruc, p_nombre, p_origen_modulo, p_origen_ref, p_creado_por)
  returning id into v_id;
  for l in select * from jsonb_array_elements(p_lineas) loop
    if coalesce((l->>'debe')::numeric, 0) = 0 and coalesce((l->>'haber')::numeric, 0) = 0 then continue; end if;
    select id, codigo, nombre into c from plan_cuentas where tenant_id = p_tenant and codigo = l->>'cuenta';
    if not found then raise exception 'La cuenta % no existe en el plan de cuentas', l->>'cuenta'; end if;
    i := i + 1;
    insert into asientos_lineas (tenant_id, asiento_id, numero_linea, cuenta_id, cuenta_codigo, cuenta_nombre, centro_costo_id, debe, haber, glosa, ruc_tercero, nombre_tercero)
    values (p_tenant, v_id, i, c.id, c.codigo, c.nombre, nullif(l->>'cdc', '')::uuid,
            round(coalesce((l->>'debe')::numeric, 0), 2), round(coalesce((l->>'haber')::numeric, 0), 2),
            coalesce(l->>'glosa', p_glosa), coalesce(l->>'ruc', p_ruc), coalesce(l->>'nombre', p_nombre));
  end loop;
  return v_id;
end $$;

-- ── 4. Factura → asiento + registro de compras/ventas ────────────────────
alter table public.transacciones add column if not exists asiento_id uuid references public.asientos_contables(id) on delete set null;

create or replace function public.cdc_de_comprobante(p_cdc uuid, p_proyecto uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(p_cdc, (select id from centros_costo where proyecto_id = p_proyecto and coalesce(activo, true) order by creado_en limit 1));
$$;

create or replace function public.contabilizar_comprobante(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare c record; v_tc numeric; v_cdc uuid; v_base numeric; v_igv numeric; v_total numeric; v_gasto text; v_lineas jsonb; v_asiento uuid;
        v_periodo text; v_corr int; v_nc boolean; v_dif numeric;
begin
  select * into c from comprobantes_pago where id = p_id;
  if not found or c.estado <> 'activo' or coalesce(c.estado_flujo, '') = 'anulada' then return null; end if;
  if c.asiento_id is not null then return c.asiento_id; end if;

  v_tc := case when c.moneda = 'USD' then (case when coalesce(c.tipo_cambio, 0) > 1 then c.tipo_cambio else tc_vigente(c.fecha_emision) end) else 1 end;
  v_cdc := cdc_de_comprobante(c.centro_costo_id, c.proyecto_id);
  v_base := round((coalesce(c.op_gravada, 0) + coalesce(c.op_exonerada, 0) + coalesce(c.op_inafecta, 0) + coalesce(c.op_exportacion, 0) + coalesce(c.otros_tributos, 0)) * v_tc, 2);
  v_igv := round(coalesce(c.igv, 0) * v_tc, 2);
  v_total := round(coalesce(c.total, 0) * v_tc, 2);
  -- redondeo: la diferencia (centavos) se ajusta en la línea de base
  v_dif := v_total - v_base - v_igv;
  if abs(v_dif) <= 0.05 then v_base := v_base + v_dif; else raise exception 'La factura % no cuadra: base %, IGV %, total %', c.numero_completo, v_base, v_igv, v_total; end if;
  v_nc := c.tipo = '07';   -- nota de crédito: se invierte

  if c.direccion = 'recibido' then
    -- bienes recibidos en almacén → 603; si no, servicios → 639
    v_gasto := case when c.recepcion_id is not null
                      or (c.orden_compra_id is not null and exists (select 1 from recepciones r where r.orden_id = c.orden_compra_id and r.estado <> 'rechazado'))
                    then cta_cfg(c.tenant_id, 'cta_compra_bienes') else cta_cfg(c.tenant_id, 'cta_compra_servicios') end;
    v_lineas := jsonb_build_array(
      jsonb_build_object('cuenta', v_gasto, 'debe', case when v_nc then 0 else v_base end, 'haber', case when v_nc then v_base else 0 end, 'cdc', v_cdc),
      jsonb_build_object('cuenta', cta_cfg(c.tenant_id, 'cta_igv'), 'debe', case when v_nc then 0 else v_igv end, 'haber', case when v_nc then v_igv else 0 end, 'cdc', v_cdc),
      jsonb_build_object('cuenta', cta_cfg(c.tenant_id, 'cta_proveedores'), 'debe', case when v_nc then v_total else 0 end, 'haber', case when v_nc then 0 else v_total end, 'cdc', v_cdc));
    v_asiento := asiento_crear(c.tenant_id, c.fecha_emision,
      'Factura ' || c.numero_completo || coalesce(' · ' || c.razon_social_emisor, '') || coalesce(' · OC ' || c.orden_compra_numero, ''),
      'automatico', c.moneda, v_tc, c.tipo, c.serie, c.numero, c.ruc_emisor, c.razon_social_emisor, 'comprobantes', c.numero_completo, v_lineas, c.creado_por);
    v_periodo := to_char(c.fecha_emision, 'YYYYMM');
    if not exists (select 1 from registro_compras where comprobante_id = c.id) then
      select coalesce(max(correlativo), 0) + 1 into v_corr from registro_compras where tenant_id = c.tenant_id and periodo = v_periodo;
      insert into registro_compras (tenant_id, periodo, correlativo, fecha_emision, fecha_vencimiento, tipo_comprobante, serie, numero, tipo_doc_identidad,
        ruc_proveedor, razon_social_proveedor, base_imponible_gravada, igv, base_imponible_no_gravada, otros_tributos, importe_total, moneda, tipo_cambio, estado, comprobante_id, asiento_id)
      values (c.tenant_id, v_periodo, v_corr, c.fecha_emision, c.fecha_vencimiento, c.tipo, c.serie, c.numero, '6',
        c.ruc_emisor, coalesce(c.razon_social_emisor, 'SIN NOMBRE'), coalesce(c.op_gravada, 0), coalesce(c.igv, 0),
        coalesce(c.op_exonerada, 0) + coalesce(c.op_inafecta, 0), coalesce(c.otros_tributos, 0), coalesce(c.total, 0), c.moneda, v_tc, 'activo', c.id, v_asiento);
    else
      update registro_compras set asiento_id = v_asiento where comprobante_id = c.id;
    end if;
  else
    v_lineas := jsonb_build_array(
      jsonb_build_object('cuenta', cta_cfg(c.tenant_id, 'cta_clientes'), 'debe', case when v_nc then 0 else v_total end, 'haber', case when v_nc then v_total else 0 end, 'cdc', v_cdc),
      jsonb_build_object('cuenta', cta_cfg(c.tenant_id, 'cta_ventas'), 'debe', case when v_nc then v_base else 0 end, 'haber', case when v_nc then 0 else v_base end, 'cdc', v_cdc),
      jsonb_build_object('cuenta', cta_cfg(c.tenant_id, 'cta_igv'), 'debe', case when v_nc then v_igv else 0 end, 'haber', case when v_nc then 0 else v_igv end, 'cdc', v_cdc));
    v_asiento := asiento_crear(c.tenant_id, c.fecha_emision,
      'Venta ' || c.numero_completo || coalesce(' · ' || c.razon_social_receptor, ''),
      'automatico', c.moneda, v_tc, c.tipo, c.serie, c.numero, c.ruc_receptor, c.razon_social_receptor, 'comprobantes', c.numero_completo, v_lineas, c.creado_por);
    v_periodo := to_char(c.fecha_emision, 'YYYYMM');
    if not exists (select 1 from registro_ventas where comprobante_id = c.id) then
      select coalesce(max(correlativo), 0) + 1 into v_corr from registro_ventas where tenant_id = c.tenant_id and periodo = v_periodo;
      insert into registro_ventas (tenant_id, periodo, correlativo, fecha_emision, tipo_comprobante, serie, numero, tipo_doc_identidad_cliente, doc_identidad_cliente,
        razon_social_cliente, base_imponible_gravada, igv, base_imponible_exonerada, base_imponible_inafecta, exportacion, importe_total, moneda, tipo_cambio, estado, comprobante_id, asiento_id)
      values (c.tenant_id, v_periodo, v_corr, c.fecha_emision, c.tipo, c.serie, c.numero, '6', c.ruc_receptor,
        c.razon_social_receptor, coalesce(c.op_gravada, 0), coalesce(c.igv, 0), coalesce(c.op_exonerada, 0), coalesce(c.op_inafecta, 0), coalesce(c.op_exportacion, 0),
        coalesce(c.total, 0), c.moneda, v_tc, 'activo', c.id, v_asiento);
    else
      update registro_ventas set asiento_id = v_asiento where comprobante_id = c.id;
    end if;
  end if;

  update comprobantes_pago set asiento_id = v_asiento, contabilizado = true where id = c.id;
  return v_asiento;
end $$;

create or replace function public.anular_contabilizacion_comprobante(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from comprobantes_pago where id = p_id;
  if not found or c.asiento_id is null then return; end if;
  update asientos_contables set estado = 'anulado', modificado_en = now() where id = c.asiento_id and estado <> 'anulado';
  update registro_compras set estado = 'anulado' where comprobante_id = p_id;
  update registro_ventas set estado = 'anulado' where comprobante_id = p_id;
end $$;

-- RPC con permiso (Contabilidad → "Contabilizar")
create or replace function public.contabilizar_comprobante_rpc(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not (auth_tiene_permiso('contabilidad', 'crear') or auth_tiene_permiso('contabilidad', 'editar')) then
    raise exception 'Sin permiso para contabilizar (contabilidad.crear)';
  end if;
  return contabilizar_comprobante(p_id);
end $$;
grant execute on function public.contabilizar_comprobante_rpc(uuid) to authenticated;

-- Momento: emitida → al nacer; recibida → según contabilizar_al (conforme por defecto). Anulada → asiento anulado.
create or replace function public.trg_comprobante_contabilizar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_al text;
begin
  if new.estado = 'anulado' or coalesce(new.estado_flujo, '') = 'anulada' then
    perform anular_contabilizacion_comprobante(new.id);
    return null;
  end if;
  if new.asiento_id is not null or new.estado <> 'activo' then return null; end if;
  if new.direccion = 'emitido' then
    perform contabilizar_comprobante(new.id);
    return null;
  end if;
  v_al := cta_cfg(new.tenant_id, 'contabilizar_al');
  if (v_al = 'conforme' and coalesce(new.estado_flujo, '') in ('conforme', 'programada_pago', 'pagada'))
     or (v_al = 'recibida' and coalesce(new.estado_flujo, 'recibida') not in ('observada', 'anulada')) then
    perform contabilizar_comprobante(new.id);
  end if;
  return null;
end $$;
drop trigger if exists trg_comprobante_contabilizar on public.comprobantes_pago;
create trigger trg_comprobante_contabilizar
  after insert or update of estado, estado_flujo, centro_costo_id, proyecto_id on public.comprobantes_pago
  for each row execute function public.trg_comprobante_contabilizar();

-- ── 5. Pago / cobro → asiento de tesorería ───────────────────────────────
create or replace function public.trg_transaccion_asiento() returns trigger
language plpgsql security definer set search_path = public as $$
declare c record; v_banco text; v_contra text; v_cdc uuid; v_monto numeric; v_asiento uuid; v_glosa text;
begin
  if new.estado = 'anulada' and new.asiento_id is not null then
    update asientos_contables set estado = 'anulado', modificado_en = now() where id = new.asiento_id and estado <> 'anulado';
    return null;
  end if;
  if new.estado <> 'pagada' or new.asiento_id is not null or new.comprobante_id is null then return null; end if;
  select * into c from comprobantes_pago where id = new.comprobante_id;
  if not found or c.asiento_id is null then return null; end if;   -- sin factura contabilizada no hay 42/12 que cancelar
  v_banco := cta_cfg(new.tenant_id, case when coalesce(new.moneda, 'PEN') = 'USD' then 'cta_banco_me' else 'cta_banco_mn' end);
  v_cdc := cdc_de_comprobante(coalesce(new.centro_costo_id, c.centro_costo_id), coalesce(new.proyecto_id, c.proyecto_id));
  v_monto := round(coalesce(new.monto_soles, new.monto), 2);
  if new.tipo = 'egreso' then
    v_contra := cta_cfg(new.tenant_id, 'cta_proveedores');
    v_glosa := 'Pago ' || new.numero || ' · factura ' || c.numero_completo || coalesce(' · ' || c.razon_social_emisor, '');
    v_asiento := asiento_crear(new.tenant_id, coalesce(new.fecha_pago, new.fecha), v_glosa, 'automatico', new.moneda, coalesce(new.tipo_cambio, 1),
      c.tipo, c.serie, c.numero, c.ruc_emisor, c.razon_social_emisor, 'tesoreria', new.numero,
      jsonb_build_array(jsonb_build_object('cuenta', v_contra, 'debe', v_monto, 'haber', 0, 'cdc', v_cdc),
                        jsonb_build_object('cuenta', v_banco, 'debe', 0, 'haber', v_monto, 'cdc', v_cdc)), null);
  elsif new.tipo = 'ingreso' then
    v_contra := cta_cfg(new.tenant_id, 'cta_clientes');
    v_glosa := 'Cobro ' || new.numero || ' · factura ' || c.numero_completo || coalesce(' · ' || c.razon_social_receptor, '');
    v_asiento := asiento_crear(new.tenant_id, coalesce(new.fecha_pago, new.fecha), v_glosa, 'automatico', new.moneda, coalesce(new.tipo_cambio, 1),
      c.tipo, c.serie, c.numero, c.ruc_receptor, c.razon_social_receptor, 'tesoreria', new.numero,
      jsonb_build_array(jsonb_build_object('cuenta', v_banco, 'debe', v_monto, 'haber', 0, 'cdc', v_cdc),
                        jsonb_build_object('cuenta', v_contra, 'debe', 0, 'haber', v_monto, 'cdc', v_cdc)), null);
  else
    return null;
  end if;
  update transacciones set asiento_id = v_asiento where id = new.id;
  return null;
end $$;
drop trigger if exists trg_transaccion_asiento on public.transacciones;
create trigger trg_transaccion_asiento after insert or update of estado, comprobante_id on public.transacciones
  for each row execute function public.trg_transaccion_asiento();

-- ── 6. Contable por centro de costo y por proyecto ───────────────────────
create or replace view public.v_contable_cdc with (security_invoker = true) as
  select l.tenant_id, l.centro_costo_id, cc.codigo as cdc, cc.nombre as cdc_nombre, cc.proyecto_id,
         to_char(a.fecha, 'YYYY-MM') as mes,
         sum(l.debe - l.haber) filter (where l.cuenta_codigo like '6%') as gasto,
         sum(l.haber - l.debe) filter (where l.cuenta_codigo like '7%') as ingreso,
         sum(l.debe - l.haber) filter (where l.cuenta_codigo like '40111%') as igv_neto,
         sum(l.haber - l.debe) filter (where l.cuenta_codigo like '42%') as por_pagar_saldo,
         sum(l.debe - l.haber) filter (where l.cuenta_codigo like '12%') as por_cobrar_saldo,
         count(distinct a.id) as asientos
    from public.asientos_lineas l
    join public.asientos_contables a on a.id = l.asiento_id and a.estado = 'validado'
    left join public.centros_costo cc on cc.id = l.centro_costo_id
   group by l.tenant_id, l.centro_costo_id, cc.codigo, cc.nombre, cc.proyecto_id, to_char(a.fecha, 'YYYY-MM');
grant select on public.v_contable_cdc to authenticated;

create or replace view public.v_contable_proyecto with (security_invoker = true) as
  select l.tenant_id, cc.proyecto_id, p.codigo as proyecto,
         coalesce(sum(l.debe - l.haber) filter (where l.cuenta_codigo like '6%'), 0) as gasto,
         coalesce(sum(l.haber - l.debe) filter (where l.cuenta_codigo like '7%'), 0) as ingreso,
         coalesce(sum(l.haber - l.debe) filter (where l.cuenta_codigo like '7%'), 0) - coalesce(sum(l.debe - l.haber) filter (where l.cuenta_codigo like '6%'), 0) as resultado,
         coalesce(sum(l.haber - l.debe) filter (where l.cuenta_codigo like '42%'), 0) as por_pagar_saldo,
         coalesce(sum(l.debe - l.haber) filter (where l.cuenta_codigo like '12%'), 0) as por_cobrar_saldo,
         count(distinct a.id) as asientos, max(a.fecha) as ultimo_asiento
    from public.asientos_lineas l
    join public.asientos_contables a on a.id = l.asiento_id and a.estado = 'validado'
    join public.centros_costo cc on cc.id = l.centro_costo_id and cc.proyecto_id is not null
    join public.proyectos p on p.id = cc.proyecto_id
   group by l.tenant_id, cc.proyecto_id, p.codigo;
grant select on public.v_contable_proyecto to authenticated;

-- ── 7. La cadena gana el eslabón contable ───────────────────────────────
drop function if exists public.proyecto_cadena(uuid);
create function public.proyecto_cadena(p_proyecto uuid)
returns table (
  proyecto_id uuid,
  presupuesto numeric, comprometido numeric, ordenes bigint,
  recepcionado numeric, recepciones bigint, ordenes_con_recepcion bigint,
  facturado numeric, facturado_en_tramite numeric, facturas bigint,
  pagado numeric, por_pagar numeric, por_pagar_vencido numeric, pagos bigint,
  valorizado numeric, valorizaciones bigint, cobrado numeric, por_cobrar numeric, cobrado_registrado numeric,
  inventario numeric, inventario_items bigint, inventario_entradas numeric, inventario_salidas numeric,
  contable_gasto numeric, contable_ingreso numeric, contable_resultado numeric, asientos bigint
)
language sql stable security invoker set search_path = public as $$
  with oc as (
    select o.id, o.proyecto_id, o.regimen_igv, o.moneda,
           (1 + case when coalesce(o.regimen_igv, 'gravado') = 'gravado' then 0.18 else 0 end) as igv_f,
           case when o.moneda = 'USD' then coalesce(o.tipo_cambio, tc_vigente(o.fecha_emision::date)) else 1 end as tc_f,
           o.total
      from ordenes_compra o
     where o.proyecto_id = p_proyecto and o.estado in ('aprobada', 'recibida_parcial', 'recibida_total')
  ), rec as (
    select coalesce(sum(ri.valor_recibido * oc.igv_f * oc.tc_f), 0) as monto,
           count(distinct r.id) as n, count(distinct r.orden_id) as n_oc
      from recepciones r
      join oc on oc.id = r.orden_id
      left join recepcion_items ri on ri.recepcion_id = r.id
     where r.estado <> 'rechazado'
  ), fac as (
    select coalesce(sum(c.total * case when c.moneda = 'USD' then coalesce(c.tipo_cambio, tc_vigente(c.fecha_emision)) else 1 end)
                    filter (where coalesce(c.estado_flujo, 'recibida') in ('conforme', 'programada_pago', 'pagada')), 0) as aceptado,
           coalesce(sum(c.total * case when c.moneda = 'USD' then coalesce(c.tipo_cambio, tc_vigente(c.fecha_emision)) else 1 end)
                    filter (where coalesce(c.estado_flujo, 'recibida') in ('recibida', 'validada')), 0) as tramite,
           count(*) filter (where coalesce(c.estado_flujo, 'recibida') not in ('anulada', 'observada')) as n
      from comprobantes_pago c
     where c.proyecto_id = p_proyecto and c.direccion = 'recibido' and c.estado = 'activo'
  ), cxp as (
    select coalesce(sum(coalesce(nullif(x.monto_pagado, 0), case when x.pagado then coalesce(x.monto_presupuestado, x.monto_ejecutado, 0) else 0 end) * x.tc_aplicado), 0) as pagado,
           coalesce(sum(x.monto_pendiente * x.tc_aplicado) filter (where not x.pagado and x.origen <> 'proyectado'), 0) as pendiente,
           coalesce(sum(x.monto_pendiente * x.tc_aplicado) filter (where x.vencido and x.origen <> 'proyectado'), 0) as vencido,
           count(*) filter (where x.pagado or coalesce(x.monto_pagado, 0) > 0) as n
      from v_cxp x
     where x.proyecto_id = p_proyecto
  ), val as (
    select coalesce(sum(v.monto * case when v.moneda = 'USD' then tc_vigente(coalesce(v.fecha_presentacion, current_date)) else 1 end)
                    filter (where v.estado in ('presentada', 'aprobada', 'facturada', 'pagada')), 0) as valorizado,
           coalesce(sum(v.monto * case when v.moneda = 'USD' then tc_vigente(coalesce(v.fecha_pago, current_date)) else 1 end)
                    filter (where v.estado = 'pagada'), 0) as cobrado,
           count(*) filter (where v.estado in ('presentada', 'aprobada', 'facturada', 'pagada')) as n
      from valorizaciones v
     where v.proyecto_id = p_proyecto
  ), inv as (
    select coalesce(sum(s.valor_soles), 0) as valor, count(*) as items from v_stock_proyecto s where s.proyecto_id = p_proyecto
  ), invmov as (
    select coalesce(sum(m.costo_total_soles) filter (where m.tipo = 'entrada' and not m.revertido), 0) as entradas,
           coalesce(sum(m.costo_total_soles) filter (where m.tipo = 'salida' and m.motivo <> 'devolucion'), 0) as salidas
      from movimientos_inventario m where m.proyecto_id = p_proyecto
  ), cont as (
    select coalesce(sum(gasto), 0) as gasto, coalesce(sum(ingreso), 0) as ingreso, coalesce(sum(asientos), 0)::bigint as asientos
      from v_contable_proyecto where proyecto_id = p_proyecto
  )
  select p.id,
         coalesce(p.presupuesto, 0),
         coalesce((select sum(oc.total * oc.tc_f) from oc), 0), (select count(*) from oc),
         rec.monto, rec.n, rec.n_oc,
         fac.aceptado, fac.tramite, fac.n,
         cxp.pagado, cxp.pendiente, cxp.vencido, cxp.n,
         val.valorizado, val.n, val.cobrado, val.valorizado - val.cobrado, coalesce(p.monto_cobrado, 0),
         inv.valor, inv.items, invmov.entradas, invmov.salidas,
         cont.gasto, cont.ingreso, cont.ingreso - cont.gasto, cont.asientos
    from proyectos p, rec, fac, cxp, val, inv, invmov, cont
   where p.id = p_proyecto;
$$;
grant execute on function public.proyecto_cadena(uuid) to authenticated;

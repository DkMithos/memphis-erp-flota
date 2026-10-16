# 2026-10-16 · Sprint 5 (#9) · Carga del histórico "Administración/Viáticos/CONTROL DE VIAJES 2026.xlsx" a `viajes`.
# Lee el JSON perfilado del libro (hojas RESUMEN, CONTROL_VIAJES, PASAJES_RESERVAS, PASAJES_PASAJEROS; se genera con
# openpyxl desde la copia del scratchpad, nunca del original) y escribe `2-cargar-control-viajes.sql`: un DO block que
# crea los viajes (cerrados/en curso/rendidos tal como los tiene Shirley), su viajero con el adelanto recibido, la
# rendición histórica (un solo ítem resumen: el Excel no trae el detalle de comprobantes, viven en PDF) y los pasajes
# enlazados por código de reserva. Marca origen_datos = 'excel-control-viajes'. Lo que no cruza se lista al final.
# Uso: python -X utf8 -I scripts/sprint5-viajes/1-generar-carga-control-viajes.py <viajes.json> > out.sql
import json, sys, re, collections
from datetime import date

src = sys.argv[1]
d = json.load(open(src, encoding='utf-8'))
T = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
KEVIN = 'de040564-3d98-45cf-8fb5-6383e1c95df6'   # solicitado_por del histórico (dueño del ERP); no hubo flujo de aprobación

PROY = {  # nombre del Excel → código del proyecto en el ERP (misma lógica que el mapa de CDC de la semana 1)
  'GORE CUSCO PATRULLEROS': '06CUSPNP25', 'AMAZONAS': '05AMAPNP25', 'GORE CUSCO AMBULANCIAS': '02CUSAMB25',
  'GORE HUANUCO': '03HNCPNP25', 'SAN MARTIN': 'SMARTBOM', 'GORE LORETO BOMBEROS': '04LORBOM25', 'MUNI CUSCO': '01CUSMUN24',
  'CUSCO HIDROAMBULANCIAS': '07CUSHAM26', 'BUSQUEDA DE NUEVOS PROYECTOS': None, 'PRESENTACION PROPUESTA': None,
}
USER = {  # trabajador del Excel → correo del usuario del ERP (si lo tiene)
  'LISBET MONTEZA': 'lmonteza@memphis.pe', 'HUMBERTO RAMIREZ': 'jramirez@memphis.pe', 'RICHARD NAVARRO': 'rnavarro@memphis.pe',
  'MIGUELANGEL CASTAÑEDA': 'mcastaneda@memphis.pe', 'SHIRLEY BUJAICO': 'sbujaico@memphis.pe', 'GUILLERMO MACHER': 'gmacher@memphis.pe',
  'GUSTAVO MONTERO': None, 'GABRIELA DUNN': None, 'NICOLAS ROJAS': None, 'ANTONIO REYES': None, 'MONICA CHUMAN': None, 'EXTERNOS': None, 'GERENCIA': None,
}
ESTADO = {'Cerrado': 'cerrado', 'En curso': 'en_curso', 'Rendido': 'rendido', 'Planificado': 'aprobado'}
RES = {'Empresa reembolsa': 'empresa_reembolsa', 'Trabajador devuelve': 'trabajador_devuelve'}

def q(s):
    return 'null' if s is None or s == '' else "'" + str(s).replace("'", "''") + "'"
def n(x):
    try: return round(float(x or 0), 2)
    except Exception: return 0.0
def fecha(x):
    if not x: return None
    s = str(x)[:10]
    return s if re.match(r'^\d{4}-\d{2}-\d{2}$', s) else None
def hora(x):
    if not x: return None
    s = str(x)
    return s[:5] if re.match(r'^\d{2}:\d{2}', s) else None

res = [r for r in d['resumen'] if r[0]]
ctrl = [r for r in d['control'] if r[1]]
reservas = {r[0]: r for r in d['reservas'] if r[0]}
pasaj = collections.defaultdict(list)
for r in d['pasajeros']:
    if r[0] and r[1]: pasaj[r[0]].append((r[1], r[2]))

# código de viaje → códigos de reserva (hoja CONTROL_VIAJES, tipo Pasaje) y alojamientos
res_de_viaje = collections.defaultdict(set); aloj = collections.defaultdict(list); pagos = {}
for r in ctrl:
    cod_viaje, tipo, cod_res = r[1], (r[4] or '').strip(), (r[5] or '').strip()
    if tipo == 'Pasaje' and cod_res:
        res_de_viaje[cod_viaje].add(cod_res); pagos[cod_res] = (r[7], r[8])
    if tipo == 'Alojamiento':
        aloj[cod_viaje].append(r)

# Una misma reserva (código) puede estar en varios viajes (varios viajeros): el costo se prorratea entre ellos,
# como hace la hoja PASAJES_PASAJEROS; si no, el pasaje se contaría N veces.
compartida = collections.Counter()
for cod_viaje, cods in res_de_viaje.items():
    for c in cods: compartida[c] += 1

out = []
w = out.append
w("-- Generado por 1-generar-carga-control-viajes.py · histórico CONTROL DE VIAJES 2026 → viajes (origen_datos = 'excel-control-viajes')")
w("do $$ declare v_t uuid := '%s'; v_id uuid; v_pa uuid; v_rd uuid; v_n int := 0; v_proy uuid; v_cdc uuid; v_user uuid; begin" % T)
w("  if exists (select 1 from viajes where tenant_id = v_t and origen_datos = 'excel-control-viajes') then raise exception 'Ya cargado'; end if;")
sin_proy = []; sin_reserva = []; rd = 0; vistos = set()
for i, r in enumerate(res):
    cod, proy, trab, ori, dest, sal, ret, est, obs, pasajes_s, adel, rendido, dif, resultado, reemb, devol, pend, cierre = (list(r) + [None] * 18)[:18]
    if cod in vistos: continue
    vistos.add(cod)
    pcode = PROY.get((proy or '').strip())
    if (proy or '').strip() and pcode is None and (proy or '').strip() not in PROY: sin_proy.append((cod, proy))
    fs, fr = fecha(sal), fecha(ret)
    if not fs: fs = fr or '2026-01-01'
    if not fr or fr < fs: fr = fs
    dias = max(1, (date.fromisoformat(fr) - date.fromisoformat(fs)).days + 1)
    estado = ESTADO.get((est or '').strip(), 'cerrado')
    nombre = (trab or 'SIN NOMBRE').strip()
    email = USER.get(nombre)
    w("  -- %s · %s · %s" % (cod, nombre, proy))
    w("  v_proy := %s;" % ("(select id from proyectos where codigo = %s and tenant_id = v_t)" % q(pcode) if pcode else 'null'))
    w("  v_cdc := case when v_proy is not null then (select id from centros_costo where proyecto_id = v_proy and activo and tenant_id = v_t order by codigo limit 1) else (select id from centros_costo where codigo = 'OFCENTRAL' and tenant_id = v_t) end;")
    w("  v_user := %s;" % ("(select user_id from usuarios_tenant where email = %s and tenant_id = v_t limit 1)" % q(email) if email else 'null'))
    w("  insert into viajes (tenant_id, numero, proyecto_id, centro_costo_id, motivo, origen, destino, fecha_salida, fecha_retorno, requiere_pasajes, requiere_viaticos, con_hospedaje, estado, solicitado_por, solicitado_en, aprobado_en, presupuesto_viaticos, observaciones, origen_datos, cerrado_en)")
    motivo = 'Viaje a %s (%s)' % ((dest or '').strip() or '—', (proy or 'sin proyecto').strip())
    obs_full = ' · '.join(x for x in [(obs or '').strip() or None, 'Histórico del Excel CONTROL DE VIAJES 2026 (Administración); aprobaciones y comprobantes en papel/PDF'] if x)
    w("  values (v_t, %s, v_proy, v_cdc, %s, %s, %s, %s, %s, %s, %s, true, '%s', '%s', %s::timestamptz, %s::timestamptz, %s, %s, 'excel-control-viajes', %s)" % (
        q(cod), q(motivo), q((ori or 'LIMA').strip().upper()), q((dest or '—').strip().upper()), q(fs), q(fr),
        'true' if n(pasajes_s) > 0 else 'false', 'true' if n(adel) > 0 or n(rendido) > 0 else 'false',
        estado, KEVIN, q(fs), q(fs), n(adel), q(obs_full), ("%s::timestamptz" % q(fr)) if estado == 'cerrado' else 'null'))
    w("  returning id into v_id;")
    w("  insert into viaje_pasajeros (tenant_id, viaje_id, user_id, nombre, es_externo, dias, con_hospedaje, tarifa_diaria, viatico_calculado, viatico_solicitado, viatico_aprobado, adelanto_entregado, adelanto_fecha, adelanto_medio)")
    w("  values (v_t, v_id, v_user, %s, %s, %d, true, 0, %s, %s, %s, %s, %s, %s) returning id into v_pa;" % (
        q(nombre), 'true' if nombre in ('EXTERNOS',) else 'false', dias, n(adel), n(adel), n(adel), n(adel), q(fs) if n(adel) > 0 else 'null', "'histórico'" if n(adel) > 0 else 'null'))
    if n(rendido) > 0 or n(adel) > 0:
        rd += 1
        anio = fs[:4]
        rest = RES.get((resultado or '').strip(), 'cuadra')
        r_est = 'liquidada' if estado == 'cerrado' else ('aprobada' if n(rendido) > 0 else 'borrador')
        saldo = n(rendido) - n(adel)
        liq_medio = 'histórico' if r_est == 'liquidada' else None
        w("  insert into viaje_rendiciones (tenant_id, viaje_id, pasajero_id, numero, fecha, estado, entregado, gastado, saldo, resultado, presentada_en, aprobada_en, liquidada_en, liquidacion_medio, notas)")
        w("  values (v_t, v_id, v_pa, %s, %s, '%s', %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id into v_rd;" % (
            q('RD-%s-H%03d' % (anio, rd)), q(fr), r_est, n(adel), n(rendido), saldo, q(rest if n(rendido) > 0 else 'cuadra'),
            ("%s::timestamptz" % q(fr)) if n(rendido) > 0 else 'null', ("%s::timestamptz" % q(fr)) if r_est in ('aprobada', 'liquidada') else 'null',
            ("%s::timestamptz" % q(fr)) if r_est == 'liquidada' else 'null', q(liq_medio),
            q('Resumen del Excel: reembolso empresa %s · devolución trabajador %s · pendiente %s' % (n(reemb), n(devol), n(pend)))))
        if n(rendido) > 0:
            w("  insert into viaje_rendicion_items (tenant_id, rendicion_id, fecha, tipo_gasto, descripcion, comprobante_tipo, moneda, monto, tc, sustentado) values (v_t, v_rd, %s, 'otro', 'Rendición histórica (total del Excel; comprobantes en el Formato Único en PDF)', 'otro', 'PEN', %s, 1, true);" % (q(fr), n(rendido)))
    # reservas enlazadas por código
    for cod_res in sorted(res_de_viaje.get(cod, [])):
        rr = reservas.get(cod_res)
        if not rr: sin_reserva.append((cod, cod_res)); continue
        pago, origen_pago = pagos.get(cod_res, (None, None))
        pago_v = {'Transferencia': 'transferencia', 'Tarjeta': 'tarjeta', 'Efectivo': 'efectivo'}.get((pago or '').strip(), 'efectivo' if (rr[13] or '') == 'Efectivo' else 'pendiente')
        moneda = 'USD' if (rr[9] or '').strip() == 'US$' else 'PEN'
        tc = n(rr[11]) if moneda == 'USD' and n(rr[11]) > 0 else None
        w("  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, codigo_reserva, tipo, empresa, tramo, origen, destino, fecha_salida, hora_salida, fecha_llegada, hora_llegada, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)")
        w("  values (v_t, v_id, v_pa, %s, 'aereo', %s, %s, %s, %s, %s, %s, %s, %s, '%s', %s, %s, '%s', %s, '%s', %s, %s);" % (
            q(cod_res), q((rr[8] or '').strip() or None), q({'Ida': 'ida', 'Vuelta': 'vuelta', 'Multitramo': 'multitramo'}.get((rr[1] or '').strip(), 'multitramo')),
            q((rr[2] or '').strip() or None), q((rr[3] or '').strip() or None), q(fecha(rr[4])), q(hora(rr[5])), q(fecha(rr[6])), q(hora(rr[7])), moneda, round(n(rr[10]) / max(1, compartida[cod_res]), 2), tc if tc else 'null',
            pago_v, q((origen_pago or '').strip() or None), 'pagado' if pago_v != 'pendiente' else 'pendiente', q(fecha(rr[4])) if pago_v != 'pendiente' else 'null',
            q('Histórico Excel' + (' · costo prorrateado entre %d viajes que comparten la reserva' % compartida[cod_res] if compartida[cod_res] > 1 else ''))))
    for a in aloj.get(cod, []):
        moneda = 'USD' if (a[9] or '').strip() == 'US$' else 'PEN'
        tc = n(a[11]) if moneda == 'USD' and n(a[11]) > 0 else None
        pago_v = {'Transferencia': 'transferencia', 'Tarjeta': 'tarjeta', 'Efectivo': 'efectivo'}.get((a[7] or '').strip(), 'pendiente')
        w("  insert into viaje_reservas (tenant_id, viaje_id, pasajero_id, tipo, empresa, origen, destino, fecha_salida, moneda, costo, tc, pago, origen_pago, estado_pago, fecha_pago, observaciones)")
        w("  values (v_t, v_id, v_pa, 'hospedaje', %s, null, %s, %s, '%s', %s, %s, '%s', %s, '%s', %s, 'Histórico Excel · alojamiento');" % (
            q((a[6] or '').strip() or 'Alojamiento'), q((dest or '').strip().upper() or None), q(fecha(a[0])), moneda, n(a[10]), tc if tc else 'null', pago_v, q((a[8] or '').strip() or None),
            'pagado' if pago_v != 'pendiente' else 'pendiente', q(fecha(a[0])) if pago_v != 'pendiente' else 'null'))
    w("  v_n := v_n + 1;")
w("  raise notice 'viajes cargados: %', v_n;")
w("end $$;")
w("select count(*) viajes, count(*) filter (where estado='cerrado') cerrados, sum(presupuesto_viaticos) adelantos, (select count(*) from viaje_reservas r join viajes v on v.id=r.viaje_id where v.origen_datos='excel-control-viajes') reservas,")
w("       (select sum(costo_soles) from viaje_reservas r join viajes v on v.id=r.viaje_id where v.origen_datos='excel-control-viajes') pasajes_soles,")
w("       (select count(*) from viaje_rendiciones r join viajes v on v.id=r.viaje_id where v.origen_datos='excel-control-viajes') rendiciones,")
w("       (select sum(gastado) from viaje_rendiciones r join viajes v on v.id=r.viaje_id where v.origen_datos='excel-control-viajes') rendido")
w("  from viajes where origen_datos = 'excel-control-viajes';")
sys.stdout.write('\n'.join(out) + '\n')
sys.stderr.write('viajes %d · rendiciones %d · sin proyecto mapeado %s · reservas sin fila %s\n' % (len(vistos), rd, sin_proy, sin_reserva))

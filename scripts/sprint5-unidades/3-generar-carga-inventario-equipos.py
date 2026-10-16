# 2026-10-16 · Carga de "INVENTARIO DE EQUIPOS ACTUALIZADO.xlsx" (Logística, 17/08/2026) a `inventario_unidades`.
# Hojas que se cargan: UBICACIÓN DE STOCK (maestro, 1,058 filas: SUMTEC F002-5489/5675/5676 y otros), DKT Ica (300: 200
# lightman, 50 tablets, 50 faros), Equipos de emergencia Momarento (448: 112 kits de barra+sirena+mando+CPU), MEMPHIS (7).
# Las hojas San Miguel e Ica son subconjuntos del maestro (344 y 614 series coinciden) y NO se cargan aparte.
# Cruce con lo ya cargado de LA SIRENA (15/10): los 70 bodycams y las 40 tablets ya existen (se actualizan); los 200
# lightman "pendiente de serie" reciben su serie LM0001..LM0200 (DKT Ica); los 236 arneses sin serie se REEMPLAZAN por los
# 270 arneses con serie del maestro (240 en Almacén Ursula, 21 MP Cusco, 5 Independencia, 2 Panamericana, 2 oficina).
# Ubicación → estado: ALMACEN URSULA/LA SIRENA/OFICINA/MOMARENTO = en_almacen (almacén propio); PERDIDA ICA / EXTRAVIADO = baja
# (proyecto ICAPNP24); DEVOLUCIÓ A SUMTEC = devuelta (guía EG07-00000067, 20/10/2025); VENDIDO = baja; MP CUSCO, MDI*, INDEPENDENCIA,
# BZW718/INMUEBLE PANAMERICANA, SURCO/*, LORETO, SAN MIGUEL = entregada al proyecto. Kardex: entrada por artículo×almacén de todas
# las unidades y salida por las devueltas y bajas, así stock = en_almacen + instaladas + entregadas (diferencia 0).
# Uso: python -X utf8 -I 3-generar-carga-inventario-equipos.py inv_equipos.json costos.json > 4-cargar-inventario-equipos.sql
import json, sys, re, collections
d = json.load(open(sys.argv[1], encoding='utf-8'))
costos = json.load(open(sys.argv[2], encoding='utf-8'))
# series ya cargadas el 15/10 desde LA SIRENA (70 bodycams AZ96…, 40 tablets HVA5…): se actualizan, no se duplican
sir = json.load(open(sys.argv[3], encoding='utf-8'))
YA = set(s0.strip().upper() for s0 in (r['NÚMERO DE SERIE'] for r in sir if r.get('PRODUCTO') in ('BODYCAM', 'TABLET')) if s0 and s0.strip().upper() != 'NA')
T = 'e4b16a80-8500-418e-afaa-0e976b7d9b13'
FILE = 'INVENTARIO DE EQUIPOS ACTUALIZADO.xlsx (Logística, 17/08/2026)'
def q(s): return 'null' if s is None or s == '' else "'" + str(s).replace("'", "''") + "'"
def s(x): return (x or '').strip()

FACT = {'F002-005489': 'F002-5489', 'F002-5489': 'F002-5489', 'F002-005675': 'F002-5675', 'F002-5675': 'F002-5675', 'F002-005676': 'F002-5676',
        'F003-000067': 'F003-67', 'E001-40': 'E001-40', 'F001-4323': 'F001-4323', 'F001-1': 'F001-1', 'F001-2': 'F001-2', 'F001-3': 'F001-3'}
FECHA_FACT = {'F002-5489': '2024-05-29', 'F002-5675': '2024-06-30', 'F002-5676': '2024-06-30', 'F003-67': '2025-01-27', 'F001-1': '2024-10-28', 'F001-2': '2024-10-28', 'F001-3': '2024-10-31', 'E001-40': '2025-02-12', 'F001-4323': '2024-09-30'}
PROV_FACT = {'F002-5489': 'SUMTEC', 'F002-5675': 'SUMTEC', 'F002-5676': 'SUMTEC', 'F003-67': 'SUMTEC', 'F001-1': 'DKT', 'F001-2': 'DKT', 'F001-3': 'DKT', 'E001-40': 'VALTAR', 'F001-4323': 'MASTERTIRES'}
PROV_SQL = {'SUMTEC': "(select id from proveedores where codigo = 'PROV-0170')", 'DKT': "(select id from proveedores where codigo = 'PROV-0210')", 'MOMARENTO': "(select id from proveedores where codigo = 'PROV-0197')", 'VALTAR': "(select id from proveedores where tenant_id = v_t and razon_social ilike 'VALTAR%' order by codigo limit 1)", 'MASTERTIRES': "(select id from proveedores where codigo = 'PROV-0118')"}
OC_SQL = lambda oc: "(select id from ordenes_compra where tenant_id = v_t and numero = %s)" % q(oc)
def oc_norm(x):
    x = s(x).split('/')[0].strip()
    m = re.match(r'^MM-0*(\d+)', x)
    return 'MM-%06d' % int(m.group(1)) if m else None

# ubicación → (estado, almacen_codigo, proyecto_codigo, documento, fecha_salida, nota)
def destino(u):
    u = s(u).upper()
    if u in ('ALMACEN URSULA', 'ALMACÉN URSULA'): return ('en_almacen', 'ALM-003', None, None, None, None)
    if u == 'ALMACEN LA SIRENA': return ('en_almacen', 'ALM-002', None, None, None, None)
    if u == 'OFICINA MEMPHIS': return ('en_almacen', 'ALM-001', None, None, None, None)
    if u == 'MOMARENTO': return ('en_almacen', 'ALM-004', None, None, None, None)
    if u in ('PERDIDA ICA', 'EXTRAVIADO'): return ('baja', None, 'ICAPNP24', 'Pérdida en Ica (Excel de Logística)', '2026-08-17', 'Perdida/extraviada en el proyecto Ica según INVENTARIO DE EQUIPOS; fecha de baja = fecha del archivo')
    if u.startswith('DEVOLUCI'): return ('devuelta', None, None, 'EG07-00000067', '2025-10-20', 'Devuelta a SUMTEC (hoja DEVOLUCIÓN SUMTEC de LA SIRENA: 166 bodycams, 20/10/2025)')
    if u == 'VENDIDO': return ('baja', None, None, 'Vendido', '2026-08-17', 'Vendido según INVENTARIO DE EQUIPOS; fecha = fecha del archivo')
    if u == 'MP CUSCO': return ('entregada', None, '01CUSMUN24', 'Entrega MP Cusco (Excel de Logística)', None, None)
    if u.startswith('MDI') or u == 'INDEPENDENCIA': return ('entregada', None, 'MDI', 'Entrega MDI (Excel de Logística)', None, 'Garantía' if 'GARANT' in u else ('Adicional' if 'ADICIONAL' in u else None))
    if u.startswith('BZW718'): return ('entregada', None, 'INMPAN', 'Instalado en camioneta BZW718 (Inmuebles Panamericana)', None, 'Placa BZW718')
    if u.startswith('SURCO'): return ('entregada', None, 'MSS-30', 'Entrega Surco (Excel de Logística)', None, u)
    if u == 'LORETO': return ('entregada', None, 'GLORETOSC', 'Entrega Loreto (Excel de Logística)', None, 'LORETO: 29 kits = GORE Loreto Seguridad Ciudadana (29 camionetas); confirmar')
    if u == 'SAN MIGUEL': return ('entregada', None, 'MPSANMIGUEL', 'Entrega San Miguel (Excel de Logística)', None, None)
    raise SystemExit('ubicación sin mapa: ' + u)

def costo_de(modelo):
    m = s(modelo)
    for k, v in costos.items():
        if m.upper().startswith(k.upper()) or k.upper().startswith(m.upper().split('(')[0].strip()):
            return v
    return None

rows = []
M = 'BRAZALETE VELCRO REUTILIZABLE 2 PIEZAS'
seen = set()
for r in d['UBICACIÓN DE STOCK']:
    k = (s(r['PRODUCTO']).upper(), s(r[M]).upper(), s(r['NÚMERO DE SERIE']).upper())
    if k in seen: continue  # 16 filas repetidas del maestro (cámaras MP CUSCO)
    seen.add(k)
    rows.append(dict(producto=s(r['PRODUCTO']), modelo=s(r[M]), marca=s(r['MARCA']), serie=s(r['NÚMERO DE SERIE']), ubic=s(r['UBICACIÓN']), obs=s(r['OBSERVACIÓN']), oc=s(r['OC']), fact=s(r['Factura']), hoja='UBICACIÓN DE STOCK'))
for r in d['DKT Ica']:
    rows.append(dict(producto=s(r['PRODUCTO']), modelo=s(r['MODELO']), marca=s(r['MARCA']), serie=s(r['NÚMERO DE SERIE']), ubic=s(r['UBICACIÓN']), obs=' · '.join(x for x in [s(r['OBSERVACIÓN']), ('IMEI ' + s(r['IMEI'])) if s(r['IMEI']) else ''] if x), oc=s(r['OC']), fact=s(r['FACTURA']), hoja='DKT Ica'))
for r in d['Equipos de emergencia Momarento']:
    rows.append(dict(producto=s(r['PRODUCTO']), modelo=s(r['MODELO']), marca=s(r['MARCA']) or 'MOMARENTO', serie=s(r['NÚMERO DE SERIE']), ubic=s(r['UBICACIÓN']), obs='', oc='', fact='', hoja='Equipos de emergencia Momarento'))
for r in d['MEMPHIS']:
    rows.append(dict(producto=s(r['PRODUCTO']), modelo=s(r['MODELO']), marca=s(r['MARCA']), serie=s(r['NÚMERO DE SERIE']), ubic=s(r['UBICACIÓN']), obs='', oc='', fact='', hoja='MEMPHIS'))

# artículos por (producto, modelo)
arts = {}
for r in rows:
    key = (r['producto'].upper(), r['modelo'].upper())
    if key not in arts:
        c = costo_de(r['modelo']) if r['modelo'] else None
        nombre = r['producto'].capitalize() if r['producto'].isupper() else r['producto']
        nombre = nombre[0].upper() + nombre[1:]
        for sig in ('NVR', 'SSD', 'HDD', 'LCD', 'CPU', 'LED', 'GPS'):
            nombre = ' '.join(sig if w.upper() == sig else w for w in nombre.split(' '))
        mod_u, prod_u = r['modelo'].upper(), r['producto'].upper()
        if r['modelo'] and prod_u in mod_u: nombre = r['modelo']            # 'MANDO DEL E. EMERGENCIAS' ya contiene el producto
        elif r['modelo'] and mod_u not in prod_u: nombre = nombre + ' ' + r['modelo']
        arts[key] = dict(nombre=nombre[:120], marca=(r['marca'] or (c[2] if c and c[2] else '') or None), modelo=r['modelo'] or None,
                         precio=(c[1] if c and c[1] else 0), moneda='USD' if c and c[1] else 'PEN', var='a%d' % (len(arts) + 1))
# los 4 artículos ya existentes de LA SIRENA
EXIST = {('BODYCAM', 'DS-MCW407 128/GLE(D)(O-STD)'): 'ART-0002', ('ARNES', 'DS-MH1711HM(O-STD)'): 'ART-0003', ('LIGHTMAN', 'LED ROJO'): 'ART-0004', ('TABLET', 'P11'): 'ART-0005'}

out = []; w = out.append
w("-- Generado por 3-generar-carga-inventario-equipos.py · %s → inventario_unidades (origen = 'excel-inventario-equipos')" % FILE)
w("do $$ declare v_t uuid := '%s'; v_id uuid; v_mov uuid; v_alm uuid; v_art uuid; v_n int := 0; v_k int := 0; v_veh uuid;" % T)
w("  " + " ".join("%s uuid;" % a['var'] for a in arts.values()))
w("  r record;")
w("begin")
w("  if exists (select 1 from inventario_unidades where tenant_id = v_t and origen = 'excel-inventario-equipos') then raise exception 'Ya cargado'; end if;")
w("  -- almacenes nuevos")
w("  insert into almacenes (tenant_id, codigo, nombre, tipo, ubicacion, responsable, estado) select v_t, 'ALM-003', 'Almacén Ursula - Conde de Salvatierra 116', 'general', 'Calle Conde de Salvatierra 116, 3er piso, Lima', 'Logística', 'activo' where not exists (select 1 from almacenes where tenant_id = v_t and codigo = 'ALM-003');")
w("  insert into almacenes (tenant_id, codigo, nombre, tipo, ubicacion, responsable, estado) select v_t, 'ALM-004', 'Momarento (instalador, custodia)', 'general', 'Taller de Momarento', 'Logística', 'activo' where not exists (select 1 from almacenes where tenant_id = v_t and codigo = 'ALM-004');")
w("  select id into v_veh from vehiculos where tenant_id = v_t and replace(placa, '-', '') = 'BZW718' limit 1;")
w("  -- los 236 arneses 'pendiente de serie' de LA SIRENA se reemplazan por los 270 con serie del maestro (y su entrada al kardex)")
w("  delete from inventario_unidades where tenant_id = v_t and origen = 'excel-la-sirena' and serie is null and articulo_id = (select id from articulos where tenant_id = v_t and codigo = 'ART-0003');")
w("  update movimientos_inventario set revertido = true, notas = concat_ws(' · ', notas, 'Reemplazado el 16/10/2026 por la carga con serie de INVENTARIO DE EQUIPOS') where tenant_id = v_t and realizado_por = 'excel-la-sirena' and articulo_id = (select id from articulos where tenant_id = v_t and codigo = 'ART-0003');")
w("  update articulos set stock_actual = 0 where tenant_id = v_t and codigo = 'ART-0003';")
w("  update stock_almacen set cantidad = 0 where articulo_id = (select id from articulos where tenant_id = v_t and codigo = 'ART-0003');")
w("  -- artículos")
n_art = 0
for key, a in arts.items():
    if key in EXIST:
        w("  select id into %s from articulos where tenant_id = v_t and codigo = '%s';" % (a['var'], EXIST[key]))
    else:
        n_art += 1
        w("  insert into articulos (tenant_id, codigo, nombre, descripcion, unidad_medida, tipo, stock_actual, stock_minimo, precio_unitario, moneda, marca, modelo, activo, creado_por, origen)")
        w("  values (v_t, 'ART-' || lpad(((select coalesce(max(substring(codigo from '^ART-(\\d+)$')::int), 0) from articulos where tenant_id = v_t) + 1)::text, 4, '0'), %s, %s, 'unidad', 'equipo', 0, 0, %s, '%s', %s, %s, true, 'excel-inventario-equipos', 'excel-inventario-equipos') returning id into %s;" % (
            q(a['nombre']), q('Cargado de ' + FILE), a['precio'], a['moneda'], q(a['marca']), q(a['modelo']), a['var']))

w("  -- unidades")
kardex = collections.Counter(); salidas = collections.Counter()
lm_i = 0
for r in rows:
    key = (r['producto'].upper(), r['modelo'].upper()); a = arts[key]
    est, alm, proy, doc, fsal, nota = destino(r['ubic'])
    fact = FACT.get(r['fact']); fecha_in = FECHA_FACT.get(fact, '2026-08-17')
    prov = PROV_FACT.get(fact) or ('MOMARENTO' if r['hoja'].startswith('Equipos') else None)
    if est == 'devuelta' and not prov: prov = 'SUMTEC'
    c = costo_de(r['modelo']) if r['modelo'] else None
    usd = (c[1] if c and c[1] else None)
    obs = ' · '.join(x for x in [r['obs'], nota, 'Cargado de %s (hoja %s), ubicación "%s"' % (FILE, r['hoja'], r['ubic']), ('fecha de ingreso = fecha de la factura' if fact in FECHA_FACT else 'sin factura en el Excel: fecha de ingreso = fecha del archivo')] if x)
    alm_sql = ("(select id from almacenes where tenant_id = v_t and codigo = '%s')" % alm) if alm else ("(select id from almacenes where tenant_id = v_t and codigo = 'ALM-001')")
    veh_sql = 'v_veh' if r['ubic'].upper().startswith('BZW718') else 'null'
    est_sql = "case when %s is not null then 'instalada' else '%s' end" % (veh_sql, est) if veh_sql == 'v_veh' else "'%s'" % est
    proy_sql = ("(select id from proyectos where tenant_id = v_t and codigo = %s)" % q(proy)) if proy else 'null'
    serie = r['serie'] or None
    if key == ('LIGHTMAN', 'LED ROJO') and serie:
        # asignar la serie a una unidad 'pendiente de serie' ya cargada (200 de LA SIRENA), en orden
        w("  update inventario_unidades set serie = %s, observaciones = concat_ws(' · ', regexp_replace(coalesce(observaciones, ''), '^Pendiente de serie( · )?', ''), 'Serie tomada de %s (DKT Ica)'), actualizado_en = now()"
          "    where id = (select id from inventario_unidades where tenant_id = v_t and articulo_id = %s and serie is null and origen = 'excel-la-sirena' order by creado_en limit 1);" % (q(serie.upper()), FILE, a['var']))
        w("  if not found then raise exception 'sin lightman pendiente para %s'; end if;" % serie)
        continue
    if key in (('BODYCAM', 'DS-MCW407 128/GLE(D)(O-STD)'), ('TABLET', 'P11')) and serie and serie.upper() in YA:
        # ya existe de LA SIRENA: se confirma y se enlaza la OC, sin duplicar ni volver a mover el kardex
        w("  update inventario_unidades set observaciones = concat_ws(' · ', observaciones, 'Confirmada en %s'), orden_compra_id = coalesce(orden_compra_id, %s), actualizado_en = now()"
          "    where tenant_id = v_t and articulo_id = %s and upper(serie) = %s;" % (FILE, OC_SQL(oc_norm(r['oc'])) if oc_norm(r['oc']) else 'null', a['var'], q(serie.upper())))
        w("  if found then v_k := v_k + 1; end if;")
        continue
    w("  insert into inventario_unidades (tenant_id, articulo_id, serie, estado, almacen_id, proyecto_id, vehiculo_id, orden_compra_id, comprobante_id, proveedor_id, valor_usd, tipo_cambio, fecha_ingreso, fecha_salida, documento_salida, observaciones, origen, creado_por)")
    w("  values (v_t, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, null, %s, %s, %s, %s, 'excel-inventario-equipos', 'excel-inventario-equipos') returning id into v_id;" % (
        a['var'], q(serie.upper()) if serie else 'null', est_sql, alm_sql if est in ('en_almacen',) else alm_sql, proy_sql, veh_sql,
        OC_SQL(oc_norm(r['oc'])) if oc_norm(r['oc']) else 'null', ("(select id from comprobantes_pago where tenant_id = v_t and numero_completo = %s limit 1)" % q(fact)) if fact else 'null',
        PROV_SQL[prov] if prov else 'null', usd if usd else 'null', q(fecha_in), q(fsal), q(doc), q(obs)))
    w("  insert into inventario_unidades_mov (tenant_id, unidad_id, fecha, tipo, estado_nuevo, a, documento, notas, usuario) values (v_t, v_id, %s, 'ingreso', 'en_almacen', 'Ingreso (histórico)', %s, 'Carga histórica', 'excel-inventario-equipos');" % (q(fecha_in), q(fact)))
    if est != 'en_almacen':
        tipo = {'entregada': 'entrega', 'devuelta': 'devolucion', 'baja': 'baja'}[est]
        w("  insert into inventario_unidades_mov (tenant_id, unidad_id, fecha, tipo, estado_anterior, estado_nuevo, de, a, documento, notas, usuario) values (v_t, v_id, %s, %s, 'en_almacen', %s, 'Almacén', %s, %s, %s, 'excel-inventario-equipos');" % (
            q(fsal or fecha_in), q('instalacion' if veh_sql == 'v_veh' else tipo), est_sql, q(r['ubic']), q(doc), q(nota)))
    kardex[(a['var'], alm or 'ALM-001', fecha_in, usd or 0)] += 1
    if est in ('devuelta', 'baja'): salidas[(a['var'], alm or 'ALM-001', 'devolucion' if est == 'devuelta' else 'ajuste_negativo', fsal or fecha_in)] += 1
    w("  v_n := v_n + 1;")

w("  -- kardex por cantidad: entradas y salidas, para que stock = en_almacen + instaladas + entregadas")
for (var, alm, fecha, usd), n in kardex.items():
    w("  v_mov := kardex_registrar(v_t, %s, (select id from almacenes where tenant_id = v_t and codigo = '%s'), null, 'entrada', 'inicial', %d, %s, '%s', %s, 'unidades', 'INVENTARIO EQUIPOS 2026-08', null, null, null, 'Carga de %d unidades con serie desde INVENTARIO DE EQUIPOS ACTUALIZADO', %s, 'excel-inventario-equipos');" % (
        var, alm, n, usd if usd else 'null', 'USD' if usd else 'PEN', "tc_vigente(%s)" % q(fecha) if usd else 1, n, q(fecha)))
for (var, alm, motivo, fecha), n in salidas.items():
    w("  v_mov := kardex_registrar(v_t, %s, (select id from almacenes where tenant_id = v_t and codigo = '%s'), null, 'salida', '%s', %d, null, 'PEN', 1, 'unidades', 'INVENTARIO EQUIPOS 2026-08', null, null, null, 'Salida de %d unidades (%s) según INVENTARIO DE EQUIPOS', %s, 'excel-inventario-equipos');" % (
        var, alm, motivo, n, n, 'devolución a SUMTEC' if motivo == 'devolucion' else 'pérdida/venta', q(fecha)))
w("  raise notice 'unidades nuevas %, confirmadas %', v_n, v_k;")
w("end $$;")
w("select a.codigo, a.nombre, a.stock_actual, count(u.id) unidades, count(u.id) filter (where u.estado='en_almacen') en_alm, count(u.id) filter (where u.estado='entregada') entreg, count(u.id) filter (where u.estado='instalada') inst, count(u.id) filter (where u.estado='devuelta') dev, count(u.id) filter (where u.estado='baja') baja, count(u.serie) con_serie")
w("  from articulos a left join inventario_unidades u on u.articulo_id = a.id where a.tenant_id = '%s' and a.codigo <> 'ART-0001' group by a.id, a.codigo, a.nombre, a.stock_actual order by a.codigo;" % T)
sys.stdout.write('\n'.join(out) + '\n')
sys.stderr.write('filas %d · artículos nuevos %d · existentes %d\n' % (len(rows), n_art, len(arts) - n_art))

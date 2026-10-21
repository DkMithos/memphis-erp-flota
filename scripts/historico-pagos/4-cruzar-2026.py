# 2026-10-21 · Cruce ERP HIST-2026 (dump del MCP execute_sql: jsonb_agg(...) as hist con id,num,ref,mon,m,f,prov,cc,mov,comp,asi,compr,mov_doc)
# contra el Excel corregido de Contabilidad (salida de 3-extraer-2026-corregido.py), por moneda+monto+proveedor y luego OPE/fecha,
# NUNCA por número de fila (Contabilidad renumeró el ITEM). Salida: resumen por consola + plan.json con updates (OPE/CC/fecha),
# borrados (filas del ERP que ya no existen tal cual) e inserciones (filas nuevas del Excel); `hereda` lleva factura/compromiso de
# una fila borrada a las filas en que Contabilidad la partió (suma exacta). Uso: python -X utf8 -I 4-cruzar-2026.py <dump.txt> <corregido.json> <plan.json>
import json, re, sys, collections, unicodedata
H, X, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
raw = open(H, encoding='utf-8').read()
txt = json.loads(raw).get('result', raw)
m = re.search(r'<untrusted-data-([0-9a-f-]+)>\n(.*)\n</untrusted-data-\1>', txt, re.S)
hist = json.loads(m.group(2))[0]['hist']
ex = json.load(open(X, encoding='utf-8'))
def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper()
    return re.sub(r'[^A-Z0-9]', '', s)[:14]
def key(mon, monto, prov): return (mon, round(float(monto), 2), norm(prov))
hi = collections.defaultdict(list)
for h in hist: hi[key(h['mon'], h['m'], h['prov'])].append(h)
xi = collections.defaultdict(list)
for i, x in enumerate(ex): x['_i'] = i; xi[key(x['moneda'], x['monto'], x['proveedor'])].append(x)
pares = []; sin_excel = []; sin_erp = []
for k in set(hi) | set(xi):
    hs = list(hi.get(k, [])); xs = list(xi.get(k, []))
    # 1) mismo OPE
    for h in list(hs):
        c = [x for x in xs if x['ope'] == (h['ref'] or '')]
        if c:
            c.sort(key=lambda x: (x['fecha'] != str(h['f']),)); pares.append((h, c[0])); hs.remove(h); xs.remove(c[0])
    # 2) misma fecha
    for h in list(hs):
        c = [x for x in xs if x['fecha'] == str(h['f'])]
        if c: pares.append((h, c[0])); hs.remove(h); xs.remove(c[0])
    # 3) lo que quede del mismo grupo, por orden
    while hs and xs: pares.append((hs.pop(0), xs.pop(0)))
    sin_excel += hs; sin_erp += xs
upd = []
for h, x in pares:
    d = {}
    if (h['ref'] or '') != x['ope']: d['ope'] = (h['ref'], x['ope'])
    if x['cc'] and (h['cc'] or None) != x['cc']: d['cc'] = (h['cc'], x['cc'])
    if str(h['f']) != x['fecha']: d['fecha'] = (str(h['f']), x['fecha'])
    if d: upd.append(dict(id=h['id'], num=h['num'], mon=h['mon'], monto=float(h['m']), prov=h['prov'], mov=h['mov'], mov_doc=h['mov_doc'], comp=h['comp'], asi=h['asi'], fila=x['fila'], **d))
print('ERP:', len(hist), '· Excel:', len(ex), '· pares:', len(pares), '· ERP sin Excel:', len(sin_excel), '· Excel sin ERP:', len(sin_erp))
print('updates:', len(upd), '· OPE:', sum('ope' in u for u in upd), '· CC:', sum('cc' in u for u in upd), '· fecha:', sum('fecha' in u for u in upd))
print('  OPE con movimiento ya conciliado:', sum(1 for u in upd if 'ope' in u and u['mov']), '· con factura:', sum(1 for u in upd if 'ope' in u and u['comp']), '· con asiento:', sum(1 for u in upd if 'ope' in u and u['asi']))
print('CC cambios:', collections.Counter((u['cc'][0], u['cc'][1]) for u in upd if 'cc' in u))
print('fecha cambios (muestra):', [(u['num'], u['fecha']) for u in upd if 'fecha' in u][:8])
print('\nERP sin Excel (borrar):', len(sin_excel), 'PEN', round(sum(float(h['m']) for h in sin_excel if h['mon'] == 'PEN'), 2), 'USD', round(sum(float(h['m']) for h in sin_excel if h['mon'] == 'USD'), 2))
for h in sin_excel: print('  ', h['num'], h['mon'], h['m'], h['f'], (h['prov'] or '')[:35], h['ref'], 'MOV' if h['mov'] else '', 'FACT' if h['comp'] else '', 'ASI' if h['asi'] else '')
print('\nExcel sin ERP (insertar):', len(sin_erp), 'PEN', round(sum(x['monto'] for x in sin_erp if x['moneda'] == 'PEN'), 2), 'USD', round(sum(x['monto'] for x in sin_erp if x['moneda'] == 'USD'), 2))
for x in sin_erp: print('  ', x['fila'], x['moneda'], x['monto'], x['fecha'], (x['proveedor'] or '')[:35], x['ope'], x['cc'])
print('\nOPE updates (muestra):')
for u in [u for u in upd if 'ope' in u][:40]: print('  ', u['num'], u['mon'], u['monto'], (u['prov'] or '')[:30], u['ope'], 'mov_doc=', u['mov_doc'], 'FACT' if u['comp'] else '', 'ASI' if u['asi'] else '')
# herencia de factura/compromiso: una fila borrada con factura → las filas nuevas (mismo proveedor, moneda y fecha) que suman su monto
import itertools
hereda = []
for h in sin_excel:
    if not h['comp'] and not h['compr']: continue
    cand = [x for x in sin_erp if x['moneda'] == h['mon'] and norm(x['proveedor']) == norm(h['prov']) and x['fecha'] == str(h['f'])]
    objetivo = round(float(h['m']) * 100); hallado = None
    for n in range(1, min(len(cand), 6) + 1):
        for combo in itertools.combinations(cand, n):
            if sum(round(x['monto'] * 100) for x in combo) == objetivo: hallado = combo; break
        if hallado: break
    if hallado:
        for x in hallado: hereda.append(dict(fila=x['fila'], de=h['num'], comp=h['comp'], compr=h['compr'])); sin_erp_ids = None
        print('hereda', h['num'], h['m'], '→ filas', [x['fila'] for x in hallado])
    else: print('SIN HERENCIA', h['num'], h['m'], h['comp'])
json.dump(dict(hereda=hereda, upd=upd, borrar=[h['id'] for h in sin_excel], borrar_num=[h['num'] for h in sin_excel], insertar=[{k: v for k, v in x.items() if k != '_i'} for x in sin_erp]), open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

# 2026-10-21 · Lee "SEGUIMIENTO CARTAS FALTANTES MEMPHIS.xlsx" (General - PROYECTOS/02. PROYECTOS EN EJECUCIÓN; copiar antes al
# scratchpad) y produce un SQL que llama a correspondencia_importar(proyecto, origen, filas) por hoja. Una hoja = un proyecto
# (mapa por título de hoja). Fila 1 = título, fila 2 = cabecera, desde la 3 = datos; META/SUB META vacíos = continúa el anterior.
# "S/F" = sin fecha. Uso: python -X utf8 -I 1-extraer.py <xlsx> <salida.sql>
import openpyxl, warnings, json, sys, datetime, re
warnings.filterwarnings('ignore')
PROYECTO = {  # hoja → proyecto del ERP
    '2648922 PATRULLEROS': '6fb8525e-58b7-4936-8337-38d9585248c8',    # 06CUSPNP25 GORE CUSCO - PNP
    '2671067 CAMIONETAS PNP': '3892aafd-ddc3-4910-a7a8-89809541bbb2', # 05AMAPNP25 GORE AMAZONAS - PNP
    '2603112 HIDROAMBULANCIAS': 'dec97ef4-2b2a-442a-b158-a36f14776499', # 07CUSHAM26 GORE CUSCO - HIDROAMBULANCIAS
    '2623368 PATRULLEROS': 'cd49baae-b857-4c36-ab54-26ca1f2047bd',    # 03HNCPNP25 GORE HUÁNUCO - PNP
    '32 AMBULANCIAS': '9ba5ad0b-3710-40cb-ad82-324c03048fdd',         # 02CUSAMB25 GORE CUSCO - AMBULANCIAS
    '2652192 BOMBEROS': '4a72a7c0-f816-458e-b5b0-184823136107',       # 04LORBOM25 GORE LORETO - BOMBEROS
    '2619427 PATRULLEROS': 'b9301e09-447b-49d6-a8d6-8ae9ce1a2be4',    # 01CUSMUN24 MP CUSCO - SERENAZGO
}
ORIGEN = 'excel-seguimiento-cartas-2026-10'
def txt(v, n=600):
    if v is None: return None
    s = re.sub(r'[ \t]+', ' ', str(v)).strip()
    return s[:n] or None
def fecha(v):
    if isinstance(v, datetime.datetime): return v.date().isoformat()
    if isinstance(v, datetime.date): return v.isoformat()
    s = str(v or '').strip()
    m = re.match(r'^(\d{2})[/.-](\d{2})[/.-](\d{4})', s)
    return f'{m[3]}-{m[2]}-{m[1]}' if m else None
def col(hdr, *claves):
    for i, h in enumerate(hdr):
        hh = h.upper()
        if all(k in hh for k in claves): return i
    return None
wb = openpyxl.load_workbook(sys.argv[1], data_only=True, read_only=True)
out = ["-- Generado por scripts/correspondencia/1-extraer.py · " + datetime.date.today().isoformat()]
total = 0
for ws in wb.worksheets:
    pid = PROYECTO.get(ws.title.strip())
    if not pid: print('HOJA SIN PROYECTO:', ws.title); continue
    rows = list(ws.iter_rows(values_only=True))
    hdr = [str(h).strip() if h is not None else '' for h in rows[1]]
    ci = dict(meta=0, sub=col(hdr, 'SUB'), emisor=col(hdr, 'EMISOR'), asunto=col(hdr, 'ACCION'), receptor=col(hdr, 'RECEPTOR'),
              f_ing=col(hdr, 'FECHA', 'INGRESO'), f_rec=col(hdr, 'FECHA', 'RECEP'), num=col(hdr, 'N°'), tipo=col(hdr, 'TIPO'))
    filas = []
    for n, r in enumerate(rows[2:], start=3):
        if not any(v not in (None, '') for v in r): continue
        g = lambda k: (r[ci[k]] if ci[k] is not None and ci[k] < len(r) else None)
        filas.append(dict(fila=n, meta=txt(g('meta'), 200), sub_meta=txt(g('sub'), 200), emisor=txt(g('emisor'), 120), asunto=txt(g('asunto')),
                          receptor=txt(g('receptor'), 120), fecha_documento=fecha(g('f_ing')), fecha_recepcion=fecha(g('f_rec')),
                          numero_doc=txt(g('num'), 120), tipo=txt(g('tipo'), 60)))
    total += len(filas)
    print(ws.title, '→', len(filas), 'filas')
    j = json.dumps(filas, ensure_ascii=False).replace("'", "''")
    out.append(f"select '{ws.title}' as hoja, correspondencia_importar('{pid}', '{ORIGEN}', '{j}'::jsonb) as resultado;")
open(sys.argv[2], 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('total filas:', total, '→', sys.argv[2])

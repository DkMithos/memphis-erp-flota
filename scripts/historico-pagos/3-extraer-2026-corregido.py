# 2026-10-21 · Contabilidad entregó "Pagos acumulados 2026 con CC (1).xlsx" (corregido). Misma lógica que 1-extraer.py
# (hoja DATA, una transacción por moneda, CC Excel → código ERP) pero SOLO 2026, para recargar HIST-2026.
# Cruce previo contra el banco: los 597 números de operación del Excel cuadran al céntimo con los cargos BBVA 2026
# (ene-jul); solo 2 filas de febrero sin OPE (BBVA S/ 58,558.51 "comisiones bancarias" y US$ 1,383,755.57 sin categoría)
# no corresponden a ningún cargo y se EXCLUYEN hasta que Contabilidad diga qué son (ver docs/CONTEXTO-SESION.md 2026-10-21).
# Uso: python -X utf8 -I 3-extraer-2026-corregido.py <xlsx> <salida.json>
import openpyxl, warnings, json, datetime, re, collections, sys
warnings.filterwarnings('ignore')
CC = {
    'OFICINA CENTRAL': 'OFCENTRAL', 'OFICIAN CENTRAL': 'OFCENTRAL', 'GORE.ICA': 'GOREICAPNP', 'GOREI': 'GOREICAPNP',
    'GOREC-2 PATRULLEROS': 'GCUSCOPNP', 'GORECZC': 'GCUSCOPNP', 'CMSURCO': 'MSS-30', 'MSS-30': 'MSS-30', 'GOREC-AMB': 'GCUSCOAMBU',
    'GORE.LORETO.BOMBEROS': 'GLORETOBOM', 'GORE.IQUIT.BOMBEROS': 'GLORETOBOM', 'GORE-HUANUCO': 'GHUANUCOPNP', 'GORE_HUANUCO': 'GHUANUCOPNP',
    'MDI': 'MDI', 'GORE-AMAZONAS': 'GAMAZONPNP', 'GORE_AMAZONAS_ PATRULLERO PNP': 'GAMAZONPNP', 'MP CUSCO': 'MPCUSCOSERENAZGO', 'TI': 'SISTEMAS',
    'SAN MIGUEL': 'MPSANMIGUEL', 'LORETO AMB': 'GLORETOAMB', 'GOREC-HIDRO': 'GCUSCOHIDROAMB', 'SELVA I': 'CMSELVAI', 'DETRACCIONES': 'DETRACCIÓN',
    'INM PAN': 'INMPAN', 'CAPITAL TRABAJO': 'PRÉSTAMOS', 'COMERCIAL': 'MARKETING Y DESARROLLO', 'COMERCIAL HIDROAMBULANCIAS': 'MARKETING Y DESARROLLO',
    'C-OXI': 'C-OXI', 'GORE-ANCASH': 'GANCASHAMB', 'BRAVO 3': 'BRAVO 3', 'FLORIDA': 'TERRENOS EEUU', 'DEMO ISLA SEGURA': 'ISLASEGURA',
}
def cc(v):
    k = str(v or '').strip().upper()
    return CC.get(k), (str(v).strip() if v else None)
def fecha(v):
    if isinstance(v, datetime.datetime): return v.date().isoformat()
    if isinstance(v, datetime.date): return v.isoformat()
    s = str(v or '').strip()
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', s)
    if m: return f"{m[1]}-{m[2]}-{m[3]}"
    m = re.match(r'^(\d{2})[/-](\d{2})[/-](\d{4})', s)
    if m: return f"{m[3]}-{m[2]}-{m[1]}"
    return None
def num(v):
    if v is None or v == '': return None
    if isinstance(v, (int, float)): return round(float(v), 2)
    s = re.sub(r'[^0-9.,\-]', '', str(v))
    if not s: return None
    if ',' in s and s.rfind(',') > s.rfind('.'): s = s.replace('.', '').replace(',', '.')
    else: s = s.replace(',', '')
    try: return round(float(s), 2)
    except ValueError: return None
def txt(v, n=240):
    s = re.sub(r'\s+', ' ', str(v)).strip() if v is not None else ''
    return s[:n] or None
def ope(v):
    s = str(v or '').strip()
    return (s.zfill(10) if s.isdigit() else s.upper()) or None

ws = openpyxl.load_workbook(sys.argv[1], data_only=True, read_only=True)['DATA']
rows = list(ws.iter_rows(values_only=True))
out = []; sin_cc = collections.Counter(); excluidas = []
for r in rows[2:]:
    if not r or r[0] is None: continue
    item, ccx, cat, tipo, comp, razon, desc, pen, usd, o, fpago, mes, tipo_egreso = (list(r) + [None] * 13)[:13]
    f = fecha(fpago)
    if not f or not ope(o):
        excluidas.append((item, txt(razon, 40), num(pen), num(usd), 'sin fecha' if not f else 'sin OPE')); continue
    codigo, etiqueta = cc(ccx)
    if etiqueta and not codigo: sin_cc[etiqueta] += 1
    cambio = str(tipo_egreso or '').strip().upper() == 'CAMBIO DE MONEDA' or str(cat or '').strip().upper() == 'CAMBIO DE MONEDA'
    for moneda, monto in (('PEN', num(pen)), ('USD', num(usd))):
        if not monto: continue
        out.append({'origen': 'acumulado_2026_corregido', 'fila': int(item), 'fecha': f, 'moneda': moneda, 'monto': abs(monto),
                    'tipo': ('ingreso' if (cambio and moneda == 'USD') or monto < 0 else 'egreso'), 'cuenta': '806' if moneda == 'PEN' else '830',
                    'cc': codigo, 'cc_excel': etiqueta, 'categoria': txt(cat, 60) or 'Sin categoría', 'tipo_doc': txt(tipo, 40), 'comprobante': txt(comp, 40),
                    'proveedor': txt(razon, 160), 'descripcion': txt(desc), 'ope': ope(o), 'tc': None, 'detraccion': None, 'retencion': None, 'cambio_moneda': cambio})
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
tot = collections.Counter(); montos = collections.defaultdict(float)
for x in out: tot[(x['moneda'], x['tipo'])] += 1; montos[(x['moneda'], x['tipo'])] += x['monto']
print('filas:', len(out)); [print('  ', k, tot[k], round(montos[k], 2)) for k in sorted(tot)]
print('CC sin mapa:', dict(sin_cc), '· sin CC (vacío):', sum(1 for x in out if not x['cc_excel']))
print('excluidas:', excluidas)

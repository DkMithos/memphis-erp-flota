"""Convierte el CSV de constancias de detraccion de SUNAT (separador ;, latin-1) al JSON que lee 4-cargar-constancias.mjs.
Uso: python 3-constancias-csv-a-json.py "Detracciones D. 2024-2025-2026.csv" constancias.json
Quita las filas repetidas (el CSV acumula varias descargas)."""
import sys, csv, json
rows = list(csv.DictReader(open(sys.argv[1], encoding='latin-1'), delimiter=';'))
out, vistos = [], set()
for r in rows:
    k = json.dumps(r, sort_keys=True)
    if k in vistos: continue
    vistos.add(k)
    out.append({'constancia': r['Numero Constancia'].strip(), 'periodo': r['Periodo Tributario'].strip(), 'ruc': r['RUC Proveedor'].strip(), 'proveedor': r['Nombre Proveedor'].strip(),
                'fecha': r['Fecha Pago'].strip(), 'monto': r['Monto Deposito'].strip(), 'tipo_bien': r['Tipo Bien'].strip(), 'tipo_cp': r['Tipo de Comprobante'].strip(),
                'serie': r['Serie de Comprobante'].strip(), 'numero': r['Numero de Comprobante'].strip(), 'cuenta': r['Numero de Cuenta'].strip()})
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
print('filas', len(rows), 'unicas', len(out))

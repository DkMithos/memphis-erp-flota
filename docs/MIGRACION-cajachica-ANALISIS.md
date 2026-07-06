# Análisis — Migración Caja Chica → ERP

> Importación del Excel `Modelo caja chica 20251.xlsx` (1 hoja = 1 caja) a las tablas
> `cajas_chicas` + `gastos_caja_chica` del ERP. Sin push/deploy.
>
> **Estado: ✅ RE-MIGRACIÓN COMPLETA (2026-07-03) — corte 02/07/2026.**
>
> **Resultado v2 (wipe+reload):** 30 cajas (18 PEN + 12 USD) · 779 egresos · 113 ingresos ·
> **0 cajas descuadradas** (saldo por filas = Saldo Final del header en las 30) ·
> fechas 100% limpias (min 2025-09-24; se corrigieron seriales incl. CAJA 1 con fechas numéricas
> y un `27`→2026-02-27) · filas de totales embebidas detectadas y excluidas (3 variantes:
> "Total" en DESC, "Total" en ITEM, fila con ingreso+egreso a la vez) ·
> alias de CC normalizados a códigos del sistema (GOREC-AMB→GCUSCOAMBU, etc.) → **332 gastos
> con proyecto_id** · CAJA 19 SOLES queda **activa** (operación en el sistema desde el 01/07);
> las otras 29 cerradas. Export por caja en **formato modelo Excel** disponible en la UI
> (botón "Exportar modelo" en el panel de la caja). Cierre/reapertura de cajas en la UI.
>
> **Regla de negocio acordada:** el Excel se CONGELA al 02/07/2026; desde el 03/07 la
> caja chica se gestiona SOLO en el sistema (apertura → gastos → cierre).
>
> ~~Resultado v1 (2026-06-22): 27 cajas · 717 egresos · 103 ingresos.~~ (reemplazado por v2)
> Esquema `ingresos_caja_chica` creado (+ RLS `ti_ingresos_cc`); `migrado_de`/`migrado_id`
> añadidos a `cajas_chicas` y `gastos_caja_chica`. 0 huérfanos FK; **0 cajas descuadradas**
> (monto_disponible = monto_asignado − Σ egresos = saldo final del Excel en las 27).
> Egresos: S/214 536.78 + $33 545.55. Marcador `migrado_de='caja-excel-2025'`.
> Mapeo de `comprobante_tipo` al CHECK (factura/boleta/recibo/sin_comprobante); el TIPO DOC
> original se preservó en `categoria`. estado de caja = `cerrada`.

---

## 1. Archivo

`Downloads/Modelo caja chica 20251.xlsx` — 31 hojas: **17 cajas SOLES** (1, 3–18) +
**12 cajas DÓLARES** (1–12) + `PIVOT` + `Hoja1`. 288 KB.

**Tope a migrar (instrucción de Gerencia):** hasta **CAJA 11 DÓLARES** y **CAJA 17 SOLES**.
→ Se cargan **27 cajas**; se **excluyen** `CAJA 12 DÓLARES` y `CAJA 18 SOLES` (abiertas, en uso).

## 2. Estructura de cada hoja

Cabecera: `N° DE CAJA: ADMIxxx-AAAA`, `RESPONSABLE`, moneda (`Expresado en Soles/Dólares`),
y resumen `Saldo Inicial / Ingresos / Gastos / Saldo Final`.
Tabla de movimientos (fila 7 en adelante):
`ITEM · CENTRO DE COSTO · TIPO DOC · COMPROBANTE · RAZÓN SOCIAL · DESCRIPCIÓN · Ingreso · Egreso · FECHA DE PAGO`
- 1ª fila = `APERTURA DE CAJA` (ingreso = saldo inicial).
- Tipos doc: FACTURA, BOLETA, PLANILLA DE MOVILIDAD, DOCUMENTO SIN NUMERO, etc.
- `FECHA DE PAGO` viene como serial Excel (p.ej. 45924) → convertir a fecha.

## 3. Esquema ERP destino (ambas tablas vacías hoy, solo PK)

- **`cajas_chicas`**: `codigo`, `nombre`, `responsable`, `monto_asignado`, `monto_disponible`,
  `moneda` (PEN/USD), `estado`.
- **`gastos_caja_chica`**: `caja_id`(FK), `numero`, `descripcion`, `categoria`, `monto`, `moneda`,
  `fecha`, `beneficiario`, `comprobante_numero`, `comprobante_tipo`, `estado`, `notas`, `realizado_por`.
- ⚠️ El ERP hoy **solo modela egresos** (gastos). No hay tabla de ingresos.

### Decisión de Gerencia: MODELAR CADA INGRESO (no agregar)
Se preservará cada ingreso (apertura + reembolsos) con su detalle → se agrega una tabla nueva,
espejo de `gastos_caja_chica`. **Migración de esquema propuesta** (aditiva, con RLS multi-tenant
igual que el resto):

```sql
CREATE TABLE IF NOT EXISTS ingresos_caja_chica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  caja_id uuid NOT NULL REFERENCES cajas_chicas(id) ON DELETE CASCADE,
  numero text NOT NULL,
  descripcion text NOT NULL,
  tipo text NOT NULL DEFAULT 'reembolso',   -- 'apertura' | 'reembolso' | 'otro'
  monto numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'PEN',
  fecha date NOT NULL,
  origen text,                              -- razón social / quién aporta
  comprobante_numero text,
  comprobante_tipo text,
  centro_costo text,
  estado text NOT NULL DEFAULT 'registrado',
  migrado_de text, migrado_id text,
  creado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ingresos_caja_chica ENABLE ROW LEVEL SECURITY;
CREATE POLICY ing_caja_tenant ON ingresos_caja_chica
  USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE INDEX idx_ing_caja ON ingresos_caja_chica(caja_id);
```
*(El módulo de UI de Caja Chica deberá ampliarse luego para mostrar ingresos; fuera de alcance de la carga.)*

## 4. Mapeo propuesto (a confirmar)

**Caja (cajas_chicas):**
| ERP | Origen |
|---|---|
| codigo | `N° DE CAJA` (ADMIxxx-AAAA) |
| nombre | nombre de hoja (ej. "CAJA 1 SOLES") |
| responsable | `RESPONSABLE:` |
| moneda | SOLES→PEN, DÓLARES→USD |
| monto_asignado | Σ ingresos (apertura + reembolsos) — total fondeado |
| monto_disponible | Saldo Final del Excel |
| estado | `cerrado` (histórico) |

**Ingresos (ingresos_caja_chica) — una fila por movimiento con Ingreso > 0:**
| ERP | Origen |
|---|---|
| numero | `ITEM` |
| descripcion | `DESCRIPCIÓN` (ej. "APERTURA DE CAJA", "REEMBOLSO…") |
| tipo | `apertura` si es la 1ª fila, si no `reembolso` |
| monto | `Ingreso` |
| fecha | `FECHA DE PAGO` (serial→date; apertura puede no traer fecha) |
| origen | `RAZÓN SOCIAL` |
| comprobante_numero / tipo | `COMPROBANTE` / `TIPO DOC` |
| centro_costo | `CENTRO DE COSTO` |

**Egresos (gastos_caja_chica), una fila por movimiento con Egreso > 0:**
| ERP | Origen |
|---|---|
| numero | `ITEM` (o correlativo por caja) |
| descripcion | `DESCRIPCIÓN` |
| categoria | `TIPO DOC` (o "migrado" si vacío) — *categoria es NOT NULL* |
| monto | `Egreso` |
| fecha | `FECHA DE PAGO` (serial→date) |
| beneficiario | `RAZÓN SOCIAL` |
| comprobante_numero / tipo | `COMPROBANTE` / `TIPO DOC` |
| notas | `CENTRO DE COSTO` (el Excel trae CC por movimiento) |
| estado | `aprobado` (histórico ya ejecutado) |

✅ **Resuelto:** se modela cada ingreso en la tabla nueva `ingresos_caja_chica` (ver §3),
preservando el detalle por-movimiento. `monto_asignado` queda como total fondeado (Σ ingresos).

## 5. Volumen aproximado

~27 cajas · ~800 movimientos de egreso (las cajas van de 5 a 94 movimientos).
Marcador `migrado_de='caja-excel-2025'`. Método: rol temporal + pooler `aws-1` (idempotente).

## 6. Próximos pasos

- [x] ~~Tratamiento de ingresos~~ → **modelar cada ingreso** (tabla nueva `ingresos_caja_chica`).
- [ ] **Tras revisión del usuario:** aplicar la migración de esquema `ingresos_caja_chica` (§3).
- [ ] Generar `load-cajachica.sql` (27 cajas + egresos + ingresos) y cargar + verificar
      (saldo final por caja = monto_asignado − Σ egresos; FK; Σ por moneda).

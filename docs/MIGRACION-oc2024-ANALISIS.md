# Análisis — Histórico Excel "OC MEMPHIS MAQUINARIAS 2024.xlsx"

> Segunda fuente de la migración de compras: el Excel histórico (1 hoja = 1 OC/OS)
> que cubre las órdenes anteriores y paralelas a oc-system.
> Complementa la carga de oc-system ([`MIGRACION-oc-system-LOG.md`](MIGRACION-oc-system-LOG.md)).
>
> **Estado: ✅ CARGADO Y VERIFICADO (2026-06-22).** Sin push/deploy.
>
> **Resultado:** 505 órdenes (254 OC + 251 OS) · 1058 ítems · 11 proveedores nuevos
> (9 por RUC + 2 salvage). 0 huérfanos FK, 0 números duplicados. Rangos `MM-S-000002..177`
> y `MM-000001..416` (sin solape con oc-system 417-1031). Totales: USD $21 410 246.55 /
> PEN S/9 821 095.60. Marcador `migrado_de='oc-excel-2024'`.
> **Colisiones de número** (distintas órdenes con mismo número en origen): 11 preservadas con
> sufijo `-B`; 3 copias idénticas descartadas. **30 órdenes 417-569 omitidas** (ya en oc-system).
> **Centro de costo:** la columna C.C. por ítem viene vacía; se usó el prefijo del nombre de hoja.
> Tras el mapeo dado por Gerencia → **394 órdenes (78%) enlazadas** a un CC real, **111 sin CC**
> (91 hojas con nombre numérico de 2022-2023 sin prefijo + 20 prefijos pequeños/ambiguos).
> `centro_costo_texto` conserva el prefijo original en todas para trazabilidad.
>
> **Mapeo de prefijo → centro_costo aplicado (2026-06-22):**
> `OM→OFCENTRAL` · `ICA→GOREICAPNP` · `L→LORETOAMB` · `MI→MDI` · `IP→INMPAN` ·
> `CUSMS/CUSM→MPCUSCOSERENAZGO` · `GCUSCOAMB/GORE-C-AMB→GCUSCOAMBU` ·
> (`MSS`, `MDI`, `GAMAZONPNP`, `GHUANUCOPNP`, `GLOREBOMBE`… ya matcheaban exacto).
> **Ajustes de CC (2026-06-22, por Gerencia):** `MSS`→renombrado a **`MSS-30`** (39 órdenes);
> **`MPCUSCOPNP` fusionado en `MPCUSCOSERENAZGO`** (repunteadas las 5 tablas dependientes y eliminado
> el duplicado; quedó con 36 órdenes).
>
> **✅ CIERRE CC (2026-06-22): 505/505 órdenes con centro de costo (100%).** Gerencia devolvió
> `OC2024_pendientes_CC.xlsx` con las 111 asignadas → aplicado. Se crearon 3 CCs nuevos
> (`ISLASEGURA`, `MUNSMSERENAZGO`, `PDD`). **`GICAPATRUL` fusionado en `GOREICAPNP`** (canónico,
> 538 órdenes). **23 órdenes marcadas `estado='anulada'`** (detectadas por tab rojo / texto
> "anulada/vetado" en el Excel). Caja chica: CCs normalizados al catálogo según `cc comparativo.xlsx`
> (se añadió columna `centro_costo` a `gastos_caja_chica`; 3 etiquetas sin código operativo
> —COMERCIAL, GORECUSCOHIDRO, FLORIDA— se conservan como texto por indicación de Gerencia).

---

## 1. Archivo (versión COMPLETA)

`OneDrive/General - PROYECTOS/06. CARPETAS VARIAS/ORDENES DE COMPRA …/OC MEMPHIS MAQUINARIAS 2024.xlsx`
— **540 hojas · 8.76 MB · fechas 2022-06-26 → 2025-11-14.**
Extractor: `scripts/migration-oc/excel-extract.py` (por etiqueta).
*(Las copias en `pc1/` y `PROYECTOS - General/06…` estaban desactualizadas: 307 y 193 hojas.)*

## 2. Estructura del formulario

Header Memphis → `NO. ORDEN DE COMPRA/SERVICIO` + número → datos proveedor (PROVEEDOR/RUC/
DIRECCIÓN/TEL/CONTACTO/N.CUENTA) → `FECHA DE EMISIÓN`, `COTIZACIÓN`, `COMPRADOR`, `EMAIL` →
tabla ítems `IT·DESCRIPCIÓN·CANT·UND·C.C.·P.UNIT·DCTO·P.U.NETO·TOTAL` (**CC por ítem**) →
`SUBTOTAL·IGV·VALOR VENTA·PERCEPCIÓN·TOTAL` (símbolo `$`/`S/`) → `CONDICIÓN/LUGAR/MODO`, `MONEDA`.

## 3. Extracción (540 hojas → 538 órdenes reales + hoja CLIENTES)

| Métrica | Valor |
|---|---|
| Órdenes reales | **538** |
| Doc-type por etiqueta | servicio **270** · compra **268** |
| Moneda | USD **282** · PEN **257** (1 sin fecha contada aparte) |
| Ítems | 1133 |
| RUCs válidos distintos | 96 |
| Rango de fechas | 2022-06-26 → 2025-11-14 |

## 4. Dos formatos de número (clave para el dedup)

| Formato | Qué es | Cantidad | Rango |
|---|---|---|---|
| `MM-S NNNN` | serie servicio temprana (2022) | 92 | 2 → 177 |
| `MM-NNNNN` | secuencia principal (compra+servicio) | 446 | 1 → 569 |

La secuencia `MM-NNNNN` es **única** (no hay series separadas por doc-type); el `MM-S` es
una serie distinta y temprana. Verificado: `MM-00417` (hoja GAMAZONPNP417, MSCA, CC GAMAZONPNP)
**es la misma orden** que `MM-000417` ya migrada de oc-system.

## 5. Dedup vs oc-system → plan de carga

| Grupo | Cant. | Acción |
|---|---|---|
| `MM-S NNNN` (2–177) | 92 | **CARGAR** (no existe en oc-system) |
| `MM-NNNNN` **< 417** (1–416) | 415 | **CARGAR** (histórico, no en oc-system) |
| `MM-NNNNN` **417–1031** | 30 | **OMITIR** (ya migradas de oc-system; fuente viva autoritativa) |
| Anómalo `MM-002547` (hoja `OM257`) | 1 | **Corregir → MM-00257** (no existe otro 257; el nombre de hoja confirma) y cargar |

**→ A CARGAR: ~508 órdenes** (92 + 415 + 1 corregida) · **~1079 ítems**
(servicio 254 / compra 253 · USD 265 / PEN 242 · 0 sin fecha · 2 sin total).
**OMITIR: 30** duplicadas de oc-system (nums 417,418,480–507,569; el 495 aparece 2 veces en origen).

## 6. Proveedores

De los 96 RUCs del Excel: **87 ya existen** en el ERP (migrados de oc-system) y **9 son nuevos**
→ crear esos 9 (enlace por RUC al resto). Hojas sin RUC válido → salvage `EXT-`.

## 7. Decisiones de mapeo (a confirmar antes de cargar)

1. **`tipo`:** servicio→`'os'`, compra→`'oc'` (la tabla no tiene CHECK en tipo).
2. **`numero`:** normalizar 6 dígitos. `MM-00214`→`MM-000214`; `MM-S 0003`→`MM-S-000003`
   (se preserva el prefijo S para no colisionar con la secuencia principal).
3. **Centro de costo:** CC por ítem en el Excel → CC de la orden = CC dominante; preservar CC por
   ítem solo si se agrega columna a `orden_items` (hoy no existe; por ahora CC a nivel orden).
4. **`precio_total` ítem:** GENERATED → no se inserta.
5. **2 órdenes sin total** → cargar con total=0 y marcar para revisión, o excluir. (Propuesta: cargar.)
6. **Marcador:** `migrado_de='oc-excel-2024'` (independiente de `'oc-system'`).
7. **Método:** mismo patrón idempotente (UUID v5 + rol temporal BYPASSRLS + pooler `aws-1`).

## 8. Próximos pasos

- [ ] Confirmar decisiones §7. → [ ] Generar `load-excel.sql`. → [ ] Cargar + verificar (rangos,
      totales por moneda, FK, dedup) → [ ] Reporte de conciliación de la secuencia `MM-0001 → 001031`.

# Migración oc-system → ERP — Log de ejecución

> Registro de la migración de datos del portal legado **oc-system** (Firebase /
> Firestore, proyecto `oc-system-3910d`) al ERP Memphis (Supabase / PostgreSQL).
> Plan general: [`PENDIENTES.md`](PENDIENTES.md) (migración v3, export-first).
>
> **Estado: CARGA COMPLETADA Y VERIFICADA.** Sin `git push` ni deploy (trabajo local).
> Firebase **NO** se apagó: las órdenes > MM-001031 siguen vivas en el portal.
>
> **FASE 2 (2026-07-03): ✅ COMPLETADA.** Extracción fresca de Firestore y carga atómica:
> - **209 requerimientos** (+675 items) — serie RQ-xxxxx preservada (5 códigos duplicados
>   del legado desambiguados con sufijo -B).
> - **185/185 cotizaciones** (+687 items) — proveedor resuelto vía migrado_id/RUC/razón social
>   (el dedup por RUC de fase 1 dejaba 58 sin resolver; corregido con fase 2b).
> - **36 órdenes nuevas** MM-001032→MM-001067 (22/6→2/7, TC 3.40 en USD) + items.
> - **Sync de estados**: órdenes migradas que estaban `enviada` y ya se aprobaron/rechazaron
>   en el portal → actualizadas (quedan 3 genuinamente pendientes).
> - **Cadena restaurada**: 564 OCs enlazadas a su cotización; 181 cotizaciones a su requerimiento.
> - **Numeración continua**: el ERP ahora genera MM-NNNNNN (OC) / MM-S-NNNNNN (OS) / RQ-NNNNN (req)
>   continuando las series del legado (`ordenes-config.ts`, `requerimientos-config.ts`).
> Scripts: `4-extract-fresh.cjs`, `5-transform-fase2.py`, `6-load-fase2.mjs`, `7-fix-cot-proveedores.py`.

---

## 1. Alcance ejecutado

| Concepto | Valor |
|---|---|
| Fecha de carga | 2026-06-22 |
| Tope de órdenes | **MM-001031** (última generada el 19/06/2026) |
| Tenant destino | `e4b16a80-8500-418e-afaa-0e976b7d9b13` (Memphis Maquinarias) |
| Proyecto Supabase | `icmuqwgrjgjoebnwunnf` (sa-east-1, Postgres 17) |
| Marcador de lote | `migrado_de = 'oc-system'` (reversibilidad/trazabilidad) |

### Lo que SÍ se migró
- **Proveedores:** 127 (catálogo deduplicado por RUC + recuperados de órdenes)
- **Centros de costo:** 75 (deduplicados por nombre)
- **Órdenes de compra:** 590 (rango **MM-000417 → MM-001031**)
- **Ítems de orden:** 1220

### Lo que NO se migró (por decisión)
- Órdenes **> MM-001031** → siguen vivas en oc-system (Firebase no se apaga).
- **Transacciones financieras** (módulo Finanzas) → no se migran.
- **Cajas chicas** → pendiente (hasta caja 11 USD / 17 soles), espera Excel mejorado.
- **Histórico Excel "OC MEMPHIS 2024"** (2022–2025) → migración aparte, pendiente.
- **Requerimientos / cotizaciones** de oc-system → extraídos a JSON pero NO cargados
  (el ERP sigue generándolos vivos; se evaluará incorporación histórica después).

---

## 2. Método de carga (por qué así)

La carga **no** se hizo por `execute_sql` del MCP (los ~1.1 MB de SQL habrían
saturado el contexto) ni por conexión directa (`db.<ref>.supabase.co` **no
resuelve DNS** desde la máquina; el host directo es IPv6/no disponible).

Solución usada — **rol temporal + pooler IPv4**:
1. Se creó un rol efímero `oc_migrador` (`LOGIN`, `BYPASSRLS`) vía MCP, con
   `GRANT INSERT, SELECT` sobre las 4 tablas. Contraseña aleatoria, nunca commiteada.
2. Un loader Node (`pg`) cargó `load.sql` por el **pooler de sesión**
   `aws-1-sa-east-1.pooler.supabase.com:5432` (usuario `oc_migrador.<ref>`).
   - Nota: el tenant enruta por **aws-1** (aws-0 devuelve *"tenant not found"*).
3. `load.sql` va envuelto en `BEGIN; … COMMIT;` → se ejecuta como **una sola
   transacción atómica** (todo-o-nada). Tiempo de carga: **~1.4 s**.
4. Al terminar y verificar, el rol `oc_migrador` se **eliminó** (REVOKE + DROP ROLE).
5. `pg` se instaló con `npm install pg --no-save` → no toca `package.json` (no afecta deploy).

Scripts (gitignored, one-off, en `scripts/migration-oc/`):
- `1-extract.cjs` — extracción read-only de Firestore → `data/*.json`.
- `2-transform.cjs` — JSON → `data/load.sql` (UUID v5 deterministas).
- `3-load.cjs` — carga atómica vía pooler con el rol temporal.

---

## 3. Decisiones de transformación (trazabilidad)

- **UUIDs deterministas (v5):** proveedor=`uuid5('prov:'+_id)`, CC=`uuid5('cc:'+_id)`,
  orden=`uuid5('oc:'+_id)`, item=`uuid5('item:'+_id+':'+idx)`. Re-ejecutable sin duplicar.
- **Códigos de proveedor con offset (PROV-0101…):** el tenant ya tenía 7 proveedores
  **seed/demo** (PROV-0001…0007, RUCs falsos `2000000000X`) que chocaban con la única
  `(tenant_id, codigo)`. Los migrados arrancan en **PROV-0101** para no tocar ninguna
  fila existente. El código NO afecta el UUID → no rompe el FK de las órdenes.
- **Proveedores "salvaged" con RUC sintético `EXT-NNNN`:** vendors extranjeros
  (Supabase/Vercel/Anthropic/Google) no tienen RUC peruano real; oc-system les puso
  placeholders repetidos (`20000000001`) que (a) chocaban con la única `(tenant_id, ruc)`
  del seed y (b) habrían **fusionado vendors distintos**. Se les asigna RUC único `EXT-NNNN`
  y se deduplica por **nombre**, no por el RUC falso. Resultado: 8 vendors extranjeros
  distintos preservados (antes se fusionaban → más fidelidad, "no perder nada").
- **`precio_total` (ítems) NO se inserta:** es columna `GENERATED ALWAYS AS
  (cantidad * precio_unitario)`. Los totales financieros de la **orden**
  (subtotal/igv/total, con descuentos) sí se preservan desde el legado.
- **Normalización de estados:** `Rechazado→anulada`, `Pendiente→enviada`,
  `Aprobado/Pagado→aprobada`, resto→`enviada`.
- **Moneda:** `/dólar|usd/i → USD`, resto `PEN`.
- **Detracción, banco/cuenta seleccionada, comprador (email):** preservados en columnas
  nuevas de `ordenes_compra` (ver migración de esquema `20260612000000`).

---

## 4. Verificación post-carga

| Chequeo | Resultado |
|---|---|
| proveedores / CC / órdenes / ítems | 127 / 75 / 590 / 1220 ✅ |
| Órdenes USD / PEN | 462 / 128 ✅ |
| FK órdenes→proveedor inválidos | 0 ✅ |
| FK ítems→orden huérfanos | 0 ✅ |
| FK órdenes→CC inválidos | 0 ✅ |
| Números duplicados | 0 ✅ |
| Rango de números | MM-000417 → MM-001031 ✅ |
| Estados | 558 aprobada · 24 anulada · 8 enviada ✅ |

**Totales migrados**
- PEN: 128 órdenes — total **S/ 10 525 397.23** (IGV S/ 1 604 106.95)
- USD: 462 órdenes — total **$ 4 476 916.99** (IGV $ 682 860.98)

**Spot-checks**
- `MM-001031` (última): PERUANA DE MOTORES HG S.A.C · USD 223.02 · CC `GICAPATRUL` · 1 ítem.
- `MM-000417` (primera): MSCA SERVICIOS GENERALES E INMOBILIARIOS · PEN 892.08 · CC `GAMAZONPNP` · 1 ítem.

---

## 5. Asuntos menores conocidos (no bloquean; limpieza posterior)

1. **2 órdenes sin centro de costo:** `MM-000635` y `MM-000787` — venían con
   `centroCosto` vacío en oc-system. Se migraron con `centro_costo_id = NULL`
   (fidedigno). Asignar CC manualmente si se requiere.
2. **Proveedor "SUPABASE PTE. LTD." duplicado:** existe como catálogo (`PROV-0111`,
   ruc `SINRUC-0111`) y como salvaged (`PROV-0220`). Es una **duplicación cosmética**,
   no pérdida de dato. Consolidar manualmente si molesta en el directorio.
3. ~~**7 proveedores seed/demo** (PROV-0001…0007, RUCs `2000000000X`)~~ → **ELIMINADOS
   el 2026-06-22.** Tras verificar **0 referencias** en las 8 tablas que apuntan a
   `proveedores` (ordenes_compra, cotizaciones, recepciones, contratos_proveedores,
   evaluaciones_proveedores, talleres, equipos_biomedicos, mantenimientos_biomedicos),
   se borraron con `DELETE … WHERE migrado_de IS NULL`. El directorio queda con **127
   proveedores, todos reales** (migrado_de='oc-system'). Los códigos siguen en PROV-0101…0227
   (el offset quedó cosmético; renumerar a PROV-0001 es opcional y no necesario).
   **Pendiente menor:** 1 CC seed (`LIC-TI`) sigue en el tenant (no se tocó; el usuario
   pidió limpiar solo proveedores).

---

## 6. Reversibilidad

Toda la carga está marcada `migrado_de = 'oc-system'`. Rollback total:

```sql
DELETE FROM orden_items i USING ordenes_compra o
  WHERE i.orden_id = o.id AND o.migrado_de = 'oc-system';
DELETE FROM ordenes_compra WHERE migrado_de = 'oc-system';
DELETE FROM centros_costo  WHERE migrado_de = 'oc-system';
DELETE FROM proveedores    WHERE migrado_de = 'oc-system';
```

La carga es **idempotente** (`ON CONFLICT (id) DO NOTHING` + UUIDs deterministas):
re-ejecutar `3-load.cjs` no duplica nada.

---

## 7. Pendiente tras esta migración

- [ ] Cajas chicas (hasta 11 USD / 17 soles) — espera Excel mejorado del usuario.
- [ ] Histórico Excel "OC MEMPHIS 2024" (2022–2025).
- [ ] Backup de Firebase (export programado del sábado) — antes de apagar el portal.
- [x] ~~Limpieza de los 7 proveedores seed/demo~~ — **hecho 2026-06-22** (0 referencias, borrados).
- [ ] Limpieza del CC seed `LIC-TI` (opcional; pendiente de decisión).
- [ ] Implementación del modelo financiero proyecto-céntrico
      ([`DISENO-Modelo-Proyecto-Financiero.md`](DISENO-Modelo-Proyecto-Financiero.md)).
- [ ] `git push` / deploy: **pendiente de autorización explícita del usuario.**

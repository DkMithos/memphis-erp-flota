---
name: memphis-carga-excel
description: Cómo cargar al ERP Memphis un Excel o CSV de Contabilidad, Finanzas, Administración u Operaciones (SIRE, extractos BBVA, pagos acumulados, constancias SUNAT, obligaciones, seguimientos) sin romper la base. Úsalo cuando Kevin diga "carga", "sube", "importa" o "migra" datos desde SharePoint/OneDrive, o cuando haya que escribir un importador nuevo. Fija el guion: copia, lectura por nombre de columna, parseo peruano, dry-run con rollback, dedupe por clave natural, triggers, bitácora, verificación y limpieza.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Cargar Excel/CSV al ERP Memphis

Este guion ya se usó cuatro veces (pagos históricos 2024-2026, extracto BBVA, SIRE 2024-2026 + constancias,
obligaciones). Los scripts de referencia están en `scripts/historico-pagos/`, `scripts/sire-historico/` y
`scripts/obligaciones/`, `scripts/semana1-conexiones/` (conectar CDC→proyecto, proveedores desde el SIRE, CDC heredado) y `scripts/semana2-ingresos/` (valorizaciones reales desde RESUMEN PROYECTOS); los lectores de navegador en `src/lib/finanzas/bancos-bbva.ts` y
`src/lib/compras/sire.ts`. Antes de cargar lee `docs/PLAN-CARGA-DATOS-ERP.md` (qué puede romper cada dato).

## 1. Copiar y perfilar (nunca editar el original)

```bash
S="$SCRATCHPAD/carga/<tema>"; mkdir -p "$S"
cp "/c/Users/URSULA/OneDrive - MEMPHIS MAQUINARIAS S.A.C/<carpeta>/<archivo>.xlsx" "$S/"
```
- OneDrive da `PermissionError` o archivos a medias: copiar primero; `.xlsm` con dibujos → `read_only=True`.
- Perfilar con Python (`openpyxl`, `-X utf8 -I`): hojas, dimensiones, fila de cabecera, primeras filas,
  conteo por periodo/moneda/tipo. Con Node (`xlsx`) usar `createRequire('…/memphis-erp-flota/package.json')`
  para resolver el paquete desde el scratchpad.
- Los heredocs largos en Bash fallan en esta máquina ("unexpected EOF"): scripts de más de ~40 líneas se
  escriben con la herramienta Write y se ejecutan por ruta.

## 2. Leer por nombre de columna

- Normalizar cabeceras (minúsculas, sin acentos ni símbolos) y buscar por `includes`; columnas de una letra
  (`M`, `D`, `T/C`) por igualdad exacta. La cabecera puede no estar en la fila 1: buscarla en las 30 primeras.
- Un libro puede traer la misma data en varias hojas (propuesta SIRE, "BIENES Y DET", "COMPRAS A DECLARAR"):
  unir y deduplicar por clave natural, manda la hoja con más filas.
- Números peruanos: coma decimal y punto de millar (`numeroPeru` en `supabase/functions/flujo-import/flujo.ts`
  y `numero` en `bancos-bbva.ts`). Fechas: Date, serial de Excel, `dd/mm/aaaa` o ISO (`fechaISO`).
- Verificar que el nombre de la hoja y la cabecera digan lo mismo (BANCOS2026 tenía hojas "806" con cabecera
  de la 830): si difieren, avisar y mandar por el nombre.
- CC del Excel → código del ERP con un mapa explícito (OFICINA CENTRAL→OFCENTRAL, GORE-HUANUCO→GHUANUCOPNP…),
  guardando la etiqueta original en la descripción cuando no cruza.

## 3. Destino y claves

| Dato | Tabla | Clave natural | Marca de origen |
|---|---|---|---|
| Facturas | `comprobantes_pago` | tenant + RUC + tipo + serie + número (sin ceros) | `origen = 'sire'`, `periodo_sire` |
| Pagos históricos | `transacciones` | numero `HIST-AAAA-NNNN` | `referencia_tipo = 'historico_contabilidad'`, OPE en `referencia_numero` |
| Extracto | `movimientos_bancarios` | cuenta + OPE + fecha + importe | `origen_archivo = 'archivo · hoja'` |
| Constancias | `detracciones` | `numero_constancia` | `origen = 'sunat'` |
| Flujo | `flujo_compromisos` | reemplazo por área con `fuente = 'excel'` | `origen_archivo`, bitácora `flujo_importaciones` |
| Obligaciones | `obligaciones_financieras` / `_cuotas` | `OBL-AAAA-NNN` + número de cuota | `origen_archivo` |
| Caja chica, fianzas | ya se sincronizan solas (`excel-sync`, `fianzas-import`): **no recargar** | | |

Preferir la **función real** del ERP (`sire_importar_compras`, `bancos_importar_movimientos`,
`detracciones_importar_constancias`, `obligacion_guardar` + `obligacion_cuotas_fijar`): valida permisos,
dedupe y dispara los triggers correctos. Un `insert` directo solo si no hay función, y entonces hay que
decidir a propósito qué triggers deben o no correr (`app.sin_asiento` para años cerrados).

## 4. Dry-run con rollback, siempre

- Por el pooler `aws-1-sa-east-1.pooler.supabase.com:5432`, usuario `<rol>.icmuqwgrjgjoebnwunnf`, con Node
  `pg` (instalado en `$SCRATCHPAD/pgtool`). Rol temporal creado por MCP:
  `create role x login bypassrls password '…'` + `grant usage on schema public, auth, extensions` + grants
  select/insert/update/delete en tablas, secuencias y funciones. Al final: `revoke all … ; drop role x`.
  El rol MCP **no** puede dar membresía en `postgres` (`grant postgres to x` falla), así que nada de `set role postgres`: el
  rol temporal necesita además `grant temporary on database postgres` para las tablas temporales. Runner de referencia:
  `scripts/semana1-conexiones/dry.mjs archivo.sql [--commit]` ejecuta el script completo (con su `begin … rollback;` final) y muestra los SELECT.
- Para funciones que validan permisos: `select set_config('request.jwt.claims', '{"sub":"<uid>", …}', true)`
  dentro de la transacción. El `sub` puede ser un usuario QA temporal (se borra) o el Administrador si es solo
  lectura/atribución.
- `begin` → cargar en bloques de 150-200 filas → imprimir contadores (nuevas, ya existían, saltadas,
  enlazadas, sin proveedor) y una tabla de verificación → `rollback` en el primer pase, `commit` cuando los
  números cuadren con el archivo. Los subselects del mismo statement no ven lo que la función acaba de
  escribir: la verificación va en un statement aparte.
- Cuadrar contra el resumen del Excel (totales por año/mes/moneda) antes de confirmar.

## 5. Después de cargar

1. Verificar en la base: conteos por estado, enlaces (proveedor, CDC, proyecto, compromiso), nada "QA".
2. Si se creó usuario o rol temporal: borrarlos y comprobar `count = 0`.
3. Guardar el script en `scripts/<tema>/` con cabecera que diga fuente, fecha y cómo repetirlo.
4. Documentar en `docs/CONTEXTO-SESION.md`: fuente, filas, resultado, lo que quedó fuera y por qué, y qué
   debe hacer Contabilidad/Finanzas después (p. ej. revisar "históricas", fijar saldo inicial).
5. Decirle a Kevin qué NO se cargó y las decisiones tomadas (fechas aproximadas, estados inferidos).

## 6. Avisos que ya costaron tiempo

- La unicidad de facturas incluye el RUC: dos proveedores emiten `E001-13`.
- Pagos históricos: un OPE del banco paga varias facturas → conciliar por grupo (suma por OPE).
- USD con TC ≤ 1 en el Excel: se guarda 1 y los lotes usan `tc_vigente(fecha)`.
- Facturas de periodos cerrados sin pago identificado entran como `historica` (no suman deuda) con
  `p_corte = 'AAAAMM'`; nunca inventar estado "pagada".
- El Excel de flujo (BD CONTA, Flujo Administración) y los módulos nativos (OC, facturas, obligaciones) se
  duplican en el flujo hasta el corte por área: la pantalla Reconciliación los cruza.
- Resultados grandes del MCP (`execute_sql`) se guardan en un archivo: parsear el JSON externo (`result`) y
  luego el interno entre las marcas `untrusted-data`.

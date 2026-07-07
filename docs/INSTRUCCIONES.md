# INSTRUCCIONES DE KEVIN — registro vivo

> Todas las instrucciones/decisiones dictadas por Kevin. Se actualiza cuando da una nueva
> o modifica una existente. Norma cualquier trabajo en este proyecto.
> Última actualización: **2026-07-07**.

## Proceso de trabajo

| # | Instrucción | Desde | Estado |
|---|---|---|---|
| P1 | **Documentar todo** el trabajo (docs/ del repo) | inicio | vigente |
| P2 | **No perder nada de información** — migraciones fieles; ante duplicados, consolidar repuntando referencias, no borrar a ciegas | inicio | vigente |
| P3 | **Preferir backend sobre frontend** cuando sea posible (triggers, funciones SQL, edge functions) | inicio | vigente |
| P4 | El sistema es multitenant para **cientos/miles de usuarios concurrentes**: no debe fallar, buguearse, caerse ni romperse | inicio | vigente |
| P5 | ~~Sin push ni deploy~~ → **levantada el 2026-07-06**: ahora commit+deploy cuando Kevin lo pide | 2026-07-06 | reemplazada |
| P6 | **Commits: autor único Kevin Castillo** `<kcastillo@memphis.pe>`. En GitHub no debe aparecer ninguna herramienta como co-autor ni colaborador (sin "Co-Authored-By", sin "Generated with") | 2026-07-06 | vigente |
| P7 | **`docs/CONTEXTO-SESION.md` vivo**: actualizarlo al cerrar cada tarea o al ~90% del contexto de la sesión | 2026-07-07 | vigente |
| P8 | **Este documento (INSTRUCCIONES.md)**: registrar todas las instrucciones y actualizarlas conforme avancemos | 2026-07-07 | vigente |
| P9 | Editar siempre en ROOT primero, luego sync a worktrees (si aplica) | previo | vigente |

## Decisiones de negocio / datos

| # | Instrucción | Desde | Estado |
|---|---|---|---|
| N1 | **Códigos de proyecto reflejan el año de firma del convenio** (01CUSMUN24… ICAPNP24); fecha sale de BASE DOCUMENTARIA | 2026-07-03 | vigente |
| N2 | Proyectos en **buckets por fase** (idea/actos previos/ejecución/post-ejecución) **y** situación operativa (activo/suspensión/revisión/arbitraje) — ambos niveles | 2026-07-03 | vigente |
| N3 | Vista por año: **ambas** — cohorte por año de convenio (utilidad/contrato) y gasto por año calendario (fecha real de OC/caja) | 2026-07-03 | vigente |
| N4 | **TC USD→PEN: el del día de emisión de la orden** (API SUNAT/SBS); mientras no exista, TC por orden (migrados 3.40/3.45, fallback 3.40) | 2026-07-03 | vigente |
| N5 | Gasto de proyecto = **comprometido**: OCs aprobadas/en ejecución/completadas/recibidas + caja chica aprobada. Nunca OTs, nunca anuladas | previo | vigente |
| N6 | **Gastos fijos de asesoría** (Consultoría 10% + Contraprestación 5% + Venta CIPRL 4% + IR mensual 3.5%) sobre **Contrato Total**, en tabla backend, bloque aparte — no descuentan utilidad operativa | previo | vigente |
| N7 | Contrato Total = Valor Modificado = inversión inicial + adenda; **la adenda puede ser negativa** (ej. ICA) | 2026-07-03 | vigente |
| N8 | **Caja chica: Excel congelado al 02/07/2026** — desde el 03/07 la operación (apertura → gastos → cierre) es SOLO en el sistema | 2026-07-06 | vigente |
| N9 | Caja chica debe **exportarse en el mismo formato (modelo) del Excel** de Administración | 2026-07-06 | vigente |
| N10 | **Numeración continua del legado**: OC → MM-NNNNNN, OS → MM-S-NNNNNN, REQ → RQ-NNNNN | implementada 2026-07-06 | vigente |
| N11 | Proveedores **no domiciliados** (extranjeros) deben poder registrarse sin RUC peruano | 2026-07-06 | vigente |
| N12 | Proyectos **se actualizan desde los Excel que maneja Operaciones** (espejo + propagación de montos por CIU, cada 30 min) | 2026-07-06 | vigente |
| N13 | Las **cajas con saldo negativo están bien** (fieles al Excel — sobregiros reales); no corregirlas | 2026-07-06 | vigente |
| N14 | Los **gastos de caja sin proyecto son CCs internos** — correcto por diseño; no forzar atribución | 2026-07-06 | vigente |
| N15 | Proveedores con RUC inválido: **eliminarlos** → ejecutado como consolidación (9 duplicados eliminados repuntando referencias; 7 canónicos quedan) | 2026-07-06 | ejecutada |
| N16 | Regla de cierre ICA: cobrado = solo valorizaciones **con CIPRL emitido** (V1); V6 suma cuando emitan el suyo | 2026-07-07 | vigente |

## Flujo de trabajo acordado (sesiones)

1. Kevin navega el sistema y reporta bugs/problemas → se corrigen por lotes.
2. Cada lote: fixes → lint → build → verificación en preview (usuario QA temporal, luego se
   elimina) → actualizar CONTEXTO-SESION.md → commit (autor Kevin) → deploy → verificación
   en producción.
3. Plan de acción por fases en CONTEXTO-SESION.md §6 — se ejecuta en orden salvo que Kevin
   repriorice.

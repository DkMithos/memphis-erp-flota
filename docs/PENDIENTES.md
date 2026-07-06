# Memphis ERP — Pendientes acumulados

> Registro vivo de lo que queda por hacer. Se actualiza conforme avanzamos o se priorizan cosas nuevas.
> Última actualización: 2026-06-02

---

## 🔴 P1 — Críticos / alto valor

### Reforma del módulo Proyectos al modelo operativo real (OXI/IOARR)
**Contexto:** El equipo gestiona proyectos con un modelo muy concreto (5 fases con checkpoints, items físicos por lote, base documentaria estructurada, suspensiones/ampliaciones, cobranza, RACI). El ERP actual tiene un modelo genérico. La reforma alinea el ERP con la realidad.
- Nuevas tablas: `proyecto_items`, `proyecto_documentos_clave`, `proyecto_suspensiones`, `proyecto_ampliaciones`, `proyecto_fase_checkpoints`, `proyecto_fase_responsables`
- Nuevas columnas en `proyectos`: `ciu`, `tipo_inversion`, `doc_tecnico`, `fase_actual`, `estado_operativo`, `tipo_valorizacion`, `plazo_dias_total`, `fecha_acta_inicio`, `fecha_plazo_original/actual`, `monto_cobrado/pendiente`, `dias_penalidad`
- UI Proyecto 360 rediseñada con tabs alineados al flujo
- Vista Cartera segmentada por las 4 categorías
- Migrador automático desde el Espejo Excel

### Fase B — Tablero editable de Proyectos (inline)
Una vista tabla con celdas editables (click-edit-Tab) agrupada por estado, con Realtime colaborativo. Replica la fluidez del Excel para que el equipo migre del Excel al ERP.

### Approvals two-way (botones Aprobar/Rechazar dentro de Teams)
**Bloqueado:** espera Power Automate Premium (~1 mes desde 2026-06-02). La base (config + tabla `aprobaciones`) ya está lista.

### SharePoint docs por proyecto
Vincular cada proyecto/contrato a su carpeta de documentos en SharePoint. Necesita permiso Graph `Sites.ReadWrite.All` (Application) + admin consent.

### Power BI embebido
Dashboards ejecutivos en el módulo BI. Necesita confirmar licencia Power BI (Pro / PPU / Embedded capacity).

### Asistente IA / Copilot
Bot que responde sobre datos del ERP y genera reportes. Definir proveedor LLM (Claude/GPT) y presupuesto.

---

## 🟡 P2 — Documentos + IA

- **Word**: generar OCs, contratos, actas, valorizaciones desde plantillas. Necesita plantillas `.docx` base.
- **Excel**: exportar reportes / importar padrones a SharePoint. Reúsa permiso Graph de SharePoint.

---

## 🟢 P3 — Colaboración (Microsoft ecosistema)

- **Planner sync** — tareas del ERP ↔ Planner (el equipo migrará a Planner antes que al ERP)
- **Forms → ERP** — encuestas de evaluación de proveedores / satisfacción
- **Outlook/Calendar** — eventos de mantenimientos y vencimientos
- **Lists** — seguimientos ligeros tipo trámites

---

## ⚪ P4 — Nice to have

- OneDrive (adjuntos personales)
- OneNote (bitácoras técnicas)
- PowerPoint (presentaciones ejecutivas)
- Bookings (agendamiento de servicios)
- Places (reserva salas/escritorios)
- Loop (componentes colaborativos)

---

## 🛠 Mejoras menores que aparecieron en el camino

- **Desactivar Rolling Release de Vercel** (recomendado: elimina la fricción del canary 10% en cada deploy)
- **Mostrar el rol del creador** en el detalle de Requerimiento (hoy muestra solo el nombre)
- **Unificar `formatearMonto`** — hay módulos que aún hardcodean "S/" (cotizaciones, listas) que deberían reflejar la moneda real

---

## 🆕 Solicitudes nuevas pendientes de análisis (por priorizar)

### 🚨 URGENTE — Sistema de Multas e Infracciones de Flota (módulo en el ERP)

**Fuentes de referencia:**
- `~/Downloads/Monitor de Multas e Infracciones de Flota.docx`
- `~/Downloads/Sistema Automático de Monitoreo de Multas e Infracciones Vehiculares.docx`

**Decisión arquitectónica clave:**
NO construir app standalone (como sugieren ambos docs). Implementar como **módulo nuevo dentro del ERP**. Reúsa `vehiculos` (padrón), Entra ID SSO, RBAC, teams-notify + campanita, pg_cron, dashboard infrastructure. Solo lo nuevo: tablas multas + worker Python externo (Playwright) que el ERP orquesta.

**Arquitectura:**
- ERP orquesta: Edge Function `multas-orchestrator` (pg_cron 7/15/30d) → encola jobs en tabla `jobs_scraping`.
- Worker Python (Playwright) externo: corre en VM/Docker en infraestructura de Memphis, polea jobs, scrapea portales, postea resultados a Supabase REST con service role.
- Patrón provider: `providers/sat_lima.py`, `sutran.py`, `mtc.py`, `muni_*.py` — cada uno implementa `search_by_plate(plate)`.
- Alertas: reusan teams-notify + campanita.

**Tablas nuevas (7):**
- `portales_consulta` — SAT Lima, SUTRAN, MTC, muni_*, con config (frecuencia_dias, activo)
- `jobs_scraping` — cola de "consultar placa X en portal Y", estado pending/running/done/error
- `consultas_multas` — histórico inmutable: vehiculo_id, portal_id, fecha, cantidad, monto_total, json_resultado, hash_resultado
- `multas_detectadas` — cada multa individual con código_infracción, fecha, monto, estado, primera_detección, última_actualización
- `multa_eventos` — timeline por multa (detectada/monto_cambio/estado_cambio/pagada)
- `multa_alertas` — alertas activas: tipo, severidad, atendida, atendida_por
- `portal_credenciales` — encriptadas (si algún portal requiere login)

**Fases:**
1. **Fase 1 (1-2 sem):** Modelo + UI completa (lista, detalle por placa, alertas, admin de portales) + captura manual. El equipo puede usarlo SIN scraping aún.
2. **Fase 2 (1-2 sem):** Worker Python + provider SAT Lima end-to-end (Playwright + retries + manejo CAPTCHA + posteo a Supabase).
3. **Fase 3 (1 sem):** SUTRAN + MTC.
4. **Fase 4 (continuo):** Municipalidades (Cusco, Huánuco, Ica, San Martín, Loreto, Amazonas, otras). Cada una = un nuevo provider ~200 líneas.
5. **Fase 5 (1 sem):** Dashboard ejecutivo en el ERP + integración Power BI (cuando llegue P1).
6. **Fase 6 (continuo):** Reglas de alertas configurables, workflow de pago, reportes PDF gerencia.

**Decisiones pendientes de Memphis:**
- Dónde corre el worker (Windows Server / Ubuntu / Docker / VPS)
- ¿Portales requieren login? Si sí, cuentas de servicio dedicadas
- Volumen real de placas (250 vs 5,000) → afecta rate limiting
- Confirmación legal (autorizado a hacer consultas masivas de sus vehículos en leasing)
- Estrategia anti-CAPTCHA si los portales lo exigen (2Captcha ~US$0.5-2 por 1k consultas)

### 🚨 URGENTE — Descarga masiva de facturas recibidas (2023→hoy) + Kardex

**Objetivo doble:**
1. Descarga histórica de TODAS las facturas que proveedores emitieron a Memphis Maquinarias (RUC como receptor) desde 2023.
2. Generar kardex consolidado con la información de esas facturas.

**Contexto Perú:** desde 2014-2018 todas las facturas son electrónicas (CPE) en XML UBL 2.1. La fuente real es **SUNAT — SOL (Operaciones en Línea)**: login con RUC + Clave SOL → "Mis Comprobantes" → descarga mensual (ZIP de XMLs + Excel consolidado). Es la única vía que captura **todas** las facturas porque cada proveedor usa su propio PSE.

**Decisión clave (las "dos verdades"):**
- **Recepción** = evento físico (entró al almacén). Genera kardex.
- **Factura** = evento contable/tributario (qué pagas, qué va a IGV).
- El kardex correcto sale de **recepciones**, no de facturas, para evitar duplicados.
- Las facturas se vinculan a recepciones existentes; las facturas históricas SIN recepción registrada generan "entrada histórica por factura" (única forma de reconstruir saldos 2023→hoy).
- Facturas de servicios (peaje, alquileres, combustible no inventariable) NO generan kardex.

**Tablas nuevas (5):**
- `facturas_recibidas` — cabecera: serie, numero, fecha_emision, ruc_emisor, razon_social, tipo_doc (01/03/07/08), moneda, subtotal, igv, total, estado_sunat, hash_xml, url_xml, url_pdf, raw jsonb
- `factura_items` — líneas: factura_id, descripcion, unidad, cantidad, precio_unitario, total, codigo_producto, articulo_id (mapeo, nullable)
- `factura_oc_recepcion` — vínculos m-a-n: factura ↔ orden_compra ↔ recepcion (para resolver desfases reales)
- `factura_carga_batch` — trazabilidad de batches subidos: archivo, fecha_carga, cant_facturas, errores, usuario
- `mapeo_articulos` — diccionario aprendido "descripción del proveedor" → artículo del ERP (se mejora cada vez que el equipo confirma un mapeo)

**Fases:**
1. **Fase 1 (2-3 sem):** Modelo + parser XML UBL 2.1 + UI "Compras → Facturas Recibidas" (lista, detalle, importador drag&drop ZIP de SUNAT SOL) + vista de mapping artículos + vista de conciliación factura↔OC↔recepción.
2. **Fase 2 (1-2 sem):** Kardex desde facturas — generación automática de movimientos para items mapeados (sin duplicar si hay recepción), reconstrucción de saldos históricos por artículo, vista de Kardex + reporte de saldo a fecha X.
3. **Fase 3 (2 sem):** Sync continuo automático — reúsa el worker Python de Multas (Playwright + SUNAT SOL con cuenta de servicio), descarga el batch del mes en curso, alerta al equipo en Teams cuando llega nuevo batch.
4. **Fase 4 (1 sem):** Registro de Compras (IGV) formato SUNAT PLE para declaración mensual + integración con módulo Finanzas (vínculo con pagos) + cross-data con Proyectos (facturas asociadas a cada proyecto vía OC).
5. **Fase 5 (continuo):** Mapping aprendido con fuzzy matching + detección automática de artículos nuevos + sugerencias de mapping.

**Sinergia con Multas (importante):**
Ambos pedidos comparten infraestructura crítica:
- Worker Python con Playwright (uno solo sirve para multas Y SUNAT)
- Patrón orchestrator + jobs queue + posteo via REST
- Sistema de alertas (teams-notify + campanita ya construido)
- Patrón cargas históricas + sync continuo

**Programa de trabajo conjunto Multas + Facturas (6 sprints):**
| Sprint | Multas | Facturas |
|---|---|---|
| 1 | Modelo + UI + captura manual | Modelo + UI + import ZIP manual |
| 2 | — | Parser XML UBL 2.1 + kardex desde facturas |
| 3 | Worker Python infra (multipropósito) | Worker Python infra (mismo) |
| 4 | Provider SAT Lima | Provider SUNAT SOL |
| 5 | SUTRAN + MTC | Registro de Compras + integración Finanzas |
| 6 | Municipalidades + dashboards | Mapping aprendido + dashboards |

**Decisiones pendientes de Memphis:**
1. **RUC de Memphis Maquinarias** (para validar XMLs).
2. **¿Usan PSE?** (Nubefact, Facturación SUNAT, Defontana, BizLinks…). Si sí, puede haber API directa.
3. **Volumen estimado**: ¿facturas/mes? (10 / 100 / 1000) afecta esfuerzo de mapping.
4. **¿Qué documentos electrónicos?** Solo factura (01) o también boleta (03), NC (07), ND (08). Recomiendo factura + NC/ND para saldo correcto.
5. **¿Existe ya un kardex?** Si está en Excel hoy, espejear primero (mismo patrón que Proyectos).
6. **¿Mayoría son bienes o servicios?** Solo bienes van a kardex.
7. **¿Quién carga el histórico 2023-2025?** Manual (contador sube ZIPs mensuales) vs. automático desde el primer día (más esfuerzo de worker).
8. **Cuenta SUNAT SOL de servicio** para el worker (usuario secundario, no la clave personal del contador) — necesario en Fase 3.

### Descarga masiva de facturas emitidas a Memphis Maquinarias + Kardex
- Descarga masiva de todas las facturas emitidas a Memphis Maquinarias desde **2023**
- Generar **kardex** con la información extraída de las facturas
**Estado:** Pendiente de analizar tras el sistema de multas.

---

### 🚨 ALTA PRIORIDAD — Migración oc-system (portal de compras Firebase) → ERP

> **Decisión del negocio:** dejar de usar el portal `portal.memphismaquinarias.com` (oc-system,
> Firebase/GCP) y quedarse solo con el ERP. Análisis completo realizado 2026-06-11.
> **Es probablemente la migración con mejor retorno del backlog:** muda a los 12 usuarios de
> Compras al ERP, atacando directamente el problema de adopción que bloquea la entrega.

> ### ✅ ESTADO 2026-06-22 — Órdenes oc-system CARGADAS Y VERIFICADAS
> La **Fase 4 (oc-system, órdenes ≤ MM-001031)** ya se ejecutó y verificó en Supabase:
> **127 proveedores · 75 CC · 590 órdenes (MM-000417→MM-001031) · 1220 ítems**
> (462 USD / 128 PEN; 558 aprobadas / 24 anuladas / 8 enviadas). Integridad FK 100%, sin duplicados.
> Detalle completo, decisiones y rollback en **[`MIGRACION-oc-system-LOG.md`](MIGRACION-oc-system-LOG.md)**.
> Sin `git push` ni deploy (trabajo local). Firebase intacto (órdenes > 1031 siguen vivas).
>
> **✅ TAMBIÉN CARGADO (2026-06-22):**
> - **Histórico Excel OC 2024** (540 hojas): 505 órdenes + 1058 ítems + 11 proveedores nuevos.
>   30 omitidas por solape con oc-system. `migrado_de='oc-excel-2024'`. Ver
>   [`MIGRACION-oc2024-ANALISIS.md`](MIGRACION-oc2024-ANALISIS.md).
> - **Caja chica** (hasta 11 USD / 17 soles): 27 cajas + 717 egresos + 103 ingresos; tabla nueva
>   `ingresos_caja_chica`. `migrado_de='caja-excel-2025'`. Ver
>   [`MIGRACION-cajachica-ANALISIS.md`](MIGRACION-cajachica-ANALISIS.md).
> - **7 proveedores seed demo** eliminados (0 referencias).
>
> **Pendiente:** mapear prefijos de CC del OC 2024 (ICA, MI, L… → CCs reales), backup Firebase (sábado).

**Inventario real del legado (contado en Firestore con la service account):**
| Colección | Docs | Destino en el ERP |
|---|---|---|
| transaccionesFinancieras | 2,929 | `transacciones` (validar forma con Finanzas) |
| logs | 2,488 | archivo / auditoría |
| ordenesCompra | 533 | `ordenes_compra` + `orden_items` |
| requerimientos | 198 | `requerimientos_compra` |
| cotizaciones | 174 | `cotizaciones` |
| proveedores | 134 | `proveedores` |
| centrosCosto | 75 | `centros_costo` |
| solicitudesEdicion (sub) | 59 | — (ERP edita por estado) |
| condicionesPago | 16 | catálogo nuevo |
| usuarios | 12 | `profiles` (ya hay SSO Entra ID) |
| inventario / recepcionBienes | 0 | sin uso — no migran |

Total ~6,500 docs + Storage (PDFs cotizaciones, firmas manuscritas, comprobantes).
**El módulo Compras del ERP está vacío → importación limpia, sin colisiones.**

**🆕 Hallazgo 2026-06-11 — Excel histórico de OCs (analizado):**
`OC MEMPHIS MAQUINARIAS 2024.xlsx` (OneDrive, 8.6 MB): 540 hojas formato formulario,
~539 OCs **y OSs** (`MM-S NNNN`/`MM-NNNN`), rango real **2022-06-26 → 2025-11-14**.
Numeración continua con oc-system (Excel ~MM-0002..0416 manual → portal MM-000417..976).
Juntos = historia completa 2022→2026, ~1,070 docs. Incluye datos bancarios/contacto de
proveedores (enriquecen catálogo) + hoja CLIENTES (mapeo cliente→proyecto→CC).
Dedup necesario en ventana de solape ago–nov 2025. Esfuerzo adicional: +2-3 días.
⚠️ El portal oc-system está EN USO ACTIVO (OCs de hoy) → el corte requiere fecha coordinada.
⚠️ Instrucción del negocio: NO apagar Firebase; exportar todo primero, revisar y comparar.

**Plan de migración v3 (~2 semanas) — actualizado 2026-06-11:**
- **Fase 0 — Exportar TODO primero:** Firestore completo → JSON + Storage → respaldo local +
  SharePoint (incluye transaccionesFinancieras aunque no se migren). Firebase intocado.
- **Fase 1 — Esquema ERP** · **Fase 2 — Catálogos** (proveedores enriquecidos con Excel) ·
  **Fase 3 — Histórico Excel** (2022-2025) · **Fase 4 — oc-system** (2025-2026) ·
  **Fase 5 — Revisión/comparación cruzada + dedup** (reporte para Kevin) ·
  **Fase 6 — Corte coordinado con Compras** (portal queda en solo-lectura; apagado = decisión futura)

**Plan v2 anterior (referencia):**
- **Fase 0 — Esquema ERP (1-2 días):** catálogo `condiciones_pago`, campos detracción en
  `ordenes_compra` (cierra gap SUNAT), datos bancarios, mapeo de estados legacy.
- **Fase 1 — Catálogos (1 día):** proveedores (134, dedup por RUC), centros de costo (75,
  dedup por código), condiciones de pago (16), usuarios (12, email → profiles vía SSO).
- **Fase 2 — Documentos (3-4 días):** requerimientos (198) → cotizaciones (174 + PDFs de
  Storage) → OCs (533: items + historial + firmas como adjuntos de evidencia + vínculos).
- **Fase 3 — Cierre (2-3 días):** comprobantes de Storage; logs (2,488) como export JSON de
  archivo (no a tablas); validación cruzada con Compras; oc-system a solo-lectura;
  **export de respaldo de transaccionesFinancieras ANTES de decomisar** (seguro barato:
  al apagar Firebase esos 2,929 registros desaparecen); doble verificación 1-2 sem; decomisar.

**Fuera de alcance (decisión del negocio 2026-06-11):**
- ❌ `transaccionesFinancieras` (2,929) — NO se migran (solo export de respaldo pre-apagado)
- 📥 **Caja chica** — entrará vía Excel mejorado que Kevin compartirá → importador propio
  (workstream separado, no bloquea la migración)
- ❌ inventario / recepcionBienes (0 docs)

**Gaps del ERP que la migración vuelve requisito:**
- `detracciones` (ya estaba como gap SUNAT — ahora obligatorio)
- Catálogo `condiciones_pago`
- Datos bancarios por OC/proveedor
- Decisión sobre estados legacy (ej. "Pendiente de Gerencia Operaciones", rol inactivo)

**Opciones si NO se migra todo (evaluadas):**
- A. Congelar oc-system en solo-lectura como archivo (~$0, pero 2 sistemas y BI ciego a la historia)
- B. Exportar a Excel/ZIP en SharePoint y apagar Firebase (mínimo costo, consulta manual)
- **C. Híbrido recomendado:** migrar catálogos + documentos vivos (OCs sin pagar, reqs pendientes);
  archivar lo cerrado (~3 días, 80% del valor)
- D. Mantener ambos → descartada (doble fuente de verdad, mata la adopción)

---

## 📌 Decisiones estratégicas registradas (análisis 2026-06-11)

**¿Adoptar Firebase/GCP (stack del legado)?** NO. El ERP es relacional (60+ tablas, joins,
agregaciones SQL, RLS multi-tenant); Firestore no tiene joins ni SQL y su costo escala por
lectura. Migrar el ERP a Firebase = reescribir todo para terminar peor. Firebase queda solo
como fuente del ETL y luego se decomisa.

**¿Migrar a AWS?** NO por ahora. Cero valor visible para el usuario; pausaría el roadmap real.
Revisar solo si un cliente enterprise exige residencia de datos/VPC/SLA o se superan límites
de Supabase. Salida de emergencia existe: Supabase es Postgres open-source → self-host en AWS
posible sin reescribir la app.

**¿Qué falta para ser SaaS?** (la base multi-tenant ya existe: tenant_id + RLS + tenant demo KESA)
- Provisioning de tenants (hoy: SQL manual)
- Auth multi-IdP (SSO cableado al Entra ID de Memphis; otro cliente = otra config)
- Facturación/suscripciones (no existe nada: planes, cobro, asientos)
- Config de integraciones por tenant (TEAMS_WEBHOOK_URL y tenant default hardcodeados)
- Aislamiento reforzado (auditoría cross-tenant RLS, storage por tenant, rate limits)
- Staging + CI de migraciones
- Operación formal (SLA, restore probado, DR, status page) + material de cliente
- Estimado: 4–6 semanas DESPUÉS de terminar Memphis

**¿Listo para vender a otros clientes?** NO todavía — el primer cliente (Memphis) aún no lo
adoptó (2/16 usuarios). Secuencia: (1) migrar oc-system + Paquetes 1-2 de Memphis (~7-8 sem)
→ caso de éxito real; (2) SaaS-ificación (4-6 sem); (3) vender con Memphis como referencia.

---

## ✅ Hecho recientemente (para no perder el hilo)

- **Sprints QA hardening (corto + medio) completos** — repo limpio, 0 console.log en prod,
  tsconfig strict, code splitting (2.6→1.7 MB), 34 tests, eslint 0 errores, 4 bugs de hooks
  corregidos, 5 stores sin loading infinito, Sentry activo en producción (verificado)
- **Hardening de seguridad BD** — advisors Supabase: REVOKE en funciones SECURITY DEFINER,
  políticas RLS explícitas; 6/7 hallazgos resueltos, 1 aceptado (pg_net, no corregible)
- **Re-auditoría completa** — sistema verificado listo para visita de QA (ver AUDITORIA-QA-Codigo.md)

- SSO Entra ID + roles vía App Roles + gate "cuenta pendiente"
- Fix loading/logout (sin necesidad de limpiar caché)
- Notificaciones Teams (canal) vía Power Automate webhook
- Notificaciones programadas (cron de vencimientos)
- Campanita in-app del ERP conectada a las funciones
- Approvals one-way (Requerimientos + OCs + Caja Chica)
- Fundación de Approvals two-way (BD + tabla aprobaciones)
- Excel-sync — espejo de RESUMEN.xlsx del canal OPERACIONES2 + cron 30min + drawer ficha completa
- Roadmap completo del ecosistema Microsoft 365
- Documento de arquitectura

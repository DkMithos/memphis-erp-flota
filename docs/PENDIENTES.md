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

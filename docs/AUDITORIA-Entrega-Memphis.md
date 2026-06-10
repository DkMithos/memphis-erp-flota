# Auditoría de Entrega — Memphis Maquinarias

> Fecha de auditoría: 2026-06-10
> Cliente: Memphis Maquinarias S.A.C. (primer cliente del sistema)
> Estado del sistema: Producción en `erp.memphismaquinarias.com`

## 1. Inventario actual de datos en el sistema

| Recurso | Cantidad | Estado |
|---|---|---|
| Usuarios con perfil en el ERP | **2** (Kevin + Oscar) | 🔴 Solo 2 de 16 usuarios asignados en Azure han iniciado sesión |
| Roles asignados (RBAC) | 2 | 🔴 Falta el resto |
| Vehículos | **386** | 🟢 Incluye los 250 de GORE Ica |
| Documentos vehículos (SOAT, etc.) | 200 | 🟡 No llega a 1:1 con la flota |
| OTs (cerradas) | 433 / 433 | 🟢 Histórico de mantenimientos cargado |
| Proyectos ERP | **7** | 🔴 El Excel tiene 15 — el equipo sigue en Excel |
| Proyectos espejo desde Excel | 15 | 🟢 Sincronizando OK |
| Proveedores | 7 | 🔴 Muy pocos para una flota así |
| Requerimientos de compra | 1 | 🔴 Solo el de prueba |
| Equipos biomédicos | **0** | 🔴 Memphis tiene equipos biomédicos pero no están |
| Calibraciones biomédicas | 0 | 🔴 |
| Clientes CRM | **0** | 🔴 GORE Huánuco, Cusco, Loreto, etc. no están |
| Artículos inventario | **0** | 🔴 Sin artículos no hay kardex |
| Movimientos de kardex | 0 | 🔴 |
| Cotizaciones | 0 | 🔴 |
| Órdenes de compra | 0 | 🔴 Pese a 433 OTs cerradas |
| Transacciones financieras | **0** | 🔴 |
| Gastos caja chica | 0 | 🔴 |
| Asientos contables | **0** | 🔴 |

**Diagnóstico crudo:** Hoy el ERP tiene cargados Flota + parte de Mantenimientos + espejo Excel de Proyectos. Todo lo demás está vacío. El equipo no está usando el ERP — siguen en Excel y procesos manuales.

## 2. Bloqueadores duros (sin esto no se entrega)

### 2.1 Onboarding de usuarios
- 16 personas asignadas en Azure, solo 2 han entrado
- Faltan: comunicación oficial, capacitación (1h × 4 áreas), manual rápido, canal "Soporte ERP" en Teams

### 2.2 Reforma del módulo Proyectos (P1)
El modelo actual no refleja cómo el equipo trabaja. Sin la reforma (5 fases OXI/IOARR + items físicos + base documentaria + suspensiones + cobranza + RACI por fase + CIU + tipo inversión), el equipo seguirá en Excel.

### 2.3 Carga de datos maestros mínimos
- Clientes (CRM): las ~15 entidades del Estado
- Equipos biomédicos: los de las ambulancias contratadas
- Artículos de inventario: catálogo mínimo (50-100 de uso común)
- Proveedores: ampliar a 50-100 (hoy 7)

### 2.4 Pedidos urgentes pendientes
- Multas e Infracciones (módulo nuevo)
- Facturas + Kardex (módulo nuevo)

## 3. Bloqueadores funcionales (alto impacto)

- **Approvals two-way** — esperando Power Automate Premium (~1 mes)
- **SharePoint docs por proyecto** — P1 sin construir
- **Tablero editable de Proyectos (Fase B)** — para dejar el Excel realmente
- **Power BI embebido** — para gerencia

## 4. Bloqueadores de cumplimiento Perú

- Registro de Compras electrónico (SUNAT PLE) — declaración mensual de IGV
- Registro de Ventas electrónico (PLE)
- Plan Contable General Empresarial (PCGE) semilla
- Tipo de cambio oficial SBS
- Detracciones / Retenciones / Percepciones
- CIU / INVIERTE.PE en proyectos

## 5. Bloqueadores operativos

| Aspecto | Estado | Riesgo |
|---|---|---|
| Backups automáticos | Default Supabase diario | 🟡 Falta política formal de retención + prueba de restore |
| Monitoreo de errores | Solo console.logs | 🔴 Sin Sentry equivalente — errores invisibles |
| Performance/Carga | No testeado con volumen real | 🟡 386 OK, ¿5,000? |
| Mobile responsive | Construido, no validado en campo | 🟡 Richard/Humberto trabajan en campo |
| Rolling release Vercel | Cada deploy canary 10% | 🟡 Fricción operativa |
| Print/PDF de documentos clave | OCs/Contratos/Actas no generan PDF formal | 🔴 |
| Logs de auditoría completos | Sin tabla `auditoria` central | 🟡 |
| Plan de recuperación ante desastres | No documentado | 🔴 |

## 6. Bugs/UX pendientes (menores pero visibles)

- Rolling Release Vercel sin desactivar
- `formatearMonto` hardcoded a `S/` en cotizaciones, listas
- "Creado por" no muestra rol
- Dual imputación incompleta en algunos forms

## 7. Lo que SÍ está listo

- SSO Entra ID + App Roles + gate de acceso
- RBAC completo
- Notificaciones Teams + campanita
- Notificaciones programadas (cron)
- Approvals one-way (Req + OC + Caja Chica)
- Excel-sync con RESUMEN.xlsx
- Flota: 386 vehículos + 433 OTs + 200 docs
- Multi-tenant + RLS
- Stack moderno (React + Supabase + Vercel)
- Producción en `erp.memphismaquinarias.com`

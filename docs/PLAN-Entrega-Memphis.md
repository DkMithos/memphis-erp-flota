# Plan de Entrega — Memphis Maquinarias

> Plan de 3 paquetes para llevar el ERP de "demo funcional" a "sistema productivo entregado al cliente".

## Paquete 1 — "Soft launch" (2-3 semanas)

Lo MÍNIMO para que el equipo empiece a usar el ERP de verdad.

### 1.1 Onboarding humano
- [ ] Carga manual de los 14 perfiles restantes (que entren al menos 1 vez)
- [ ] Asignación correcta de roles en RBAC
- [ ] Sesión de capacitación 1h × 4 áreas (Flota / Proyectos / Compras / Gerencia)
- [ ] Manual rápido (5-10 páginas) en SharePoint
- [ ] Canal "Soporte ERP" en Teams

### 1.2 Datos maestros mínimos
- [ ] Clientes CRM (~15 entidades del Estado)
- [ ] Equipos biomédicos (de ambulancias contratadas)
- [ ] Catálogo básico de artículos (50-100 más usados)
- [ ] Ampliar proveedores a 30-50

### 1.3 Reforma de Proyectos (mínimo viable)
- [ ] Migración de las 6 tablas nuevas + columnas
- [ ] Migrador automático desde Espejo Excel para los 15 proyectos
- [ ] Vista 360 actualizada al modelo OXI/IOARR
- [ ] Vista Cartera segmentada por las 4 categorías

### 1.4 Fix de bugs pendientes
- [ ] Desactivar Rolling Release Vercel
- [ ] Unificar `formatearMonto` (eliminar S/ hardcoded)
- [ ] Mostrar rol del creador en detalles
- [ ] Errores detectados por QA (ver `AUDITORIA-QA-Codigo.md`)

## Paquete 2 — "Funcional" (3-4 semanas siguientes)

Para que el ERP realmente reemplace los procesos manuales.

### 2.1 Multas e Infracciones
- [ ] Migración tablas multas (7 tablas)
- [ ] UI completa: lista, detalle por placa, alertas, admin
- [ ] Worker Python infra (multipropósito)
- [ ] Provider SAT Lima end-to-end
- [ ] Provider SUTRAN
- [ ] Provider MTC
- [ ] Alertas a Teams + campanita

### 2.2 Facturas + Kardex
- [ ] Migración tablas facturas (5 tablas)
- [ ] Parser XML UBL 2.1 Perú
- [ ] UI "Compras → Facturas Recibidas" con importador
- [ ] Kardex desde facturas + mapping artículos
- [ ] Conciliación factura↔OC↔recepción

### 2.3 SharePoint docs por proyecto
- [ ] Edge Function `sharepoint-docs` con Graph
- [ ] Vista de documentos por proyecto en el 360
- [ ] Subir/listar documentos directamente desde el ERP

### 2.4 Tablero editable de Proyectos (Fase B)
- [ ] Vista tabla con celdas editables (click-edit-Tab)
- [ ] Agrupación por estado / categoría
- [ ] Realtime colaborativo
- [ ] Exportar a Excel idéntico al RESUMEN actual

### 2.5 Cierre del módulo Compras
- [ ] Generación PDF de OCs/OSs
- [ ] Generación PDF de Requerimientos
- [ ] Carga de OCs históricas (las que generaron las 433 OTs)

## Paquete 3 — "Empresarial" (4-6 semanas siguientes)

Para gerencia y cumplimiento Perú.

### 3.1 Aprobaciones
- [ ] Approvals two-way (cuando llegue Premium)
- [ ] Aprobaciones dentro de Teams con botones

### 3.2 Inteligencia de negocio
- [ ] Power BI embebido en el módulo BI
- [ ] Dashboards ejecutivos por área
- [ ] Reportes PDF mensuales para gerencia

### 3.3 Cumplimiento SUNAT
- [ ] Registro de Compras electrónico (PLE)
- [ ] Registro de Ventas electrónico (PLE)
- [ ] Plan Contable General Empresarial (PCGE) semilla
- [ ] Detracciones / Retenciones / Percepciones
- [ ] Tipo de cambio oficial SBS (sync diario)

### 3.4 Operaciones
- [ ] Monitoreo Sentry (errores en producción)
- [ ] Plan de recuperación ante desastres documentado
- [ ] Política de retención de backups
- [ ] Prueba de restore
- [ ] Logs de auditoría completos (tabla central)
- [ ] Sync continuo SUNAT (Fase 3 facturas)

### 3.5 IA
- [ ] Asistente IA (Copilot del ERP)
- [ ] Conversacional sobre los datos del sistema

## Estimación de tiempos

| Paquete | Semanas | Meta |
|---|---|---|
| Soft launch | 3 | Equipo empieza a usar ERP en serio |
| Funcional | 7-8 | ERP reemplaza Excel y procesos manuales |
| Empresarial | 11-14 | Sistema completo de clase empresarial |

## Criterio de "entrega" exitosa al cliente

El ERP se considera **entregado** cuando:
1. Los 16 usuarios han iniciado sesión al menos 1 vez
2. Cada área (Flota, Proyectos, Compras, Gerencia) usó el módulo correspondiente al menos 1 semana sin volver al Excel/proceso manual
3. Existe al menos 1 proyecto completo en el ERP (datos, fases, items, valorizaciones, cobranza)
4. Existe al menos 1 reporte que gerencia consulta semanalmente
5. La capacitación inicial fue dada y hay material de soporte disponible
6. El canal Soporte ERP tiene actividad (preguntas reales del equipo)

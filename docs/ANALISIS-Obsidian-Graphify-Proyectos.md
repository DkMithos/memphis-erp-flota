# Análisis — Obsidian + Graphify para los proyectos, y dónde debe vivir la información

> **Fecha:** 2026-09-28 · **Pedido por:** Kevin · **Estado:** análisis, pendiente de decisión
> **Disparador:** video "Graphify + Obsidian + Claude Code" (Chase AI) y la pregunta de si sirve
> para llevar los proyectos actuales y venideros, y en qué base de datos consolidar la información
> que hoy está en equipos, canales y carpetas de Teams/SharePoint.

---

## 1. Qué es exactamente lo del video

**Graphify** es un skill de Claude Code (`pip install graphify`, comando `/graphify`). Se le da una
carpeta y construye un **grafo de conocimiento**:

- Pasada 1, determinista: para código usa un parser (tree-sitter) y saca clases, funciones,
  imports, llamadas. Sin IA.
- Pasada 2, con IA: subagentes de Claude leen documentos (Markdown, PDF, imágenes) y extraen
  conceptos y relaciones. Cada arista lleva etiqueta `EXTRACTED` (confianza 1.0), `INFERRED`
  (confianza 0–1) o `AMBIGUOUS`.
- Salidas: `graph.json`, `graph.html` (visor interactivo), `GRAPH_REPORT.md` (nodos más
  conectados, conexiones inesperadas, preguntas sugeridas) y, opcionalmente, un **vault de
  Obsidian** con una nota por concepto y wikilinks entre ellas.
- Integración con Claude Code: instala una regla en `CLAUDE.md` y un hook `PreToolUse` para que
  Claude consulte el grafo antes de hacer Glob/Grep. Ese es el origen del "71.5× menos tokens".
- `--update` reindexa solo lo que cambió (cache SHA256); `--watch` vigila la carpeta.

**Obsidian** en ese flujo es solo el visor y el bloc de notas: archivos Markdown en disco, con
enlaces `[[así]]` y la vista de grafo. Es una herramienta **personal, local y monousuario**.

El video muestra el caso de un desarrollador que usa esto como "segundo cerebro" para que Claude
Code tenga memoria y contexto entre sesiones. No es un caso de gestión de proyectos de empresa.

## 2. ¿Sirve para llevar los proyectos de Memphis?

### 2.1 Como sistema para *llevar* los proyectos: **no**

| Lo que exige llevar un proyecto | Obsidian + Graphify |
|---|---|
| Varias personas editando con permisos (Operaciones, Finanzas, Gerencia) | Un vault es una carpeta en la PC de una persona. Sync de pago es por usuario; sin roles ni auditoría. |
| Números que se sumen (contrato, adenda, cobrado, gasto, saldo) | Son notas de texto. No hay tablas relacionales ni cálculos confiables. |
| Flujo y estados (OC aprobada, valorización cobrada, CIPRL emitido) | No existe. |
| Integrarse con lo que el equipo ya usa (Teams) | Cero integración con Teams/SharePoint. Habría que copiar archivos a mano o por OneDrive. |
| Fuente de verdad única | Sería una **tercera** fuente junto a Teams y el ERP. Justo lo contrario de "que todos los módulos conversen". |

Además, el grafo de la pasada 2 lo infiere una IA: sirve para orientarse, no para sostener una
cifra ante Gerencia o una entidad. Las aristas `INFERRED` hay que verificarlas.

**El ERP ya es el sistema project-centric** que se decidió (`proyectos`, fases, adendas,
presupuestos por partida, `proyecto_financiero()`, `proyecto_cadena()`, Proyecto 360, Flujo de
caja). Ahí es donde se llevan los proyectos actuales y venideros. Lo que le falta al ERP no es un
grafo: es la **capa documental y de conocimiento** (bases, contratos, adendas, actas, cartas,
valorizaciones, minutas) que hoy vive suelta en Teams.

### 2.2 Como herramienta de *lectura y análisis*: **sí, y barata**

Para lo que sí sirve, y hoy no tenemos nada equivalente:

1. **Dossier de un proyecto en minutos.** Sincronizar por OneDrive la carpeta de un proyecto
   (p. ej. `Proyectosv2/ACTIVOS/GORE ICA`) y correr `/graphify --obsidian`. Resultado: un mapa de
   qué entidades, cláusulas, personas, penalidades y plazos se repiten, con enlaces a los PDF de
   origen. Preguntas como "qué documentos hablan de la Adenda N°04" o "qué une la garantía con
   la valorización 6" se responden sin abrir 200 archivos.
2. **Licitaciones** (iniciativa de Gerencia 2026-07-13): correr graphify sobre las bases
   integradas de licitaciones pasadas para extraer requisitos recurrentes, penalidades y
   criterios de evaluación. Es exactamente el tipo de corpus (PDF largos, heterogéneos) donde
   mejor rinde.
3. **El propio ERP.** El repo tiene 154 migraciones, 21 Edge Functions y ~70 módulos. Un grafo
   del código reduce el costo de cada sesión de Claude Code y ayuda a no romper cadenas
   (requerimiento → cotización → OC → factura → pago). Beneficio inmediato para nuestro trabajo.

Condiciones a tener claras:

- **Los archivos deben estar en disco.** OneDrive ya sincroniza SharePoint; basta marcar la
  carpeta como "siempre disponible".
- **Los documentos pasan por la API de Anthropic** en la pasada 2. Es lo mismo que ya ocurre
  cuando pegamos un Excel o un PDF en Claude Code, pero conviene que Gerencia lo sepa antes de
  indexar contratos completos.
- **Consume tokens de la sesión** (los subagentes corren dentro de Claude Code). Un proyecto
  grande con cientos de PDF puede costar una sesión entera la primera vez; `--update` después
  es barato.
- **No es multiusuario.** El vault resultante es de Kevin. Si Operaciones quiere verlo, hay que
  publicarlo de otra forma (ver §4, fase 3).

## 3. ¿Toda la información en una base de datos? ¿Cuál?

### 3.1 Separar dos cosas que hoy se mezclan

| Tipo | Ejemplos | Dónde debe vivir |
|---|---|---|
| **Datos estructurados** | contrato, adendas, partidas, OC, facturas, pagos, valorizaciones, fases, vehículos | **Supabase (PostgreSQL)**, que ya lo tiene. No hay nada que migrar aquí. |
| **Documentos (archivos)** | bases, contrato firmado, cartas, actas, expedientes técnicos, fotos, Excel de control | **SharePoint**, que ya lo tiene. No conviene sacarlos: versionado, permisos, retención, 1 TB+, y es donde el equipo trabaja. |
| **Conocimiento sobre los documentos** | qué documento es (tipo, fecha, a qué proyecto y entidad pertenece), qué dice (texto), qué relaciona (grafo) | **No existe hoy.** Es la capa que falta y es la que hay que construir. |

La respuesta corta: **no mover los archivos; construir el índice.** Copiar 96 MB del expediente
OXI al ERP ya se descartó el 2026-09-16 por buenas razones (duplicar y quedar desactualizado).
Lo mismo aplica a todo Proyectosv2.

### 3.2 Opciones evaluadas para esa capa de conocimiento

| Opción | Qué da | Veredicto |
|---|---|---|
| **Supabase Postgres + `pgvector`** (extensión disponible en el proyecto, aún no instalada) | Catálogo documental por proyecto, texto extraído, búsqueda semántica, RAG para el asistente IA, grafo de entidades en tablas normales. Misma RLS multi-tenant, mismos permisos del ERP. | **Recomendada.** Cero infraestructura nueva. |
| Base de grafos (Neo4j, Apache AGE) | Consultas de caminos y vecindades. | **No se justifica.** 11 proyectos, ~1,300 OC, 135 proveedores: Postgres con CTE recursivas lo resuelve. AGE no está en Supabase. |
| Microsoft Dataverse / SharePoint Lists | Está dentro del ecosistema M365. | **No.** Sería un segundo ERP. La regla es una sola fuente de datos estructurados: Supabase. |
| Obsidian vault como "base de datos" | Notas Markdown en disco. | **No** para la empresa (monousuario, sin permisos, sin cifras). Sí como visor personal (§2.2). |
| **Microsoft 365 Copilot** (licencia ~US$30/usuario/mes) | Preguntas en lenguaje natural sobre SharePoint/Teams/Outlook sin construir nada, respetando permisos M365. | **Alternativa honesta a considerar para Gerencia.** Resuelve "buscar y preguntar" pero no cruza con los números del ERP ni alimenta Proyecto 360. Puede convivir con lo demás. |

### 3.3 Los mensajes de Teams

Los archivos de canales son SharePoint y se leen con el permiso app-only `Files.Read.All` que ya
usa `documentos-sharepoint`. Los **mensajes** de canal son otra cosa: `ChannelMessage.Read.All`
en modo aplicación es una **API protegida** de Microsoft que exige un formulario de aprobación
y justificación. Los chats privados son aún más restringidos. Recomendación: **indexar archivos
primero; mensajes de canal después y solo si Gerencia lo pide**, porque el valor documental
está en los archivos y las decisiones importantes terminan en un acta, carta o Excel.

## 4. Propuesta por fases

### Fase 0 — Piloto sin construir nada (esta semana, costo 0)

1. Kevin marca en OneDrive como "siempre disponible" la carpeta de **un** proyecto (sugerido:
   GORE ICA, es el más completo) y la de bases de licitaciones.
2. `pip install graphify` y `/graphify --obsidian` sobre esa carpeta. Abrir el `graph.html` y el
   `GRAPH_REPORT.md`.
3. Correr `/graphify` sobre el repo del ERP e instalar el hook (`graphify claude install`).
4. Evaluar con dos preguntas concretas del negocio (p. ej. "qué penalidades tiene el contrato de
   Ica" y "qué documentos respaldan la Adenda N°04"). Si responde bien, la fase 2 hereda el mismo
   método de extracción, pero en servidor y para todos.

### Fase 1 — Catálogo documental por proyecto en el ERP (1–2 días)

- Extender `documentos_carpetas` con una carpeta raíz por proyecto (`proyecto_id`) y una tabla
  `documentos_proyecto` (metadata solamente: `drive_id`, `item_id`, ruta, nombre, tipo documental,
  fecha, tamaño, `etag`, `web_url`). **Los archivos siguen en SharePoint.**
- Edge Function `documentos-indexar` con cron diario que recorre la carpeta de cada proyecto por
  Graph y actualiza el catálogo (alta, cambio por `etag`, baja).
- Clasificación del tipo documental por regla (carpeta/nombre) y, cuando no se pueda, por IA.
- Pestaña **Documentos** en Proyecto 360: listado por tipo, búsqueda por nombre, descarga con el
  enlace de un solo uso que ya existe. Reusa el módulo `documentos` y sus permisos.

### Fase 2 — Texto + búsqueda semántica (pgvector) (3–5 días)

- Instalar `vector`. Tabla `documentos_fragmentos` (`documento_id`, orden, texto, `embedding`).
- La Edge Function descarga cada documento nuevo/cambiado, extrae texto (PDF, DOCX, XLSX),
  lo parte en fragmentos y guarda embeddings.
- **Decisión de embeddings:** Supabase trae `gte-small` gratis en el runtime de Edge Functions
  (384 dimensiones, entrenado en inglés, rinde regular en español) o un proveedor externo
  (Voyage, el recomendado por Anthropic, o OpenAI) que cuesta centavos por proyecto y rinde
  mejor en español. Recomendación: externo.
- Buscador en el ERP: "¿en qué documento está la garantía de fiel cumplimiento de Loreto?" →
  fragmentos con enlace al archivo.

### Fase 3 — Asistente y grafo de entidades (retoma `project_ia_embebida`, en pausa)

- El asistente IA del ERP (Edge Function + Claude) responde sobre proyectos combinando los
  fragmentos (fase 2) con `proyecto_financiero()` y `proyecto_cadena()`. Aquí está el ROI que
  pide Jefatura para aprobar créditos de API: una pregunta de Gerencia se responde con el
  contrato, la adenda y el saldo en la misma respuesta.
- Grafo de entidades **en Postgres**: `conocimiento_nodos` (proyecto, entidad estatal, contrato,
  adenda, cláusula, persona, proveedor, vehículo) y `conocimiento_aristas` (con `confianza` y
  `origen` extraído/inferido, como graphify). Lo extrae la misma pasada de IA de la fase 2.
  Se puede dibujar en el ERP (React Flow) para que Operaciones vea el mapa del proyecto sin
  Obsidian. Buena parte del grafo ya existe como claves foráneas: proyecto → OC → proveedor →
  factura → pago; solo faltan los nodos documentales.

### Qué no hacer

- No migrar archivos de SharePoint a Supabase Storage.
- No adoptar Obsidian como herramienta del equipo ni como fuente de verdad.
- No montar una base de grafos aparte.
- No indexar mensajes privados de Teams.

## 5. Decisiones que necesita Kevin / Gerencia

1. **Piloto graphify** sobre GORE ICA y licitaciones: ¿sí? (solo requiere sincronizar la carpeta).
2. **Confidencialidad:** conformidad de Gerencia con que contratos y bases pasen por la API de
   Anthropic (ya ocurre de forma puntual; esto sería sistemático).
3. **Tipos documentales** del catálogo (fase 1): quién define la lista (Operaciones).
4. **Embeddings:** proveedor externo (recomendado) o el gratuito de Supabase.
5. **Microsoft 365 Copilot:** ¿Gerencia quiere evaluar licencias como alternativa/complemento
   para "preguntar a SharePoint"?
6. **Mensajes de canal:** ¿se pide la API protegida de Microsoft o se queda en archivos?

## 6. Referencias

- Graphify (repo): https://github.com/safishamsi/graphify
- Graphify + Obsidian, artículo del autor del video: https://www.chaseai.io/blog/graphify-obsidian-claude-code-second-brain
- Video: https://www.youtube.com/watch?v=mWLDn49_8HA
- En este repo: `docs/ROADMAP-Ecosistema-Microsoft365.md` (SharePoint por proyecto era P1),
  `docs/ARQUITECTURA-Integracion-Microsoft365.md`, Edge Function `documentos-sharepoint`,
  memoria `project_ia_embebida`, `project_licitaciones`.

---

## 7. Continuidad: ¿todo en una base de datos? ¿Y si se va Microsoft? (2026-09-28, segunda pregunta)

**"Todo en una base de datos" es correcto solo para los datos estructurados.** Los archivos van
en almacenamiento de objetos (SharePoint hoy; un bucket como respaldo), y la base guarda qué
son, de qué proyecto y dónde están. Meter PDF dentro de PostgreSQL es un error clásico.

**Dependencias reales del ERP con Microsoft (verificado en el repo):** 8 Edge Functions usan
Graph (`correo-enviar`, `documentos-sharepoint`, `excel-sync`, `fianzas-import`,
`fianzas-cargos-import`, `flujo-import`, `presupuesto-import`, `ms-user-sync`), el login con
Microsoft (el login con contraseña sigue existiendo como respaldo) y las notificaciones a Teams.
**Ninguna guarda datos del ERP en Microsoft**: la base es Supabase. Si Microsoft se apaga, el
ERP sigue operando; se pierden archivos, correo, Teams y las importaciones desde Excel.

**Qué pasa al dejar de pagar M365:** Microsoft mantiene ~30 días de gracia con todo activo,
luego ~90 días "deshabilitado" (usuarios sin acceso, administradores sí pueden exportar) y
después borra. Ventana práctica de ~120 días para sacar todo. El golpe operativo mayor no es
SharePoint, es el **correo `@memphis.pe`** (el dominio es de Memphis; se migraría a otro
proveedor).

**No se recomienda** ni servidor físico ni sistema alterno en paralelo. **Sí** un plan de
continuidad barato:

1. Respaldo automático de Supabase fuera de Supabase (`pg_dump` semanal a un bucket S3/R2/B2,
   además del backup diario del plan). Hoy **no existe** ningún respaldo externo automatizado
   en el repo.
2. Espejo de respaldo de las carpetas de proyecto de SharePoint en un bucket (recorrido por
   Graph, el mismo de la fase 1 del catálogo). Copia de seguridad, no copia de trabajo.
3. Login con contraseña verificado como respaldo del SSO (ya existe).
4. Runbook de salida documentado (dónde está cada cosa y cómo se restaura).

**VPS (Virtual Private Server):** un servidor virtual alquilado por mes en un centro de datos
(Hetzner, DigitalOcean, Contabo; US$5–40/mes), con acceso root a un Linux propio. A diferencia
de Supabase/Vercel (gestionados: ellos operan la base y el despliegue), en un VPS uno instala,
actualiza, asegura y respalda todo. Tiene sentido como plan B (auto-hospedar Supabase o un
Nextcloud) o para el job de respaldos; no como reemplazo hoy.

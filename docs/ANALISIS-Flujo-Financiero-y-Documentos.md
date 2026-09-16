# Flujo financiero y documentos: qué hay, qué falta y qué hay que decidir

Analizado el 2026-09-16. Cubre dos peticiones que, mirándolas de cerca, son la
misma máquina con dos cargas distintas.

---

## Parte 1 — El flujo financiero (Carolina, Walter, Miguelangel, Kevin)

> "Aún no veo cómo podemos subir y actualizar nuestra información de los archivos
> que están en esta carpeta." — Kevin

Carpeta: SharePoint → `FlujoFinanciero/Documentos compartidos/Flujo Financiero/`

### Qué hay en la carpeta

Cinco archivos, y no son cinco cosas: son **dos capas**.

**Capa 1 — las bases de datos.** Tablas planas, una fila por compromiso:

| Archivo | Filas | De quién |
|---|---:|---|
| `BD CONTA 2026.xlsx` | 169 | Contabilidad / Administración |
| `BD TI 2026.xlsx` | 53 | TI |

Las dos comparten **exactamente la misma cabecera**:

```
CDC · CONCEPTO · CATEGORIA · PROVEEDOR · MONEDA · TC · MES VENCIMIENTO ·
MONTO EJECUTADO · MONTO PRESUPUESTADO · MONTO PAGADO · MES PAGADO ·
PAGADO/PENDIENTE · MES PROGRAMADO · POSTERGADO · MOMENTO · OBSERVACIONES · Tipo
```

Que compartan cabecera es lo importante: **un solo lector sirve para las dos**, y
para las que vengan (una BD por área).

**Capa 2 — los flujos.** `Flujo Administración.xlsx` (650 KB), `Flujo de
proyectos.xlsx` (2,1 MB) y `Flujo GM.xlsx` (2,1 MB) no son datos: son tablas
dinámicas y segmentaciones montadas encima de las BD. `Flujo GM` incluso lleva
una hoja "Parámetros CDC" para elegir qué centros de costo entran en la vista.

**Esa capa no hay que importarla.** Si la BD está en el ERP, el ERP pinta esa
vista solo — y sin tener que acordarse de actualizar la tabla dinámica.

### Lo que encaja ya con el ERP

- **`CDC` es el centro de costo del ERP.** LICENCIAS, REDES E INTERNET, EQUIPOS
  TECNOLOGICOS, MANTENIMIENTO, DESPLIEGUE, SERVICIOS CLOUD, HOSTING Y DOMINIOS,
  RETENCION 3%… todos existen ya en `centros_costo`. (Una excepción vista:
  `DATABASE` en BD TI, que en el ERP se llama `BASE DE DATOS`.)
- **`PROVEEDOR` cruza con el directorio** por razón social.
- **La máquina de sincronización ya existe y funciona.** La Edge Function
  `excel-sync` lee archivos de SharePoint con permisos de aplicación
  (`Files.Read.All`), los configura la tabla `excel_sync_config` y hay un botón
  "Sincronizar ahora" en la interfaz. Hoy tiene dos archivos dados de alta
  (RESUMEN.xlsx de Operaciones y el status de fianzas), ambos con última
  sincronización correcta.

Es decir: **no hay que construir el canal, solo el lector y la pantalla.**

### La decisión que hace falta antes de construir

Esta es la pregunta, y es de Kevin, no técnica:

**¿El ERP manda o el ERP refleja?**

- **Refleja** (más rápido, menos riesgo): cada área sigue trabajando en su
  `BD *.xlsx` en Teams, y el ERP la lee cada X minutos y la enseña cruzada con
  las órdenes y la caja chica reales. Nadie cambia su forma de trabajar. El ERP
  no puede corregir nada: si hay un error, se corrige en el Excel.
- **Manda** (lo que de verdad pedía la pregunta "cómo subimos y actualizamos"):
  los compromisos se registran en el ERP, cada uno ve y edita los de su área, y
  el Excel se deja de usar o pasa a ser una exportación.

Yo recomendaría empezar por **reflejar** y pasar a **mandar** cuando todos vean
sus datos ya dentro. Cambiar la herramienta y el proceso a la vez es la forma
más segura de que la gente vuelva al Excel.

### Lo que se construye en cualquiera de los dos casos

1. Tabla `compromisos_flujo` con esas 17 columnas, `centro_costo_id` resuelto y
   origen (qué archivo/área lo trajo).
2. Un lector en `excel-sync` para la cabecera `BD *`. Uno solo, porque la
   cabecera es común.
3. Pantalla en Finanzas: por área, por mes de vencimiento, pagado contra
   pendiente, y lo postergado — que es la columna que hoy nadie mira y es la que
   avisa de los atascos.

---

## Parte 2 — Los documentos de Shirley (sobres de postulación)

> "Shirley me pidió que tengamos un módulo de documentación para lo que ella
> necesita cuando arma los sobres de postulación, me compartió una carpeta."

**No pude abrir la carpeta.** El enlace que compartió Kevin es un enlace de
"compartir" de SharePoint (`/:f:/s/COMPRAS/IgAb8MdA-…`), y el conector con el que
leo SharePoint resuelve rutas y búsquedas, pero no resuelve esos tokens. Busqué
la carpeta por nombre en el sitio COMPRAS (`sobres`, `documentos de la empresa`,
declaraciones juradas, RNP, vigencia de poder) y no di con ella: hay muchas
carpetas de sobres, una por proyecto, y ninguna parece ser la suya.

**Lo que hace falta para seguir:** la ruta de la carpeta tal como se ve en
SharePoint, por ejemplo

```
COMPRAS / Documentos compartidos / General / 0.0 PROYECTOS EN IDEA / ...
```

o simplemente el nombre exacto de la carpeta.

No quiero construir el módulo a ciegas. "Documentación para armar sobres de
postulación" puede ser tres cosas muy distintas —un repositorio de documentos de
la empresa con vencimientos (RNP, vigencia de poder, estados financieros), un
checklist por licitación, o un armador de expedientes— y cada una se diseña de
otra manera. Con ver los archivos, la duda se resuelve sola.

**Lo que sí se puede adelantar:** es la misma máquina de la Parte 1. El canal de
SharePoint ya está montado y con permisos de lectura sobre todos los sitios, así
que apuntar el módulo a la carpeta de Shirley es configuración, no desarrollo. Lo
que cambia es la pantalla, y para eso hay que ver qué documentos son.

---

## Resumen de lo que está bloqueado

| Qué | Bloqueado por | Quién lo desbloquea |
|---|---|---|
| Módulo de documentación de Shirley | no se localiza la carpeta | Kevin: ruta o nombre |
| Flujo financiero en el ERP | decisión ¿refleja o manda? | Kevin |
| Presupuesto inicial de proyecto | tres dudas de cálculo | Antonio (ver [ANALISIS-Presupuesto-Inicial-Proyecto.md](ANALISIS-Presupuesto-Inicial-Proyecto.md)) |

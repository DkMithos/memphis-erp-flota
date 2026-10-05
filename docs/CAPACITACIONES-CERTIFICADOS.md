# Capacitaciones y certificados (2026-10-05)

> Módulo nuevo dentro de **Proyectos → Capacitaciones y certificados**
> (`/proyectos/capacitaciones`). Cubre el pedido de Kevin: algunas entregas de
> bienes incluyen capacitaciones; hace falta un formulario de asistencia con
> firma, emitir certificados con QR, y un portal donde cualquiera ponga el DNI
> y vea sus capacitaciones, el temario y descargue sus certificados. Todo sale
> del ERP; la plantilla del certificado se configura por consorcio / proyecto /
> curso, o se sube el modelo completo.

## 1. Qué se analizó del repo `Adrian-7268/plantilla-diplomas`

- Es un **taller local** (Node sirve 4 archivos estáticos): formulario para
  editar institución, título, textos, dos temas con horas, fecha, color y
  firmante; lista de nombres pegada o CSV; vista previa; impresión del navegador
  como PDF (A4 horizontal, una página por persona). Plantilla en `localStorage`.
- Diseño: papel marfil con grano, franjas curvas azul profundo (`#17364c`,
  `#24718a`) con filete dorado (`#b28b45`), título en Georgia, logo del
  **Consorcio Ejecutor Salud Cusco** abajo a la izquierda, sello SVG del
  **Consorcio Mas Seguridad Amazonas** sobre la firma, foto de fondo (equipo
  practicando RCP junto a una ambulancia) atenuada. Texto real usado:
  *"Por haber participado en la capacitación en Destrezas de Conducción y
  Soporte Vital Básico (BLS), con una duración total de 20 horas académicas"*,
  fecha 20/09/2026.
- `INTEGRACION_ERP.md` del repo ya proponía: QR → portal del ERP → DNI →
  temario y descarga; identidad/fecha/horas desde el registro real; versión de
  plantilla congelada por emisión; **no exponer datos a partir del DNI sin
  control**; el sello no es firma digital.
- Lo que NO servía para producción: datos en `localStorage`, nombres sin DNI,
  `app.js` de 2.8 MB con las imágenes incrustadas, sin participantes ni
  proyectos, PDF solo por `window.print` (malo en celular), sin QR ni portal.
- Lo que se **reutilizó**: la composición visual completa (colores, tipografías,
  jerarquía de textos, posición de logo/sello/firma), el texto de
  reconocimiento, la regla "setiembre", y el curso real como semilla
  (`CUR-001`, BLS 4 h + conducción 16 h).

## 2. Lo construido

### Base de datos (migración `20261005120000_capacitaciones_y_certificados`)

| Tabla | Para qué |
|---|---|
| `capacitacion_cursos` | Catálogo: nombre, descripción, `temario` jsonb `[{tema, horas}]`; `horas_total` lo calcula un trigger. |
| `certificado_plantillas` | Modelo del diploma. `modo` = `estandar` (diseño del ERP, se cambia logo/sello/firma/colores/textos) o `fondo_completo` (imagen A4 subida por el consorcio; el ERP escribe encima). Alcance por `proyecto_id` / `curso_id`; `es_default` única por tenant. |
| `capacitaciones` | La sesión dictada: proyecto, curso, plantilla, título, temario (copia editable), fechas, lugar, instructor, entidad beneficiaria, estado (`programada/en_curso/cerrada/anulada`), `asistencia_token` (QR/enlace) y `asistencia_abierta`. Código `CAP-YYYY-NNN` por trigger con advisory lock. |
| `capacitacion_participantes` | DNI, nombres, apellidos, cargo, institución, correo, teléfono, **firma** (`firma_data_url` PNG, `firmado_en`, `firma_origen` erp/enlace, IP y user-agent), `asistio`. Único por (capacitación, DNI). |
| `certificados` | Emisión: `codigo` `CERT-YYYY-NNNNN` (trigger), `token` uuid (va en el QR), estado emitido/revocado con motivo, **snapshots `datos` y `plantilla`** (lo impreso ese día no cambia después). |
| `certificado_accesos` | Bitácora del portal público: tipo, DNI hasheado, IP, resultado. Base del tope por IP. |

- RLS por tenant (`ti_*`) en las cinco tablas; la bitácora la escribe solo el rol de servicio.
- Bucket **público** `certificados` (logos, sellos, fondos y rúbrica del firmante; carpeta =
  tenant; subir/borrar exige `proyectos.editar`). Las firmas de participantes NO van al bucket:
  viven en la tabla, bajo RLS.
- **Permisos:** se reutiliza el módulo `proyectos`: `ver` entra, `crear/editar` gestiona,
  `aprobar` **emite** certificados, `eliminar` **revoca**. Nada nuevo que repartir.
- Semilla: "Plantilla estándar" por tenant y el curso `CUR-001` para Memphis.

### Edge Function pública `capacitaciones-publico` (`verify_jwt=false`, `@supabase/server` con `auth:'none'`)

| Acción | Uso |
|---|---|
| `verificar {token}` | `/cert/:token` — QR del diploma: existe, vigente/revocado, snapshot para pintarlo. |
| `consultar {dni}` | `/certificados` — capacitaciones del DNI (solo asistentes, sin anuladas), temario, certificados. Tope **12 / 10 min y 60 / día por IP**. |
| `capacitacion {token}` | `/c/:token` — datos para el formulario de asistencia (si está abierta). |
| `firmar {…}` | Registra asistencia + firma desde el celular. Valida DNI, PNG ≤ 400 KB, enlace abierto, duplicados (si el ERP precargó el DNI, solo completa la firma). Tope 15/h por IP. |

Nunca devuelve la firma del participante ni correos/teléfonos.

### Frontend

- `src/lib/capacitaciones/`: `types.ts`, `db.ts` (CRUD bajo RLS, subida al bucket, "usar mi
  firma registrada" desde `firmas_usuario`), `datos.ts` (snapshot, sugerencia de plantilla,
  fechas en castellano con *setiembre*, parser de listas pegadas/CSV), `publico.ts` (cliente de
  la Edge Function), `qr.ts`, `urls.ts` (los QR SIEMPRE apuntan a `erp.memphismaquinarias.com`
  salvo en localhost), `certificado-pdf.tsx` (html2canvas 2× + jsPDF, una página por persona,
  librerías con import dinámico: ~600 KB solo para quien descarga), `hoja-asistencia.ts`
  (lista imprimible con las firmas, para el expediente de entrega).
- `src/components/modules/capacitaciones/`:
  - `CertificadoVista.tsx` — **el diploma** (1123×794 px = A4 horizontal). Mismo componente
    para vista previa, portal y PDF. Sin `cqw`, `mix-blend-mode` ni gradientes radiales (lo que
    html2canvas no pinta igual); las franjas curvas son SVG en línea.
  - `CapacitacionesLista.tsx`, `CapacitacionDialog.tsx`, `CapacitacionDetalle.tsx`
    (participantes + firma en el ERP con `PadFirma` + QR/enlace de asistencia + hoja de
    asistencia + emisión + descarga individual/lote + revocar/reemitir + enviar por correo vía
    `correo-enviar`), `CursosCatalogo.tsx`, `PlantillasCertificado.tsx` (editor con vista
    previa en vivo, uploads, PDF de muestra).
- `src/components/portal/PortalCertificados.tsx` — público, sin providers: `/certificados`,
  `/cert/:token`, `/c/:token` (formulario móvil con el mismo pad de firma).
- Rutas en `App.tsx` (públicas y `/proyectos/capacitaciones[/cursos|/plantillas|/:id]`) y
  entrada en el menú de Proyectos.

## 3. Flujo operativo

1. **Plantillas** (una vez por consorcio): nombre, logo, sello, firmante (+ rúbrica, o "usar mi
   firma registrada"), colores/textos; o modo *fondo completo* subiendo el arte del consorcio y
   ajustando con los deslizadores dónde va el texto. Se puede amarrar a un proyecto y/o curso.
2. **Cursos**: temario con horas (sale impreso).
3. **Nueva capacitación**: proyecto, curso (copia el temario), fechas, lugar, instructor,
   entidad; la plantilla se sugiere (proyecto+curso → proyecto → curso → general).
4. **Asistencia**: importar la lista (pegar desde Excel) o que cada uno se registre con el QR
   del enlace de asistencia desde su celular (abrir/cerrar desde el detalle; "Imprimir cartel
   con QR"). También se firma en el ERP pasando la tablet. "Hoja de asistencia" imprime la lista
   con firmas para el expediente.
5. **Emitir**: elegir plantilla → "Emitir N" (por defecto solo a quienes firmaron). Cada
   certificado recibe `CERT-AAAA-NNNNN` + QR. Descargar uno o todos en un PDF; enviar el enlace
   por correo; revocar con motivo (el QR pasa a mostrar "revocado"); reemitir.
6. **Portal**: el QR lleva a `/cert/<token>` (autenticidad + descarga). Desde ahí, o en
   `/certificados`, con el DNI se ven todas las capacitaciones, el temario y los certificados.

## 4. Decisiones y límites (para Kevin)

- **Consulta por DNI sin segundo factor**, como se pidió. Mitigaciones: solo se muestra lo que
  ya está impreso en el papel, DNI enmascarado en el encabezado, tope por IP y bitácora. Si
  Gerencia quisiera más, el siguiente paso natural es pedir además la fecha de nacimiento o un
  código enviado al correo registrado.
- El PDF se genera en el navegador (también en el celular del participante). No se guarda un
  archivo por certificado: el snapshot lo reconstruye idéntico siempre. Si algún día hace falta
  el archivo (p. ej. para adjuntarlo por correo), se puede subir al bucket al emitir.
- La rúbrica del firmante y el sello son imágenes: **no** es firma digital. Igual que hoy.
- Dominio de los QR fijo a producción (`erp.memphismaquinarias.com`); en previews de Vercel el
  QR impreso igual apunta a producción.

## 5. Verificación (2026-10-05, preview local con usuario QA temporal, luego eliminado)

- Migración aplicada; trigger de horas (20.00) y correlativos (`CAP-2026-001`,
  `CERT-2026-00001/2`) OK. Edge Function: `verificar/consultar/capacitacion` con datos
  inexistentes → `encontrado:false`; `firmar` con enlace cerrado → 409; abierto → 200
  (precargado y nuevo); duplicado → 409 con `ya_firmado`; sin firma → 422. Bitácora con IP.
- UI: alta de capacitación desde el catálogo, importación de 3 participantes pegados
  (capitaliza nombres), apertura del enlace (pasa a *en curso*), emisión de 2 certificados,
  página pública `/cert/:token`, portal `/certificados?dni=…`, formulario `/c/:token`.
- `npm run build` OK; jsPDF y html2canvas quedan en chunks propios bajo demanda.

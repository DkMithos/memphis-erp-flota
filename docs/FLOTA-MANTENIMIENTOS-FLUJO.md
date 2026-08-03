# FLOTA — Flujo de mantenimientos programados con confirmación por QR

> Solicitud de Kevin (2026-07-30): los vehículos se programan para mantenimiento desde el
> sistema, van a su taller en la fecha/hora asignada, el taller **lee el QR** y **registra y
> confirma** el mantenimiento programado. Objetivo central: **evitar que los talleres lleven
> a mantenimiento vehículos que NO pertenecen a las flotas** (ya ocurrió). Los registros deben
> ser **automáticos**.
> Este documento es DISEÑO del flujo. No se toca el sistema hasta que Kevin apruebe.

## 1. Qué ya existe (no partimos de cero)

- **`vehiculo_mantenimientos`**: ya modela el servicio con `estado` (programado / ejecutado /
  no_ejecutado / reprogramado), `fecha_programada`, `fecha_ejecucion`, `km_servicio` (el del
  plan: 5,000 / 10,000…), `km_odometro` (lectura real), `taller` (hoy texto), `costo`, `origen`.
- **`talleres`**: tabla lista (0 filas) con proveedor, contacto, ubicación (dpto/prov/dist),
  especialidades, marcas autorizadas, horario. Falta poblarla con los talleres reales.
- **`flota_contratos` + `flota_contrato_tarifas`**: el contrato de cada flota y el **precio por
  servicio según km** (base del costeo automático).
- **`vehiculo_km_lecturas`**: bitácora de odómetro → promedio km/día → proyección del próximo servicio.
- **QR de vehículo**: 386 con `public_token`. Hoy muestra info pública; se rediseña para este flujo.

**Falta** (capa nueva): identidad/acceso del taller, la "cita" con hora y taller_id, la
validación anti-fraude al escanear, y el registro automático con costeo desde el tarifario.

## 2. El flujo, etapa por etapa

### Etapa 1 — Programación (interna, Operaciones Memphis)
- Por cada vehículo de flota, el sistema calcula el **próximo servicio**: por km (odómetro +
  promedio km/día → fecha proyectada) y/o por tiempo. Operaciones revisa la proyección.
- Operaciones **genera la cita**: vehículo + **taller asignado** + fecha + hora + servicio
  esperado (km del plan). Queda como `vehiculo_mantenimientos` en estado **`programado`** con
  `taller_id`, `fecha_programada`, `hora_cita`, `km_servicio` esperado.
- El taller se asigna desde el contrato de la flota o manualmente (según ubicación/marca).

### Etapa 2 — El vehículo va al taller
En su fecha/hora. (El conductor/PNP lleva la unidad; el taller ya "espera" esa cita en su bandeja.)

### Etapa 3 — El taller lee el QR (aquí se bloquea el fraude)
El taller, **autenticado** en el portal de talleres, escanea el QR del vehículo. El sistema
valida **antes de permitir cualquier registro**:
1. El vehículo **pertenece a una flota** (`flota_id` no nulo). Si no → **RECHAZO SIEMPRE**:
   "este vehículo no pertenece a ninguna flota gestionada por Memphis". *(Regla dura, sin excepción.)*
2. El taller logueado **es el taller asignado a la flota** de ese vehículo (taller fijo por
   flota, decisión #2/#10). Si no → **RECHAZO**: "este vehículo corresponde a otro taller".
3. ¿Existe una **cita `programado` para HOY** (fecha exacta, decisión #4)?
   - **Sí** → registro normal (camino feliz).
   - **No** (llegó otro día, o sin cita — decisiones #4/#5) → **camino de excepción**: se acepta
     el registro SOLO si el **odómetro corresponde a un servicio del plan pendiente** (el km
     cuadra con un intervalo aún no ejecutado). Queda como **`pendiente_aprobación`** →
     **requiere aprobación de Memphis** para contar. Si el km NO corresponde → **RECHAZO**.

Solo si pasa 1 y 2 (y 3 en alguno de sus dos caminos) se abre el formulario de registro con el
servicio esperado precargado. → Un vehículo **sin flota** nunca entra; uno de la flota sin cita
solo entra por la vía controlada (km correcto + aprobación de Memphis).

### Etapa 4 — El taller registra (odómetro + fotos obligatorios)
El taller ingresa: **km del odómetro real** (obligatorio, decisión #6 → alimenta la proyección
del siguiente servicio), **fotos de evidencia** (obligatorias, decisión #7), y observaciones.
Al registrar, el sistema **automáticamente**:
- Cambia la cita de `programado` → **`registrado_taller`** (esperando a Memphis; el camino de
  excepción queda en `pendiente_aprobación`).
- **Calcula el costo desde el tarifario de la FLOTA** (`flota_contrato_tarifas`, que varía por
  flota — decisión #9) según el `km_servicio`. **El taller NO modifica el costo.**
- Setea `km_odometro`, guarda las fotos en storage, registra quién (taller) y cuándo.
- Inserta una lectura en `vehiculo_km_lecturas` → recalcula la fecha del próximo servicio.
"Automático" = el mantenimiento queda registrado y costeado sin que nadie digite el precio.

### Etapa 5 — Memphis confirma y cierra (decisión #8)
Memphis ve en su bandeja los mantenimientos `registrado_taller` y `pendiente_aprobación`,
revisa (fotos, km, costo), y **confirma y cierra** → estado **`confirmado`**. Recién ahí el
servicio **cuenta contra el consumo del contrato** (provisión vs real). Las excepciones
(sin cita / fecha distinta) requieren la **aprobación explícita** de Memphis antes de cerrar.

## 3. Cómo se corta el fraude (resumen del control)

| Riesgo | Control |
|---|---|
| Taller registra un vehículo ajeno a la flota | Regla 1: vehículo sin `flota_id` → rechazo |
| Taller registra sin que Memphis lo haya programado | Regla 2: sin cita `programado` → rechazo (la cita SIEMPRE nace en Memphis) |
| Un taller registra un vehículo de otro taller | Regla 3: taller logueado ≠ taller de la cita → rechazo |
| Taller infla el costo | Costo automático desde el tarifario; el taller no lo edita |
| Registro "de la nada" (sin QR) | La confirmación exige el token del QR del vehículo + cita |

## 4. Cambios necesarios (para el plan; no ejecutar aún)

- **Poblar `talleres`** con los reales (Perumotor, Promotora Genesis, y los talleres por provincia).
- **`vehiculo_mantenimientos`**: agregar `taller_id` (FK), `hora_cita`, `confirmado_por_taller`,
  `confirmado_en`, `evidencia_url`/`os_taller`, `km_proyectado_siguiente`.
- **Acceso del taller**: portal de talleres con login (reutiliza el patrón del portal de
  proveedores: cliente Supabase separado + RLS + alias por RUC del taller). El taller ve solo
  SUS citas.
- **Edge Function `manto-confirmar`**: valida las 3 reglas + calcula el costo del tarifario +
  cambia estado + registra lectura de km. Toda la lógica anti-fraude vive en el backend.
- **QR rediseñado**: leído por un taller autenticado → abre la confirmación de la cita; leído
  por público → solo info básica + cumplimiento + último mantenimiento (lo ya acordado en el
  rediseño del QR).
- **Programación**: pantalla interna que proyecta próximos servicios y genera citas (individual
  y en lote).

## 5. Decisiones de Kevin (RESUELTAS, 2026-07-30)

1. **Acceso del taller**: **portal con login propio** (patrón del portal de proveedores).
2. **Asignación de taller**: **taller fijo por flota** (no por vehículo ni por cita).
3. **Quién programa**: **el sistema propone, Operaciones confirma en lote** (semanal / quincenal
   / mensual — configurable).
4. **Ventana de fecha**: **fecha exacta**. Si llega antes/después, se acepta **solo si el km
   corresponde** al servicio del plan, y **requiere aprobación de Memphis**.
5. **Vehículo sin cita**: se acepta **solo si el km corresponde**, y **requiere aprobación de Memphis**.
6. **Odómetro**: lo **registra el taller** (obligatorio).
7. **Evidencia**: **fotos obligatorias**.
8. **Cierre**: el **taller registra**, **Memphis confirma y cierra**.
9. **Costo**: **tarifario por flota**, fijo; **el taller no modifica nada**.
10. **Taller por vehículo/flota**: **uno solo** (consistente con #2).

## 6. Plan de construcción por fases (para ejecutar tras el visto bueno)

**Fase A — Modelo de datos + talleres**
- `flotas.taller_id` (FK a `talleres`) → taller fijo por flota; cada vehículo hereda el taller de su flota.
- Poblar `talleres` con **datos mínimos: nombre + ubicación** (decisión de Kevin 2026-07-30). El
  `talleres.proveedor_id` es **OPCIONAL** — un taller NO tiene que ser proveedor; se vincula solo
  si más adelante Kevin obtiene los datos completos (RUC, contacto, bancos). Cada taller lleva un
  **`codigo`** interno que Memphis asigna (TALL-NNN) — es su identidad de login (ver Fase C).
- Extender `vehiculo_mantenimientos`: `taller_id` (FK), `hora_cita`, `confirmado_por_taller`,
  `confirmado_en`, `aprobado_por`, `aprobado_en`, `requiere_aprobacion`, fotos. Estados:
  `programado` → `registrado_taller` / `pendiente_aprobacion` → `confirmado` / `observado`.
- Bucket privado `evidencias-mantenimiento` (fotos) + RLS.

**Fase B — Programación en lote (interno)**
- Motor de proyección (km + promedio km/día, y tiempo) → próximos servicios.
- Pantalla de Operaciones: revisa la propuesta y **confirma citas en lote** (periodicidad
  configurable) → genera los `programado` con fecha/hora/taller(de la flota)/km_servicio.

**Fase C — Portal de talleres + confirmación por QR**
- Portal de talleres con login — **mismo esquema que el portal de proveedores** (cliente Supabase
  separado + RLS + credenciales que genera Memphis y contraseña que fija el taller), pero la
  **identidad de login es el `codigo` del taller** (alias `{codigo}@talleres.memphismaquinarias.com`),
  NO el RUC — porque el taller puede no tener RUC (solo nombre + ubicación). El taller ve **solo sus citas**.
- Edge Function `manto-confirmar`: valida las reglas anti-fraude (§3), exige odómetro + fotos,
  costea desde el tarifario de la flota, setea estado (`registrado_taller` o `pendiente_aprobacion`).

**Fase D — Confirmación/cierre por Memphis**
- Bandeja interna de `registrado_taller` + `pendiente_aprobacion`: Memphis revisa fotos/km/costo,
  aprueba las excepciones y **cierra** → `confirmado`. Recién ahí cuenta contra el contrato.

**Fase E — QR público rediseñado + detalle de vehículo**
- QR público: info básica + cumplimiento + último mantenimiento (fecha/km). QR leído por taller
  autenticado → confirmación de cita. Rework del detalle de vehículo con historial nuevo.

**Esquema del taller (definido 2026-07-30):** el taller es una **entidad independiente** con
datos mínimos (nombre + ubicación); `talleres.proveedor_id` es **opcional** (se llena solo si
Kevin obtiene los datos completos). Identidad de login = `talleres.codigo` (no RUC). La flota
fija su taller vía `flotas.taller_id`.

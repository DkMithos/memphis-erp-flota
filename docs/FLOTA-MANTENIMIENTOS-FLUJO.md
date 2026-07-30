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
1. El vehículo **pertenece a una flota** (`flota_id` no nulo). Si no → **RECHAZO**: "este
   vehículo no pertenece a ninguna flota gestionada por Memphis".
2. Existe una **cita `programado` para ESE taller** en la fecha de hoy (con ventana de
   tolerancia a definir). Si no → **RECHAZO/ALERTA**: "no hay cita programada para este
   vehículo en su taller hoy".
3. El taller logueado **es** el taller de la cita. Si no → **RECHAZO**: "este vehículo está
   asignado a otro taller".

Solo si pasa las 3, se muestra el formulario de confirmación con el servicio esperado precargado.
→ Un vehículo **sin flota** o **sin cita** NO puede registrarse: es imposible "colar" unidades ajenas.

### Etapa 4 — El taller registra y confirma (registro automático)
El taller ingresa: **km del odómetro real** (obligatorio → alimenta la proyección del siguiente
servicio), observaciones y, opcional, evidencia (foto / N° de orden de servicio del taller).
Al confirmar, el sistema **automáticamente**:
- Cambia la cita de `programado` → `ejecutado`; setea `fecha_ejecucion` = hoy, `km_odometro`.
- **Calcula el costo desde el tarifario** del contrato (`flota_contrato_tarifas`) según el
  `km_servicio`. El taller NO teclea el precio → sin manipulación de montos.
- Registra quién confirmó (taller) y cuándo; guarda la evidencia.
- Inserta una lectura en `vehiculo_km_lecturas` → recalcula la fecha del próximo servicio.
"Automático" = el mantenimiento queda registrado y costeado sin que Memphis lo digite.

### Etapa 5 — Conformidad Memphis (cierre)
Memphis ve los mantenimientos ejecutados por talleres en su bandeja, da conformidad (o se
configura automática) y el servicio **cuenta contra el consumo del contrato** (provisión vs real).

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

## 5. Decisiones abiertas para Kevin

1. **Acceso del taller**: ¿portal con login propio (recomendado, más seguro) o el QR basta y el
   taller se identifica al escanear?
2. **Asignación de taller a la cita**: ¿taller fijo por contrato de flota, por ubicación del
   vehículo, o manual por Operaciones cada vez?
3. **Quién programa**: ¿el sistema propone por km/tiempo y Operaciones confirma en lote, o
   Operaciones las crea 100% manual?
4. **Ventana de fecha**: ¿solo el día exacto de la cita, o ±N días de tolerancia? ¿Qué pasa si
   el vehículo llega antes/después?
5. **Vehículo sin cita que llega al taller**: ¿rechazo total, o permitir "registro fuera de
   programa" con alerta a Memphis para que lo autorice?
6. **Odómetro**: ¿el taller ingresa el km real? (recomendado sí — sostiene la proyección).
7. **Evidencia**: ¿se exige foto y/o N° de orden de servicio del taller?
8. **Cierre**: ¿la confirmación del taller cierra el mantenimiento, o siempre requiere
   conformidad posterior de Memphis antes de contar contra el contrato?
9. **Costo**: ¿siempre del tarifario, o el taller puede reportar un costo distinto sujeto a
   aprobación de Memphis?
10. **Un vehículo, ¿un solo taller asignado o puede ir a cualquiera de los del contrato?**

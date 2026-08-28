# CxP — Validación de CDC y catálogo de categorías

> Insumo de la **Fase B** de [PLAN-CxP.md](PLAN-CxP.md). Resuelve las decisiones 1 y 2 de la
> sección 6 de ese plan, y la 4 (ingresos).
> Fuente: los 4 archivos de `Flujo Financiero` en su versión del **27/08/2026**
> (`BD TI 2026`, `BD CONTA 2026`, `Flujo Administración`, `Flujo de proyectos`).
>
> Estado: **CDC aplicados el 27/08** (decisiones de Kevin). El catálogo de categorías queda
> como propuesta hasta que cada área lo revise.

---

## 1. Validación de CDC

Los 4 archivos usan **49 códigos de centro de costo**. Contrastados contra los 76 de
`centros_costo` en Supabase:

| Resultado | Cantidad |
|---|---|
| Coinciden exacto | 35 |
| Coinciden al normalizar (tildes / espacios) | 5 |
| **Sin equivalente — requieren decisión** | **8** |
| Fila espuria (no es un CDC) | 1 |

### 1.1 Coinciden solo al normalizar — se resuelven solos

El transform debe comparar sin tildes y colapsando espacios. No necesitan decisión.

| En el Excel | En el ERP | Diferencia |
|---|---|---|
| `5TA CATEGORIA` | `5TA CATEGORÍA` | tilde |
| `DETRACCION` | `DETRACCIÓN` | tilde |
| `EQUIPOS TECNOLOGICOS` | `EQUIPOS TECNOLÓGICOS` | tilde |
| `RETENCION 3%` | `RETENCIÓN 3%` | tilde |
| `RENTA 3RA  MENSUAL` | `RENTA 3RA MENSUAL` | doble espacio |

Ojo: `4TA CATEGORÍA` y `5TA CATEGORÍA` **sí** están con tilde en el Excel, pero además existe
`5TA CATEGORIA` sin tilde en otras filas — la misma área escribe las dos formas.

### 1.2 Sin equivalente — propuesta de equivalencia

**Con evidencia sólida (recomiendo aprobar tal cual):**

| CDC del Excel | Filas | Monto | → CDC del ERP | Por qué |
|---|---|---|---|---|
| `GCUZCOAMBU` | 153 | S/60.54M | **`GCUSCOAMBU`** | Cuzco/Cusco. El del ERP ya apunta al proyecto *GORE CUSCO - AMBULANCIAS* y tiene 37 OCs y 172 gastos de caja |
| `MPCUSCOPNP` | 107 | S/12.90M | **`MPCUSCOSERENAZGO`** | Contenido: accesorios de camionetas de serenazgo. El ERP lo liga al proyecto *MP CUSCO - SERENAZGO* (36 OCs). Además el ingreso CIPRL de S/6,009,107 de este CDC coincide al sol con el "MONTO COBRADO" de *MP Cusco Serenazgo* en la hoja `Hoja3` |
| `MSS` | 252 | S/582k | **`MSS-30`** | Mismo parque: Chevrolet Joy, motos XPULSE, cambio de placas con SPAZIO & SERVICES, deducibles RIMAC/AUTOFONDO. El `MSS-30` del ERP tiene 129 OCs con exactamente esos proveedores y unidades |
| `DATABASE` | 8 | S/691 | **`BASE DE DATOS`** | Son las 8 líneas de Supabase. El CC del ERP existe y está libre (0 usos) |

**Requieren decisión de Kevin (no tienen equivalente y hay que crearlos):**

| CDC del Excel | Área | Filas | Monto | Nota |
|---|---|---|---|---|
| `REFINANCIAMIENTO - IGV MARZO 2024` | Contabilidad | 11 | S/54,469 | Existe `FRACCIONAMIENTO SUNAT`, pero es otro fraccionamiento. ¿CC nuevo o se absorbe? |
| `REFINANCIAMIENTO - RENTA 2024` | Contabilidad | 9 | S/94,248 | Igual que el anterior |
| `MARKETING Y DESARROLLO` | Administración | 5 | S/160,000 | Demos de tecnología, diseño de proyectos, viajes de búsqueda tecnológica. CC nuevo |
| `TERRENOS EEUU` | Administración | 1 | S/25,860 | Impuestos prediales atrasados en Florida. CC nuevo |

### 1.3 Duplicados dentro del propio ERP

Encontrados de paso; conviene resolverlos antes de migrar o quedan dos destinos para lo mismo:

| Código | Nombre | Uso hoy | Observación |
|---|---|---|---|
| `LICENCIAS` | Licencias | 0 OCs, 0 caja | **Duplicado exacto** con el siguiente |
| `LIC-TI` | Licencias | 0 OCs, 0 caja | Uno de los dos sobra |
| `GASTOS OFICINA CENTRAL` | Gastos Oficina Central | 0 OCs, 0 caja | El Excel de Administración usa este (448 filas) |
| `OFCENTRAL` | OFCENTRAL | 29 OCs | El Excel de Proyectos usa este (2 filas). **¿Son el mismo centro?** |

### 1.4 Basura a filtrar

En `BD ADMIN` hay una fila cuyo CDC dice literalmente **`Total`** (S/38,913,951) — es la fila de
totales de la hoja colándose como dato. El transform la descarta; se anota aquí para que no
sorprenda la diferencia de 1 fila.

---

## 2. Catálogo de categorías consolidado

Las 4 bases usan hoy **116 categorías distintas**. Propuesta: **15 grupos / 62 categorías**,
conservando cada valor original como alias para no perder información (P2).

### 2.1 Qué estaba mal en el original

- **Mayúsculas vs Título.** Proyectos, TI y Contabilidad escriben en mayúsculas; Administración
  en formato título. `MANTENIMIENTO` y `Mantenimiento` son dos categorías distintas hoy.
- **Administración usa la categoría como nombre de caso, no de categoría.** `Ugaz Macher`,
  `Ugaz Demartini`, `Ugaz Compliance`, `Ugaz Mediático`, `Surco Arbitraje`,
  `San Miguel Arbitraje`, `Ontier Informe Surco` son 7 categorías para lo mismo: asesoría legal.
  Igual con `Utilidad Miguel Zegarra` y `Utilidad Guillermo Macher`, que son la persona.
- **La moneda viajaba en la categoría.** `Caja chica soles` y `Caja chica dólares` son una sola
  categoría con un campo `moneda`.
- **La categoría repetía el CDC.** `Servicios socios`, `Arbitrios socios`,
  `Alquiler de vivienda socios`, `Mantenimiento socios` viven bajo el CDC `ALQUILER DE SOCIOS`.

### 2.2 Los 15 grupos

| Grupo | Categorías | Filas | Monto |
|---|---|---|---|
| INGRESOS Y COBRANZAS | 1 | 65 | S/123.90M — *ver sección 3, no va en CxP* |
| ADQUISICIÓN DE UNIDADES | 5 | 84 | S/39.64M |
| EQUIPAMIENTO | 8 | 651 | S/21.28M |
| MANTENIMIENTO Y REPARACIÓN | 4 | 347 | S/2.49M |
| SEGUROS Y GARANTÍAS | 2 | 153 | S/4.65M |
| GESTIÓN DE PROYECTO | 8 | 168 | S/20.13M |
| PERSONAL | 5 | 111 | S/3.50M |
| TRIBUTOS Y APORTES | 5 | 188 | S/12.35M |
| LEGAL | 4 | 136 | S/514k |
| OFICINA | 6 | 297 | S/1.25M |
| TECNOLOGÍA | 4 | 88 | S/102k |
| SOCIOS | 4 | 250 | S/25.51M |
| FINANCIAMIENTO | 3 | 68 | S/6.81M |
| COMERCIAL | 2 | 10 | S/201k |
| OTROS | 1 | 11 | S/203k |

### 2.3 Las fusiones que más colapsan

Las 116 originales quedan mapeadas al 100% (0 sin clasificar). Las fusiones relevantes:

| Categoría consolidada | Filas | Absorbe |
|---|---|---|
| LEGAL :: Asesoría legal | 121 | Ugaz Macher + Ugaz Demartini + Ugaz Compliance + Ugaz Mediático + Asesoría + Ontier Informe Surco |
| SOCIOS :: Vivienda y servicios de socios | 143 | Servicios socios + Arbitrios socios + Alquiler de vivienda socios + Mantenimiento socios |
| OFICINA :: Servicios básicos | 115 | Servicio de Luz + Dispensador de Agua + Celulares + Internet |
| EQUIPAMIENTO :: Equipamiento del vehículo | 106 | Equipamiento del vehículo + Habitáculo + Equipamiento del bus + Equipamiento |
| EQUIPAMIENTO :: Equipamiento médico | 105 | Equipamiento médico + Materiales e insumos médicos + Medicamento |
| EQUIPAMIENTO :: Telemetría y GPS | 103 | Equipamiento de telemetría + GPS + Comunicación |
| OFICINA :: Caja chica | 99 | Caja chica soles + Caja chica dólares |
| MANTENIMIENTO Y REPARACIÓN :: Mantenimiento | 84 | MANTENIMIENTO + Mantenimiento *(solo diferían en mayúsculas)* |
| FINANCIAMIENTO :: Préstamos | 61 | Préstamos socios + terceros + trabajadores |
| SEGUROS Y GARANTÍAS :: Fianzas | 53 | Fianzas + FIANZA |
| TECNOLOGÍA :: Infraestructura cloud | 25 | Despliegue + Database + Internet servidor + Servicios cloud + Hosting y dominios |

### 2.4 Dato a revisar con Operaciones

`MATERIALES E INSUMOS MEDICOS` (45 filas) y `MEDICAMENTO` (29 filas) tienen **importe cero en las
74 filas**. O están pendientes de costear o el monto se registró en otra línea. Conviene
aclararlo antes de migrar: hoy son 74 compromisos que no suman nada.

---

## 3. Ingresos — decisión

Las 65 líneas de `INGRESOS` de la base de Proyectos **no son una sola cosa**. Al abrirlas:

| Qué son | Filas | Monto (valor absoluto) | Dónde deben vivir |
|---|---|---|---|
| CIPRL y cobranzas de proyecto | 31 | S/122,882,468 | **`valorizaciones_proyecto`** |
| Arrendamientos y cobros recurrentes (C-OXI, MDI, INMPAN) | 32 | S/1,012,101 | **Cuentas por cobrar** |
| Saldos bancarios | 2 | S/5,844 | **Ninguna de las dos** — es saldo inicial de tesorería |
| | **65** | **S/123,900,413** | |

### Recomendación

**No meter ingresos en `cxp_compromisos`.** Es una tabla de cuentas por *pagar*; mezclar ingresos
obliga a filtrar por categoría en cada suma y es justo de donde salen los errores. Ejemplo real:
al calcular la deuda de Proyectos sin excluirlos, el total daba **−S/50M** en vez de S/49.4M,
porque los ingresos van en negativo y dominaban la suma.

El reparto que evita duplicar y evita ese error:

1. **CIPRL y cobranzas → `valorizaciones_proyecto`** (la tabla ya existe y está vacía). Ya tiene
   además la regla N16: cobrado = solo valorizaciones con CIPRL emitido. Ponerlas también en CxC
   sería duplicar el mismo hecho económico.
2. **Arrendamientos y cobros recurrentes → cuentas por cobrar**, con **la misma tabla y un campo
   `sentido` (`pagar` / `cobrar`)**, más dos vistas `v_cxp` y `v_cxc`.
3. **Saldos bancarios → fuera de ambas.** Son el saldo de apertura del flujo de caja (lo que la
   hoja `KPI Mensual` usa para la liquidez), no un compromiso.

**Por qué una tabla con `sentido` y no dos tablas.** Cobrar y pagar comparten toda la maquinaria:
vencimientos, calendario, recurrencias, `momento`, postergaciones, estados. Dos tablas duplican
ese motor y con el tiempo divergen. Una tabla con `sentido` no duplica nada, y el riesgo de
olvidar el filtro se elimina con las vistas: nadie consulta la tabla base directamente.

**Efecto secundario importante:** con `sentido` explícito, **todos los montos se guardan en
positivo**. Desaparece la convención de signo negativo del Excel, que es la que produce los
errores de cálculo.

---

## 4. Estado de las decisiones (27/08/2026)

| # | Decisión de Kevin | Estado |
|---|---|---|
| 1 | Aprobar las 4 equivalencias de CDC (§1.2) | ✅ **aprobadas**. Se aplican en el transform de la Fase B, no son filas nuevas |
| 2 | Los 4 CDC sin equivalencia hay que crearlos | ✅ **creados** en `centros_costo`: `REFINANCIAMIENTO - IGV MARZO 2024`, `REFINANCIAMIENTO - RENTA 2024`, `MARKETING Y DESARROLLO`, `TERRENOS EEUU` |
| 3 | "Son los mismos centros" (§1.3) | ✅ **consolidados**. Se conservó `OFCENTRAL` (29 OCs + 9 por texto + 3 requerimientos) renombrado a "Gastos Oficina Central" y se eliminó `GASTOS OFICINA CENTRAL`; se conservó `LICENCIAS` y se eliminó `LIC-TI`. Los dos eliminados tenían **0 referencias** en las 5 FK a `centros_costo` y en los campos de texto |
| 4 | Revisión del catálogo por cada área (§2) | ⏸ "lo vemos luego" |
| 5 | Las 74 filas de insumos médicos en cero (§2.4) | ⏸ "ya lo está viendo operaciones" |

`centros_costo` queda en **79** códigos.

### Equivalencias aprobadas — van al transform de la Fase B

```
GCUZCOAMBU  → GCUSCOAMBU
MPCUSCOPNP  → MPCUSCOSERENAZGO
MSS         → MSS-30
DATABASE    → BASE DE DATOS
GASTOS OFICINA CENTRAL → OFCENTRAL
```
Más la normalización de tildes y espacios dobles de §1.1.

Los puntos 3 de PLAN-CxP (quién aprueba qué) y 5 (alertas) siguen esperando: el primero al
archivo de usuarios y accesos, el segundo queda pendiente por decisión de Kevin.

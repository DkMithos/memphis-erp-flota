# Plan — Control de accesos: del menú a la base de datos

> Fecha: **27/08/2026**. Complementa lo ya construido (commit `f3f0234d`).
> Estado: **PLAN — pendiente de revisión de Kevin.** Nada de esto está implementado.

---

## 1. Dónde estamos

| Capa | Estado |
|---|---|
| **Menú** — no muestra lo que el usuario no puede abrir | ✅ hecho hoy |
| **Rutas** — bloquea si alguien teclea la URL | ✅ hecho hoy |
| **Acciones dentro de la pantalla** — botones crear/editar/aprobar/eliminar | ❌ **no existe** |
| **Base de datos (RLS)** — qué filas puede leer/escribir el rol | ⚠️ **solo por tenant** |

Las dos primeras capas ya cumplen lo que se ve. Las dos últimas son el hueco real.

## 2. El hueco, dicho sin rodeos

**RLS hoy solo separa empresas, no roles.** Las 113 políticas sobre 97 tablas comprueban
`tenant_id = auth_tenant_id()`. No miran el rol de quien pregunta.

Consecuencia concreta con el equipo que entra el lunes:

- José Ramirez (Técnico Flota) **no ve** Finanzas en el menú y **no puede** abrir
  `/finanzas/caja-chica`. Correcto.
- Pero su sesión es un JWT válido del tenant. Con ese token, una llamada directa a
  `/rest/v1/gastos_caja_chica` **devuelve los 969 gastos**. La API no sabe que él es de flota.

Para eso hace falta que la sesión de un navegador quede en manos de alguien con criterio técnico.
No es un riesgo de "cualquiera entra", pero **sí es un control que hoy no existe** y que en un
sistema con S/92M en compromisos conviene tener.

Lo mismo aplica a la escritura: nada impide a nivel de base que un rol de solo lectura haga un
`UPDATE` por API.

## 3. Qué se construye

### Fase 1 · Acciones dentro de la pantalla (2–3 días)

Que los botones respondan al permiso, no solo el menú.

- `<PermissionGuard modulo="compras" accion="aprobar">` envolviendo el botón de aprobar.
- Lo mismo para crear, editar, eliminar y exportar en cada módulo.
- Un usuario con solo `ver` entra a la lista pero no ve los botones de acción.

Es trabajo mecánico y de bajo riesgo: el hook `can()` ya existe y funciona.

**Prioridad alta.** Sin esto, Walter (Contabilidad, solo lectura en compras) ve el botón
"Aprobar orden" y al pulsarlo obtiene un error feo en vez de no verlo.

### Fase 2 · RLS por rol (4–5 días)

La parte de fondo. El patrón:

```sql
-- Una función que responde: ¿el usuario actual tiene este permiso?
create or replace function auth_tiene_permiso(p_modulo text, p_accion text)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from usuarios_roles ur
    join roles_permisos rp on rp.rol_id = ur.rol_id
    join permisos p on p.id = rp.permiso_id
    where ur.user_id = auth.uid()
      and ur.tenant_id = auth_tenant_id()
      and p.modulo = p_modulo and p.accion = p_accion
  );
$$;

-- Y las políticas dejan de mirar solo el tenant
create policy "compras_select" on ordenes_compra for select
  using (tenant_id = auth_tenant_id() and auth_tiene_permiso('compras','ver'));

create policy "compras_update" on ordenes_compra for update
  using (tenant_id = auth_tenant_id() and auth_tiene_permiso('compras','editar'));
```

**Tres cuidados que no se pueden saltar:**

1. **Rendimiento.** Una función así, llamada por fila, mata la consulta. Se envuelve en
   `(select auth_tiene_permiso(...))` para que Postgres la evalúe **una vez por consulta** y no
   una vez por fila. Con 1,286 órdenes y 969 gastos la diferencia es real.
2. **Orden de despliegue.** Si se aprietan las políticas antes de que los roles estén bien
   asignados, el equipo se queda sin datos y parece que el sistema se cayó. Va después de que los
   permisos estén validados en uso.
3. **Las Edge Functions no se ven afectadas**: usan la service key y saltan RLS por diseño. Hay
   que revisar una por una que sigan teniendo su propia validación (todas la tienen hoy).

### Fase 3 · Auditoría (1–2 días)

`audit_logs` existe, la pantalla existe, y **hay 0 filas y 0 triggers**. Con permisos finos y
datos financieros reales, saber quién aprobó, modificó o anuló deja de ser opcional.

Un trigger genérico sobre las tablas sensibles (`ordenes_compra`, `gastos_caja_chica`,
`comprobantes_pago`, `usuarios_roles`) que registre usuario, tabla, operación, antes y después.

## 4. Orden recomendado y por qué

| Cuándo | Qué | Razón |
|---|---|---|
| **Antes del lunes** | nada más | Lo del menú y las rutas ya cubre el día uno |
| Semana 1 post-lanzamiento | **Fase 1** (botones) | Barato, visible, evita errores feos |
| Semana 1 | **Fase 3** (auditoría) | Cuanto antes empiece a registrar, más historia útil |
| Semanas 2–3 | **Fase 2** (RLS) | La más delicada; conviene hacerla con el sistema ya en uso y los roles validados en la práctica |

**No recomiendo tocar RLS antes del lunes.** Un error ahí deja al equipo sin datos el día del
lanzamiento, y el beneficio no compensa: el riesgo que cubre exige que alguien con conocimiento
técnico use deliberadamente el token de otro.

## 5. Decisiones que necesito de Kevin

1. **¿Confirmas el orden?** (Fase 1 y 3 la semana que viene, Fase 2 después.)
2. **En RLS, ¿lectura por rol o solo escritura?** Restringir la lectura es más seguro pero rompe
   más cosas (los dashboards cruzados y BI leen de varios módulos). Una alternativa es dejar la
   lectura por tenant y restringir solo la escritura, que es donde está el daño real.
3. **¿Qué tablas entran primero?** Mi propuesta: `ordenes_compra`, `orden_items`,
   `gastos_caja_chica`, `ingresos_caja_chica`, `cajas_chicas`, `comprobantes_pago` y
   `usuarios_roles`. El resto después.

## 6. Anexo — lo que ya quedó cubierto hoy

- `rutas.ts`: mapa ruta → permiso, única fuente de verdad.
- Menú filtrado por módulo **y por sub-ítem**.
- Bloqueo por URL con la pantalla `SinAcceso`.
- Permiso propio `compras.recepcionar` para que Flota y Proyectos usen Recepciones sin ver el
  resto de Compras.
- Rol `Contabilidad` y módulo de contabilidad habilitado (estaba invisible para todos).
- Inventario, CRM y Biomédico ocultos.

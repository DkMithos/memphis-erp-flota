# App móvil "Memphis Viajes" (/app)

> 2026-10-16 · Sprint 5 (2/2). Pedido de Kevin: una app rápida para el personal en viaje que cargue todo al ERP, primero
> como portal y luego como app para Android e iOS.

## Qué es hoy

- La misma SPA del ERP, en la ruta **`/app`**, con una cáscara para celular (sin menú lateral ni barra superior):
  pantallas Inicio (mis viajes), Solicitar, el detalle del viaje (reservas, adelanto, **rendir con foto del comprobante**),
  Por aprobar (jefatura y Administración) y Cuenta.
- Es una **PWA**: `public/manifest.webmanifest` + `public/sw.js` (alcance `/app`, cachea solo el cascarón; los datos van a
  Supabase en vivo) + iconos `public/icons/app-192.png` y `app-512.png`. En el celular se instala desde el navegador
  ("Agregar a pantalla de inicio") o con el botón "Instalar" que aparece en la app cuando el navegador lo permite.
- Entra cualquier usuario del ERP con un rol. Para el personal que no usa módulos existe el rol **Personal** (sin
  permisos): Kevin lo asigna en Admin › Usuarios y la persona ya puede solicitar y rendir SUS viajes. Jefatura
  (`viajes.aprobar`: Gerencia y Proyectos) y Carolina (`viajes.aprobar_final`: Administración) ven además "Por aprobar".
- Los datos son las mismas tablas (`viajes`, `viaje_pasajeros`, `viaje_reservas`, `viaje_rendiciones`,
  `viaje_rendicion_items`) y las fotos van al bucket privado `viajes-sustentos/<tenant>/<viaje>/…`. No hay sincronización
  aparte: lo que se hace en el celular aparece en Administración › Viajes al instante.

## URL para el personal

`https://erp.memphismaquinarias.com/app` — pedir que la guarden en la pantalla de inicio. Inician sesión con su correo
@memphis.pe (misma cuenta del ERP; Microsoft también sirve).

## Cuando se quiera en Play Store / App Store

La PWA ya cubre instalación, pantalla completa, cámara y uso con poca señal. Para publicarla en las tiendas el camino
más corto es **Capacitor** (envuelve esta misma web en una app nativa):

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init "Memphis Viajes" pe.memphis.viajes --web-dir build
# capacitor.config.ts → server: { url: 'https://erp.memphismaquinarias.com/app', cleartext: false }
npx cap add android && npx cap add ios
npx cap open android   # Android Studio → firmar → Play Console
npx cap open ios       # Xcode (Mac) → App Store Connect
```

- Con `server.url` apuntando al ERP, la app nativa carga siempre la versión desplegada en Vercel: no hay que republicar en
  las tiendas por cada cambio del ERP.
- Hace falta: cuenta de Google Play Console (USD 25 una vez), Apple Developer Program (USD 99/año) y un Mac con Xcode para
  iOS. Las notificaciones push nativas se añaden después con `@capacitor/push-notifications` (hoy las aprobaciones se ven
  al abrir la app y en las notificaciones del ERP).

## Flujo (fijado por Kevin el 16/10/2026)

| Paso | Quién | Dónde |
|---|---|---|
| Solicitar viaje y viáticos | el trabajador (o Administración por él) | app o ERP |
| Aprobación 1 | jefatura (`viajes.aprobar`) | app "Por aprobar" o ERP |
| Aprobación final | Carolina / Administración (`viajes.aprobar_final`) | app o ERP |
| Pasajes y adelantos | Administración (`viajes.editar`) | ERP (también desde la app) |
| Rendición | el trabajador, con fotos | app |
| Revisión y firma | jefatura | app o ERP |
| Aprobación y liquidación | Carolina; reembolso o devolución | ERP |

Topes de la política (tarifas): se sugieren y se marcan cuando se exceden; no bloquean. La justificación queda escrita y la
aprobación de jefatura o Gerencia la convalida, como dice la política.

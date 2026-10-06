import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/globals.css";
import { AuthProvider } from "./auth/AuthProvider.tsx";
import './lib/i18n';
import 'leaflet/dist/leaflet.css';
import { initErrorMonitor } from './lib/shared/error-monitor';
import { initSentry } from './lib/shared/sentry';

// Sentry primero (configura el reporter), luego la captura global de errores
initSentry();
initErrorMonitor();

// Tras un despliegue nuevo, una pestaña abierta con la versión anterior pide
// chunks (jspdf, jszip, vistas lazy) cuyo hash ya no existe y Vercel devuelve el
// index.html → "Failed to fetch dynamically imported module". Recargamos una
// sola vez para traer la versión vigente; el guardia evita un bucle si el
// error es por otra causa (sin red, etc.).
window.addEventListener('vite:preloadError', (event) => {
  const clave = 'memphis-erp:recarga-por-version';
  const ultima = Number(sessionStorage.getItem(clave) ?? 0);
  if (Date.now() - ultima < 30_000) return; // ya recargamos hace poco: deja ver el error
  event.preventDefault();
  sessionStorage.setItem(clave, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<AuthProvider><App /></AuthProvider>);

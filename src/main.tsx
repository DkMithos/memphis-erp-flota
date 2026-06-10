import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./auth/AuthProvider.tsx";
import './lib/i18n';
import 'leaflet/dist/leaflet.css';
import { initErrorMonitor } from './lib/shared/error-monitor';

// Captura global de errores no manejados (listo para Sentry)
initErrorMonitor();

createRoot(document.getElementById("root")!).render(<AuthProvider><App /></AuthProvider>);

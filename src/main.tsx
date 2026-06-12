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

createRoot(document.getElementById("root")!).render(<AuthProvider><App /></AuthProvider>);

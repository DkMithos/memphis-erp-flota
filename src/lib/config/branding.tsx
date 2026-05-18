/**
 * Memphis ERP — Branding de la Plataforma (Memphis Maquinarias S.A.C.)
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  SEPARACIÓN DE BRANDINGS                                             │
 * ├──────────────────────────┬──────────────────────────────────────────┤
 * │  PLATAFORMA (este archivo)│  TENANT (useTenantBranding hook)         │
 * │  Memphis ERP como producto│  Marca del cliente (KESA, etc.)          │
 * │  Dónde aparece:           │  Dónde aparece:                          │
 * │  · Login (header + footer)│  · Logo en sidebar                       │
 * │  · LoadingScreen          │  · Nombre en topbar                      │
 * │  · Footer de PDFs/QR      │  · Encabezado de reportes                │
 * │  · Comentarios de código  │  · Color primario del sistema            │
 * │  Fuente: constantes aquí  │  Fuente: tabla tenants en Supabase        │
 * └──────────────────────────┴──────────────────────────────────────────┘
 */

// ─── Datos de la plataforma ───────────────────────────────────────────────────
export const PLATFORM = {
  name: 'Memphis ERP',
  tagline: 'Sistema Empresarial Integrado',
  company: 'Memphis Maquinarias S.A.C.',
  website: 'https://memphis-erp.com',
  supportEmail: 'soporte@memphis-erp.com',
  version: '2.0',
} as const;

// ─── Colores de marca Memphis (dorado + gris oscuro) ─────────────────────────
export const PLATFORM_COLORS = {
  gold: '#F8C119',
  goldDark: '#BA9113',
  goldLight: '#FAD54D',
  gray: '#666666',
  dark: '#111827',
} as const;

// ─── Ícono geométrico Memphis (símbolo de pirámide/M) — SVG inline ────────────
// Extraído de ICON.svg / LOGO MEMPHIS-02.svg (solo la forma geométrica)
export function MemphisIconSVG({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 370.78 406.38"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Memphis ERP"
    >
      <polygon fill="#F8C119" points="0 406.38 101.09 282.19 101.09 40.4 0 90.5 0 406.38" />
      <polygon fill="#BA9113" points="370.78 406.38 269.69 282.19 269.69 40.4 370.78 90.5 370.78 406.38" />
      <polygon fill="#BA9113" points="185.39 406.38 185.39 106.25 185.39 0 248.39 30.88 185.39 406.38" />
      <polygon fill="#F8C119" points="185.39 406.38 185.39 106.25 185.39 0 122.39 30.88 185.39 406.38" />
      <polygon fill="#F8C119" points="269.69 40.4 370.78 406.38 269.69 282.19 269.69 40.4" />
      <polygon fill="#BA9113" points="101.09 40.4 101.09 282.19 0 406.38 101.09 40.4" />
    </svg>
  );
}

// ─── Logo horizontal (símbolo + texto "MEMPHIS") ─────────────────────────────
// Útil para login, loading screen, documentos impresos
export function MemphisLogoSVG({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 912.89 406.38"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Memphis ERP"
    >
      {/* Símbolo geométrico */}
      <polygon fill="#F8C119" points="0 406.38 101.09 282.19 101.09 40.4 0 90.5 0 406.38" />
      <polygon fill="#BA9113" points="370.78 406.38 269.69 282.19 269.69 40.4 370.78 90.5 370.78 406.38" />
      <polygon fill="#BA9113" points="185.39 406.38 185.39 106.25 185.39 0 248.39 30.88 185.39 406.38" />
      <polygon fill="#F8C119" points="185.39 406.38 185.39 106.25 185.39 0 122.39 30.88 185.39 406.38" />
      <polygon fill="#F8C119" points="269.69 40.4 370.78 406.38 269.69 282.19 269.69 40.4" />
      <polygon fill="#BA9113" points="101.09 40.4 101.09 282.19 0 406.38 101.09 40.4" />
      {/* Texto MEMPHIS */}
      <rect fill="#666" x="522.3" y="183.66" width="13.68" height="73.33" />
      <rect fill="#666" x="752.22" y="183.66" width="13.68" height="73.33" />
      <rect fill="#666" x="827.78" y="183.66" width="13.68" height="73.33" />
      <rect fill="#666" x="800.82" y="183.66" width="13.68" height="73.33" />
      <polygon fill="#666" points="497.26 183.66 487.53 183.66 467.03 237.8 446.52 183.66 436.79 183.66 423.78 183.66 423.78 256.99 436.79 256.99 436.79 194.14 460.53 256.88 473.53 256.88 497.26 194.14 497.26 256.99 510.27 256.99 510.27 183.66 497.26 183.66" />
      <polygon fill="#666" points="657.85 183.66 648.13 183.66 627.62 237.8 607.11 183.66 597.39 183.66 584.37 183.66 584.37 256.99 597.39 256.99 597.39 194.14 621.12 256.88 634.12 256.88 657.85 194.14 657.85 256.99 670.87 256.99 670.87 183.66 657.85 183.66" />
      <path fill="#666" d="M725.35,183.66h-41.21v73.33h13.36v-23.63h27.85c9.74,0,17.63-7.89,17.63-17.63v-14.44c0-9.74-7.89-17.63-17.63-17.63ZM728.9,212.17c0,5.07-4.11,9.19-9.19,9.19h-22.22v-26.07h22.22c5.07,0,9.19,4.11,9.19,9.19v7.7Z" />
      <path fill="#666" d="M896.61,204.55h13.63s.19-12.65-4.63-16.98c-5.22-4.69-13.15-4.35-16.56-4.35s-21.19-1.04-28.52,3.04c-7.33,4.07-7.78,12.3-7.78,15.78s-.15,16.22,6.22,19.41c6.37,3.19,16.44,3.56,20,3.56s10.96.67,13.26,1.04,6.3,2.3,6.3,6.37,1.65,13.83-8.72,13.83-14.57.24-18.5-.06-5.43-3.85-5.5-6.89c-.07-3.04-.17-4.96-.17-4.96l-13.56-.15s.15,9.19.83,11.72c1.17,4.33,4.87,11.02,17.76,11.09s20.37,0,23.41,0,15.54-.59,16.81-12.3,1.33-21.19-3.48-25.48-16.67-4.89-24.89-5.19-16.37.59-16.07-9.11c.3-9.7,4.15-10.82,13.48-10.89,10.22-.07,17.04-1.33,16.67,10.52Z" />
    </svg>
  );
}

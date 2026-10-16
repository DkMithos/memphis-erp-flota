/* Memphis Viajes — service worker de la app móvil (alcance /app).
 * Solo guarda el cascarón para que la app abra sin red y para que el navegador la deje instalar.
 * Los datos siempre van a Supabase en vivo; nada de la API se cachea. */
const CACHE = 'memphis-viajes-v1';
const CASCARON = ['/app', '/manifest.webmanifest', '/icons/app-192.png', '/icons/app-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCARON)).catch(() => undefined));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/storage/')) return;
  // Navegación dentro de /app: red primero; si no hay red, el cascarón guardado.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { caches.open(CACHE).then((c) => c.put('/app', r.clone())); return r; })
      .catch(() => caches.match('/app')));
    return;
  }
  // Assets con hash de Vite: cache primero (son inmutables).
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { caches.open(CACHE).then((c) => c.put(e.request, r.clone())); return r; })));
  }
});

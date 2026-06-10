/**
 * Acceso seguro a localStorage.
 *
 * En modo privado, dentro de iframes, o con cookies/almacenamiento bloqueado,
 * `localStorage` lanza excepción. Estos helpers nunca lanzan: devuelven un
 * valor por defecto en lectura y silencian el fallo en escritura.
 */

export function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible — ignorar silenciosamente */
  }
}

export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignorar */
  }
}

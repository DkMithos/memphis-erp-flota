/**
 * useDarkMode — Hook reactivo para detectar el tema activo (claro/oscuro).
 *
 * Observa cambios en la clase `dark` de `<html>` mediante MutationObserver,
 * permitiendo que los componentes se actualicen inmediatamente cuando el
 * usuario toggle el modo desde el topbar, sin necesidad de recargar la página.
 *
 * USO CORRECTO:
 *   const isDark = useDarkMode();
 *   const color = isDark ? '#f0c000' : '#000000';
 *
 * ❌ NO usar directamente:
 *   document.documentElement.classList.contains('dark')
 *   → No es reactivo, el componente NO se actualizará al cambiar de modo.
 *
 * Patrón recomendado SIEMPRE que un valor inline (style, hex hardcoded)
 * deba variar entre modos. Para clases Tailwind con `dark:` prefix NO se
 * necesita este hook — Tailwind ya maneja la reactividad vía CSS.
 */
import { useEffect, useState } from 'react';

export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    // Estado inicial sincronizado por si cambió entre el render y el effect
    setIsDark(html.classList.contains('dark'));

    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains('dark'));
    });

    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

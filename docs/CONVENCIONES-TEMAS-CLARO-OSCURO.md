# 🌗 Convenciones para Modo Claro y Modo Oscuro

> **Propósito**: Garantizar que cambios visuales en un modo NO afecten al otro,
> evitando bugs silenciosos y reduciendo tiempo de debugging.

---

## ⚙️ Configuración base del sistema

### Tailwind config
**`tailwind.config.js` DEBE tener `darkMode: 'class'`**.

```js
export default {
  darkMode: 'class',  // ← obligatorio
  content: [...],
  ...
};
```

**¿Por qué?** Sin esta línea Tailwind usa preferencia del SO (`media`), lo que
hace que los `dark:` variants se activen según Windows/macOS aunque la app esté
en modo claro. **Causa raíz del bug** que tuvimos durante varias sesiones.

### CSS Variables (en `src/styles/globals.css`)
Las variables CSS se definen dos veces:

```css
:root {
  --background: #F1F5F9;
  --card: #F1F5F9;
  --foreground: #111827;
  /* ... */
}

.dark {
  --background: #0D0D0D;
  --card: #1A1A1A;
  --foreground: #F5F5F5;
  /* ... */
}
```

**Tailwind las consume vía clases**: `bg-background`, `bg-card`, `text-foreground`, etc.
Cuando el navegador añade/quita la clase `.dark` en `<html>`, las variables
cambian automáticamente y todo el sistema se actualiza.

---

## ✅ HACER

### 1. Usar clases Tailwind con `dark:` prefix para estilos exclusivos
```jsx
// ✅ Adaptable a ambos modos
className="bg-white dark:bg-card text-black dark:text-white"
```

### 2. Usar CSS variables cuando el color debe cambiar entre modos
```jsx
// ✅ Auto-adaptable: usa --card que está definido en :root y en .dark
className="bg-card text-foreground border-border"
```

### 3. Usar clases Tailwind con escala fija para colores semánticos
```jsx
// ✅ Mismo color en ambos modos (intencional)
className="bg-blue-500 text-white"  // KPI azul
className="bg-red-600 text-white"   // Botón eliminar
className="bg-green-600 text-white" // Estado activo
```

### 4. Usar el hook `useDarkMode()` cuando necesites un valor inline reactivo
```jsx
import { useDarkMode } from '@/hooks/useDarkMode';

function MiComponente() {
  const isDark = useDarkMode();
  const colorAccent = isDark ? '#f0c000' : '#000000';

  return <div style={{ borderLeftColor: colorAccent }}>...</div>;
}
```

---

## ❌ NO HACER

### 1. NO usar `style` inline con hex hardcoded sin condicionar por modo
```jsx
// ❌ MAL — se ve negro en AMBOS modos (no se adapta)
<div style={{ color: '#000000' }}>...</div>

// ✅ BIEN — usa el hook si necesitas inline
const isDark = useDarkMode();
<div style={{ color: isDark ? '#FFFFFF' : '#000000' }}>...</div>

// ✅ MEJOR — usa Tailwind directamente
<div className="text-black dark:text-white">...</div>
```

### 2. NO detectar dark mode con `document.documentElement.classList.contains('dark')` directamente
```jsx
// ❌ MAL — NO es reactivo, no se actualiza al toggle del usuario
const isDark = document.documentElement.classList.contains('dark');

// ✅ BIEN — reactivo con MutationObserver
const isDark = useDarkMode();
```

### 3. NO usar `!important` como default
```jsx
// ❌ MAL — abusa de !important
className="!bg-red-500 !text-white"

// ✅ BIEN — usa !important solo si hay conflicto real con shadcn/Tailwind variant
className="bg-red-500 text-white"
```

### 4. NO olvidar `dark:hover:!...` cuando personalizas hover en modo claro

```jsx
// ❌ MAL — el hover negro se aplica también en modo oscuro
<Button className="hover:!bg-black hover:!text-white" />

// ✅ BIEN — preserva el hover original de shadcn en modo oscuro
<Button className="hover:!bg-black hover:!text-white hover:!border-black
                   dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input" />
```

**Regla**: SIEMPRE que sobrescribas un hover con clases personalizadas (especialmente con `!important`), agrega los `dark:hover:!...` correspondientes para que el modo oscuro mantenga su comportamiento.

### 5. NO mezclar `bg-white` cuando quieres outline design
```jsx
// ❌ MAL — en modo claro será blanco puro (no matching con la página)
className="bg-white dark:bg-card"

// ✅ BIEN — bg-card matching la página en ambos modos
className="bg-card"
```

---

## 🧪 Checklist obligatorio antes de hacer commit

Cada vez que toques estilos visuales, verifica:

- [ ] **¿Probé en modo claro?** (toggle sol en topbar)
- [ ] **¿Probé en modo oscuro?** (toggle luna en topbar)
- [ ] **¿El `dark:` prefix está aplicado donde corresponde?**
- [ ] **¿Usé `style` inline solo si era estrictamente necesario?**
- [ ] **Si usé inline con color dependiente del modo, ¿usé `useDarkMode()`?**
- [ ] **¿Toggleé el modo en vivo (sin recargar) para verificar reactividad?**

---

## 🩺 Cómo debuggear un estilo que se ve mal

1. **Inspecciona el elemento** en DevTools (F12).
2. **Mira la columna "Styles"**: ¿qué clases CSS están activas?
3. **Si ves una clase `dark:`** activa cuando no debería:
   - Verifica que `<html>` NO tenga la clase `dark` cuando esperas modo claro.
   - Verifica que `tailwind.config.js` tenga `darkMode: 'class'`.
4. **Si una clase Tailwind no se aplica** aunque la pusiste:
   - Verifica especificidad: shadcn variants (`bg-card`, `border-input`) pueden
     sobrescribir. Usa `!` (ej. `!bg-red-500`) solo si necesario.
   - Verifica que Vite haya recompilado (reinicia dev server si es necesario).

---

## 📁 Archivos clave

| Archivo | Propósito |
|---|---|
| `tailwind.config.js` | `darkMode: 'class'` activado |
| `src/styles/globals.css` | Variables CSS para `:root` y `.dark` |
| `src/hooks/useDarkMode.ts` | Hook reactivo para detección de modo |
| `src/App.tsx` (~líneas 200-235) | Lógica que añade/quita clase `dark` a `<html>` |
| `src/components/layout/ERPTopbar.tsx` | Toggle sol/luna del usuario |

---

## 📚 Referencias

- Tailwind Dark Mode: https://tailwindcss.com/docs/dark-mode
- React MutationObserver pattern: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver

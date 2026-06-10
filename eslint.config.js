import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * Configuración ESLint (flat config, ESLint 9).
 *
 * Filosofía pragmática para un codebase grande ya existente:
 * - Las reglas que cazan BUGS REALES se mantienen como error
 *   (react-hooks/rules-of-hooks, no-undef, no-cond-assign).
 * - Las reglas de estilo / preferencia se bajan a warn o se apagan
 *   para no inundar de ruido (no-explicit-any, no-unused-vars como warn).
 *
 * Correr con: npm run lint
 */
export default tseslint.config(
  { ignores: ['build', 'dist', 'node_modules', 'supabase', 'scripts', '*.config.js', '*.config.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Reglas que cazan bugs reales — se mantienen estrictas
      'react-hooks/rules-of-hooks': 'error',

      // Preferencias de estilo — relajadas para no inundar en un codebase grande
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-empty': 'warn',
      'prefer-const': 'warn',
    },
  },
);

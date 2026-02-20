/**
 * LAYOUT CONSTANTS
 * Constantes centralizadas para dimensiones del layout ERP
 * Evita valores mágicos hardcodeados
 */

/**
 * Altura del Topbar principal del ERP
 * @value 64px (equivalente a h-16 de Tailwind)
 */
export const LAYOUT_TOPBAR_HEIGHT = 64;

/**
 * Ancho del Sidebar en desktop
 * @value 256px (equivalente a w-64 de Tailwind)
 */
export const LAYOUT_SIDEBAR_WIDTH = 256;

/**
 * Z-index del Topbar
 * @value 10
 */
export const LAYOUT_TOPBAR_Z_INDEX = 10;

/**
 * Z-index para contenido de páginas print/full-screen
 * @value 5 (debajo del topbar pero encima del contenido normal)
 */
export const LAYOUT_PRINT_PAGE_Z_INDEX = 5;

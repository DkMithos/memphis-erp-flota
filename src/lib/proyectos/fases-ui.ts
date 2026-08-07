/**
 * Fases (etapas) de proyecto — reglas de presentación colapsable (N27, pedido de
 * Operaciones):
 *   1. Las etapas son colapsables.
 *   2. Las etapas SIN datos inician colapsadas.
 *   3. "Ejecución" inicia desplegada (siempre, tenga o no datos).
 * Se comparte entre ProyectoDetalle (tab Fases) y Proyecto360 para que ambas
 * vistas se comporten igual.
 */
import type { Fase } from './proyectos-store';

/** Etapa que SIEMPRE inicia desplegada (decisión de Operaciones) */
export const FASE_SIEMPRE_ABIERTA = 'ejecución';

/** Normaliza para comparar nombres de etapa sin acentos ni mayúsculas */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

export function esFaseEjecucion(nombre: string): boolean {
  return norm(nombre) === norm(FASE_SIEMPRE_ABIERTA);
}

/**
 * ¿La etapa tiene información que mostrar? Se considera CON datos si tiene
 * descripción, fechas, avance, montos o tareas asociadas. Una etapa recién
 * creada por plantilla (solo nombre y orden) cuenta como SIN datos.
 */
export function faseTieneDatos(fase: Fase, tareasDeLaFase = 0): boolean {
  return Boolean(
    (fase.descripcion && fase.descripcion.trim() !== '') ||
    fase.fechaInicio ||
    fase.fechaFin ||
    (fase.porcentajeAvance ?? 0) > 0 ||
    (fase.presupuesto ?? 0) > 0 ||
    (fase.costoReal ?? 0) > 0 ||
    tareasDeLaFase > 0
  );
}

/** Estado inicial de apertura: Ejecución siempre abierta; el resto, solo si tiene datos. */
export function faseInicialAbierta(fase: Fase, tareasDeLaFase = 0): boolean {
  return esFaseEjecucion(fase.nombre) || faseTieneDatos(fase, tareasDeLaFase);
}

/** Conjunto inicial de ids de fases abiertas para una lista de fases. */
export function fasesAbiertasInicial(
  fases: Fase[],
  contarTareas: (faseDbId: string) => number = () => 0,
): Set<string> {
  return new Set(
    fases.filter(f => faseInicialAbierta(f, contarTareas(f._dbId))).map(f => f._dbId),
  );
}

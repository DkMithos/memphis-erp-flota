/**
 * KESA ERP - Flota → Documentos/Vigencias
 * Data model, tipos y validaciones para documentos de vehículos
 * v1.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Tipos de documentos válidos para vehículos
 */
export type TipoDocumentoVehiculo =
  | 'SOAT'
  | 'REVISION_TECNICA'
  | 'TARJETA_PROPIEDAD'
  | 'SEGURO_VEHICULAR'
  | 'PERMISO_OPERACION'
  | 'OTRO';

/**
 * Estado calculado del documento (NO se guarda, se calcula)
 */
export type EstadoDocumentoCalculado = 'vigente' | 'proximo' | 'vencido';

/**
 * Documento de vehículo
 */
export interface VehiculoDocumento {
  id: string;
  tipo: TipoDocumentoVehiculo;
  nombre: string; // Nombre descriptivo (ej: "SOAT 2024")
  numero?: string; // Número del documento (ej: "SOAT-2024-001")
  fechaEmision?: string; // ISO date
  fechaVencimiento: string; // ISO date (OBLIGATORIO)
  archivoNombre?: string; // Placeholder para nombre del archivo adjunto
  observaciones?: string;
  
  // Auditoría
  creadoPor?: string;
  creadoEn?: string; // ISO datetime
  modificadoPor?: string;
  modificadoEn?: string; // ISO datetime
}

/**
 * Documento con estado calculado (para UI)
 */
export interface VehiculoDocumentoConEstado extends VehiculoDocumento {
  estadoCalculado: EstadoDocumentoCalculado;
  diasRestantes: number | null;
}

/**
 * Filtros para documentos
 */
export interface DocumentosFiltros {
  estado?: EstadoDocumentoCalculado | 'todos';
  tipo?: TipoDocumentoVehiculo | 'todos';
  busqueda?: string; // Búsqueda en placa, modelo, número documento
}

/**
 * KPIs de documentos
 */
export interface DocumentosKPIs {
  totalDocumentos: number;
  vigentes: number;
  proximos: number;
  vencidos: number;
  porcentajeVigentes: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Labels para tipos de documentos
 */
export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumentoVehiculo, string> = {
  SOAT: 'SOAT',
  REVISION_TECNICA: 'Revisión Técnica',
  TARJETA_PROPIEDAD: 'Tarjeta de Propiedad',
  SEGURO_VEHICULAR: 'Seguro Vehicular',
  PERMISO_OPERACION: 'Permiso de Operación',
  OTRO: 'Otro'
};

/**
 * Umbral de días para considerar documento "próximo a vencer"
 */
export const UMBRAL_DIAS_PROXIMO = 30;

// ============================================================================
// HELPERS: CÁLCULO DE ESTADO
// ============================================================================

/**
 * Calcula el estado de un documento según su fecha de vencimiento
 * 
 * Reglas:
 * - Si hoy > vencimiento → vencido
 * - Si faltan <= 30 días → proximo
 * - Else → vigente
 * 
 * @param fechaVencimiento - Fecha de vencimiento (ISO)
 * @param umbralDias - Umbral de días para "próximo" (default: 30)
 * @returns Estado calculado
 */
export function calcularEstadoDocumento(
  fechaVencimiento: string,
  umbralDias: number = UMBRAL_DIAS_PROXIMO
): EstadoDocumentoCalculado {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche
  
  const vencimiento = new Date(fechaVencimiento);
  vencimiento.setHours(0, 0, 0, 0);
  
  const diffMs = vencimiento.getTime() - hoy.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diasRestantes < 0) {
    return 'vencido';
  } else if (diasRestantes <= umbralDias) {
    return 'proximo';
  } else {
    return 'vigente';
  }
}

/**
 * Calcula días restantes hasta vencimiento
 * 
 * @param fechaVencimiento - Fecha de vencimiento (ISO)
 * @returns Días restantes (negativo si ya venció)
 */
export function calcularDiasRestantes(fechaVencimiento: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const vencimiento = new Date(fechaVencimiento);
  vencimiento.setHours(0, 0, 0, 0);
  
  const diffMs = vencimiento.getTime() - hoy.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Enriquece un documento con estado calculado
 * 
 * @param documento - Documento base
 * @returns Documento con estado calculado
 */
export function enriquecerDocumentoConEstado(
  documento: VehiculoDocumento
): VehiculoDocumentoConEstado {
  const diasRestantes = calcularDiasRestantes(documento.fechaVencimiento);
  const estadoCalculado = calcularEstadoDocumento(documento.fechaVencimiento);
  
  return {
    ...documento,
    estadoCalculado,
    diasRestantes
  };
}

// ============================================================================
// HELPERS: KPIs
// ============================================================================

/**
 * Calcula KPIs de documentos
 * 
 * @param documentos - Lista de documentos con estado
 * @returns KPIs calculados
 */
export function calcularDocumentosKPIs(
  documentos: VehiculoDocumentoConEstado[]
): DocumentosKPIs {
  const totalDocumentos = documentos.length;
  const vigentes = documentos.filter(d => d.estadoCalculado === 'vigente').length;
  const proximos = documentos.filter(d => d.estadoCalculado === 'proximo').length;
  const vencidos = documentos.filter(d => d.estadoCalculado === 'vencido').length;
  
  const porcentajeVigentes = totalDocumentos > 0
    ? Math.round((vigentes / totalDocumentos) * 100)
    : 100;
  
  return {
    totalDocumentos,
    vigentes,
    proximos,
    vencidos,
    porcentajeVigentes
  };
}

// ============================================================================
// HELPERS: VALIDACIÓN
// ============================================================================

/**
 * Valida un documento antes de crearlo/actualizarlo
 * 
 * @param documento - Documento a validar
 * @returns Array de errores (vacío si válido)
 */
export function validarDocumento(
  documento: Partial<VehiculoDocumento>
): string[] {
  const errores: string[] = [];
  
  // Tipo obligatorio
  if (!documento.tipo) {
    errores.push('El tipo de documento es obligatorio');
  }
  
  // Nombre obligatorio
  if (!documento.nombre || documento.nombre.trim() === '') {
    errores.push('El nombre del documento es obligatorio');
  }
  
  // Fecha de vencimiento obligatoria
  if (!documento.fechaVencimiento) {
    errores.push('La fecha de vencimiento es obligatoria');
  } else {
    // Validar formato de fecha
    const fecha = new Date(documento.fechaVencimiento);
    if (isNaN(fecha.getTime())) {
      errores.push('La fecha de vencimiento no es válida');
    }
  }
  
  // Si hay fecha de emisión, validar
  if (documento.fechaEmision) {
    const fechaEmision = new Date(documento.fechaEmision);
    if (isNaN(fechaEmision.getTime())) {
      errores.push('La fecha de emisión no es válida');
    }
    
    // Fecha de emisión debe ser anterior o igual a vencimiento
    if (documento.fechaVencimiento) {
      const fechaVencimiento = new Date(documento.fechaVencimiento);
      if (fechaEmision > fechaVencimiento) {
        errores.push('La fecha de emisión no puede ser posterior a la fecha de vencimiento');
      }
    }
  }
  
  return errores;
}

// ============================================================================
// HELPERS: GENERACIÓN DE IDs
// ============================================================================

/**
 * Genera ID único para documento
 * Formato: DOC-{timestamp}-{random}
 * 
 * @returns ID único
 */
export function generarDocumentoId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `DOC-${timestamp}-${random}`.toUpperCase();
}

// ============================================================================
// HELPERS: FILTRADO
// ============================================================================

/**
 * Aplica filtros a lista de documentos
 * 
 * @param documentos - Documentos con estado
 * @param filtros - Filtros a aplicar
 * @param vehiculos - Lista de vehículos (para búsqueda por placa/modelo)
 * @returns Documentos filtrados
 */
export function filtrarDocumentos(
  documentos: Array<VehiculoDocumentoConEstado & { vehiculoId: string }>,
  filtros: DocumentosFiltros,
  vehiculos: Array<{ id: string; placa: string; marca: string; modelo: string }>
): Array<VehiculoDocumentoConEstado & { vehiculoId: string }> {
  let resultado = [...documentos];
  
  // Filtro por estado
  if (filtros.estado && filtros.estado !== 'todos') {
    resultado = resultado.filter(d => d.estadoCalculado === filtros.estado);
  }
  
  // Filtro por tipo
  if (filtros.tipo && filtros.tipo !== 'todos') {
    resultado = resultado.filter(d => d.tipo === filtros.tipo);
  }
  
  // Búsqueda en placa, modelo, número documento
  if (filtros.busqueda && filtros.busqueda.trim() !== '') {
    const query = filtros.busqueda.toLowerCase();
    resultado = resultado.filter(d => {
      // Buscar en número de documento
      if (d.numero && d.numero.toLowerCase().includes(query)) {
        return true;
      }
      
      // Buscar en nombre
      if (d.nombre.toLowerCase().includes(query)) {
        return true;
      }
      
      // Buscar en placa/modelo del vehículo
      const vehiculo = vehiculos.find(v => v.id === d.vehiculoId);
      if (vehiculo) {
        if (vehiculo.placa.toLowerCase().includes(query)) {
          return true;
        }
        if (vehiculo.marca.toLowerCase().includes(query)) {
          return true;
        }
        if (vehiculo.modelo.toLowerCase().includes(query)) {
          return true;
        }
      }
      
      return false;
    });
  }
  
  return resultado;
}

// ============================================================================
// DEBUG
// ============================================================================

/**
 * Log de debug (solo en desarrollo)
 */
export function logDebugDocumentos(message: string, data?: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Flota/Documentos] ${message}`, data || '');
  }
}

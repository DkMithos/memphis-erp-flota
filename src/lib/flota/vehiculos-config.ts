/**
 * Memphis ERP - Flota → Vehículos Config
 * Configuración centralizada, tipos, validaciones y helpers
 * Patrón enterprise: 0 hardcode en UI, toda lógica aquí
 * v3.0.0 - Con soporte para contratos, plan preventivo y documentos
 */

// ============================================================================
// DEBUG FLAG
// ============================================================================
export const DEBUG_VEHICULOS = import.meta.env.DEV;

// ============================================================================
// TYPES - ENUMS
// ============================================================================

export type EstadoVehiculo = 'activo' | 'en_taller' | 'inactivo';
export type TipoVehiculo = 'ambulancia' | 'camioneta' | 'motocicleta' | 'van' | 'auto' | 'otro';
export type EstadoDocumento = 'vigente' | 'proximo' | 'vencido';

/**
 * Labels para tipos de vehículo
 */
export const TIPO_VEHICULO_LABELS: Record<TipoVehiculo, string> = {
  ambulancia: 'Ambulancia',
  camioneta: 'Camioneta',
  motocicleta: 'Motocicleta',
  van: 'Van',
  auto: 'Auto',
  otro: 'Otro'
};

/**
 * Configuración para estados de vehículo
 */
export const ESTADO_VEHICULO_CONFIG: Record<EstadoVehiculo, { label: string; color: string }> = {
  activo: { label: 'Activo', color: '#10b981' },
  en_taller: { label: 'En Taller', color: '#f59e0b' },
  inactivo: { label: 'Inactivo', color: '#6b7280' }
};

/**
 * Tipos de contrato de flota
 */
export type TipoContratoFlota = 
  | 'solo_garantia' 
  | 'mantenimiento_y_garantia' 
  | 'solo_mantenimiento' 
  | 'full_service' 
  | 'otro';

/**
 * Tipos de plan preventivo
 */
export type TipoPlanPreventivo = 
  | 'por_km' 
  | 'por_meses' 
  | 'mixto';

/**
 * Tipos de documento de vehículo
 */
export type TipoDocumentoVehiculo = 
  | 'SOAT'
  | 'REVISION_TECNICA'
  | 'TARJETA_PROPIEDAD'
  | 'SEGURO_VEHICULAR'
  | 'PERMISO_OPERACION'
  | 'OTRO';

// ============================================================================
// TYPES - INTERFACES
// ============================================================================

/**
 * Vínculo de contrato del vehículo
 * (Por ahora strings; cuando haya backend se normalizará a IDs)
 */
export interface VehiculoVinculoContrato {
  clienteNombre: string;
  proyectoNombre: string;
  contratoNombre: string;
  tipoContrato: TipoContratoFlota;
  fechaInicio: string; // ISO date
  fechaFin: string; // ISO date
}

/**
 * Plan preventivo contratado
 */
export interface PlanPreventivoContratado {
  habilitado: boolean;
  tipoPlan: TipoPlanPreventivo;
  totalPreventivosContratados: number;
  intervaloKm?: number; // Solo si tipoPlan incluye 'km'
  intervaloMeses?: number; // Solo si tipoPlan incluye 'meses'
}

/**
 * Documento del vehículo (SOAT, revisión técnica, etc.)
 */
export interface VehiculoDocumento {
  id: string; // DOC-001, DOC-002, etc.
  tipo: TipoDocumentoVehiculo;
  nombre: string;
  numero?: string; // Número del documento
  fechaEmision?: string; // ISO date
  fechaVencimiento: string; // ISO date (OBLIGATORIO)
  archivoNombre?: string; // Placeholder para archivo adjunto
  observaciones?: string;
  
  // Auditoría
  creadoPor?: string;
  creadoEn?: string; // ISO timestamp
  modificadoPor?: string;
  modificadoEn?: string; // ISO timestamp
}

/**
 * Plan de preventivos por vehículo (LEGACY - mantener por compatibilidad)
 * @deprecated Usar PlanPreventivoContratado
 */
export interface PlanPreventivo {
  totalPreventivosContratados: number;
  frecuenciaKm?: number;
  frecuenciaDias?: number;
  inicioContrato?: string;
  finContrato?: string;
}

/**
 * Documento del vehículo (LEGACY - mantener por compatibilidad)
 * @deprecated Usar VehiculoDocumento
 */
export interface DocumentoVehiculo {
  id: string;
  tipo: string;
  numero?: string;
  fechaEmision?: string;
  fechaVencimiento?: string;
  estado?: EstadoDocumento;
  archivoUrl?: string;
  observaciones?: string;
}

export interface Vehiculo {
  id: string; // VH-001, VH-002, etc.
  placa: string; // ABC-123 (única)
  vin?: string; // VIN (opcional, único si se proporciona)
  tipo: TipoVehiculo;
  marca: string;
  modelo: string;
  año: number;
  color: string;
  motor?: string;
  combustible: 'gasolina' | 'diesel' | 'gnv' | 'electrico' | 'hibrido';
  capacidad?: string; // ej: "3.5 ton", "8 pasajeros"
  kilometraje: number;
  ubicacionActual: string; // Base Central, Taller, etc.
  estado: EstadoVehiculo;
  
  // Programa de mantenimiento
  ultimoMantenimiento?: string; // ISO date
  proximoMantenimiento?: string; // ISO date
  
  // Plan de preventivos (LEGACY - mantener por compatibilidad)
  planPreventivo?: PlanPreventivo;
  
  // Documentos del vehículo (LEGACY - mantener por compatibilidad)
  documentos?: DocumentoVehiculo[];
  
  // NUEVOS: Contrato, Plan Preventivo y Documentos
  vinculoContrato?: VehiculoVinculoContrato;
  planPreventivoContratado?: PlanPreventivoContratado;
  documentosVehiculo?: VehiculoDocumento[];
  
  // Vista pública (QR)
  publicViewEnabled?: boolean; // Si false, QR no funciona
  publicToken?: string; // UUID para /v/:token (generado automáticamente)
  
  // Auditoría obligatoria
  creadoPor: string;
  creadoEn: string; // ISO timestamp
  modificadoPor?: string;
  modificadoEn?: string; // ISO timestamp
  inactivadoPor?: string;
  inactivadoEn?: string; // ISO timestamp
  motivoInactivacion?: string; // Obligatorio al inactivar (>=30 chars)
}

// ============================================================================
// VALIDACIONES
// ============================================================================

export interface ValidacionResult {
  valido: boolean;
  errores: string[];
}

/**
 * Valida formato de placa (ABC-123 o AB-1234)
 */
export function validarPlaca(placa: string): ValidacionResult {
  const errores: string[] = [];
  
  if (!placa || placa.trim() === '') {
    errores.push('La placa es obligatoria');
    return { valido: false, errores };
  }
  
  const placaNormalizada = normalizePlaca(placa);
  const formatoValido = /^[A-Z]{2,3}-[0-9]{3,4}$/.test(placaNormalizada);
  
  if (!formatoValido) {
    errores.push('Formato de placa inválido. Use ABC-123 o AB-1234');
  }
  
  return {
    valido: errores.length === 0,
    errores
  };
}

/**
 * Valida VIN (opcional, pero si se proporciona debe ser válido)
 */
export function validarVIN(vin?: string): ValidacionResult {
  const errores: string[] = [];
  
  if (!vin || vin.trim() === '') {
    return { valido: true, errores }; // VIN es opcional
  }
  
  const vinLimpio = vin.trim().toUpperCase();
  
  // VIN debe tener 17 caracteres alfanuméricos (sin I, O, Q)
  if (vinLimpio.length !== 17) {
    errores.push('El VIN debe tener exactamente 17 caracteres');
  }
  
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vinLimpio)) {
    errores.push('El VIN contiene caracteres inválidos (no se permiten I, O, Q)');
  }
  
  return {
    valido: errores.length === 0,
    errores
  };
}

/**
 * Valida año del vehículo (razonable: 1990 - año actual + 1)
 */
export function validarAño(año: number): ValidacionResult {
  const errores: string[] = [];
  const añoActual = new Date().getFullYear();
  const añoMin = 1990;
  const añoMax = añoActual + 1;
  
  if (!año || isNaN(año)) {
    errores.push('El año es obligatorio');
    return { valido: false, errores };
  }
  
  if (año < añoMin || año > añoMax) {
    errores.push(`El año debe estar entre ${añoMin} y ${añoMax}`);
  }
  
  return {
    valido: errores.length === 0,
    errores
  };
}

/**
 * Valida kilometraje (debe ser >= 0)
 */
export function validarKilometraje(km: number): ValidacionResult {
  const errores: string[] = [];
  
  if (km === undefined || km === null || isNaN(km)) {
    errores.push('El kilometraje es obligatorio');
    return { valido: false, errores };
  }
  
  if (km < 0) {
    errores.push('El kilometraje no puede ser negativo');
  }
  
  return {
    valido: errores.length === 0,
    errores
  };
}

/**
 * Valida motivo de inactivación (>=30 chars)
 */
export function validarMotivoInactivacion(motivo: string): ValidacionResult {
  const errores: string[] = [];
  
  if (!motivo || motivo.trim() === '') {
    errores.push('El motivo de inactivación es obligatorio');
    return { valido: false, errores };
  }
  
  if (motivo.trim().length < 30) {
    errores.push('El motivo debe tener al menos 30 caracteres');
  }
  
  return {
    valido: errores.length === 0,
    errores
  };
}

/**
 * Validación completa de vehículo
 */
export function validarVehiculo(
  vehiculo: Partial<Vehiculo>,
  placasExistentes: string[],
  vinsExistentes: string[],
  vehiculoIdActual?: string // Para excluir en edición
): ValidacionResult {
  const errores: string[] = [];
  
  // Placa
  const resultadoPlaca = validarPlaca(vehiculo.placa || '');
  if (!resultadoPlaca.valido) {
    errores.push(...resultadoPlaca.errores);
  } else {
    // Verificar unicidad
    const placaNormalizada = normalizePlaca(vehiculo.placa || '');
    const placaExiste = placasExistentes.some(p => {
      // Si estamos editando, excluir el vehículo actual
      if (vehiculoIdActual) {
        return p === placaNormalizada;
      }
      return p === placaNormalizada;
    });
    
    if (placaExiste) {
      errores.push('Ya existe un vehículo con esta placa');
    }
  }
  
  // VIN (opcional)
  if (vehiculo.vin) {
    const resultadoVIN = validarVIN(vehiculo.vin);
    if (!resultadoVIN.valido) {
      errores.push(...resultadoVIN.errores);
    } else {
      const vinNormalizado = vehiculo.vin.trim().toUpperCase();
      const vinExiste = vinsExistentes.some(v => v === vinNormalizado);
      
      if (vinExiste) {
        errores.push('Ya existe un vehículo con este VIN');
      }
    }
  }
  
  // Tipo
  if (!vehiculo.tipo) {
    errores.push('El tipo de vehículo es obligatorio');
  }
  
  // Marca y modelo
  if (!vehiculo.marca || vehiculo.marca.trim() === '') {
    errores.push('La marca es obligatoria');
  }
  
  if (!vehiculo.modelo || vehiculo.modelo.trim() === '') {
    errores.push('El modelo es obligatorio');
  }
  
  // Año
  const resultadoAño = validarAño(vehiculo.año || 0);
  if (!resultadoAño.valido) {
    errores.push(...resultadoAño.errores);
  }
  
  // Color
  if (!vehiculo.color || vehiculo.color.trim() === '') {
    errores.push('El color es obligatorio');
  }
  
  // Combustible
  if (!vehiculo.combustible) {
    errores.push('El tipo de combustible es obligatorio');
  }
  
  // Kilometraje
  const resultadoKm = validarKilometraje(vehiculo.kilometraje ?? NaN);
  if (!resultadoKm.valido) {
    errores.push(...resultadoKm.errores);
  }
  
  // Ubicación
  if (!vehiculo.ubicacionActual || vehiculo.ubicacionActual.trim() === '') {
    errores.push('La ubicación actual es obligatoria');
  }
  
  return {
    valido: errores.length === 0,
    errores
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Genera ID autoincremental para vehículo: VH-001, VH-002, etc.
 */
export function generateVehiculoId(vehiculosExistentes: Vehiculo[]): string {
  if (vehiculosExistentes.length === 0) {
    return 'VH-001';
  }
  
  // Extraer números de IDs existentes
  const numeros = vehiculosExistentes
    .map(v => {
      const match = v.id.match(/^VH-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);
  
  const maxNumero = Math.max(...numeros, 0);
  const nuevoNumero = maxNumero + 1;
  
  return `VH-${nuevoNumero.toString().padStart(3, '0')}`;
}

/**
 * Normaliza placa a formato estándar: ABC-123 (mayúsculas, sin espacios)
 */
export function normalizePlaca(placa: string): string {
  return placa.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Calcula días hasta próximo mantenimiento
 */
export function calcularDiasProximoMantenimiento(fechaProxima?: string): number | null {
  if (!fechaProxima) return null;
  
  const hoy = new Date();
  const proxima = new Date(fechaProxima);
  const diff = proxima.getTime() - hoy.getTime();
  const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
  
  return dias;
}

/**
 * Formatea fecha ISO a formato legible
 */
export function formatearFecha(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Retorna configuración de badge para estado de vehículo
 */
export function getEstadoBadge(estado: EstadoVehiculo): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  label: string;
  color: string;
} {
  const config = ESTADO_VEHICULO_CONFIG[estado];
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
  
  switch (estado) {
    case 'activo':
      variant = 'default';
      break;
    case 'en_taller':
      variant = 'outline';
      break;
    case 'inactivo':
      variant = 'secondary';
      break;
  }
  
  return {
    variant,
    label: config.label,
    color: config.color
  };
}

/**
 * Retorna configuración de badge para tipo de vehículo
 */
export function getTipoBadge(tipo: TipoVehiculo): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  label: string;
  color: string;
} {
  const label = TIPO_VEHICULO_LABELS[tipo];
  
  return {
    variant: 'secondary',
    label,
    color: '#6b7280'
  };
}

/**
 * Log de debug
 */
export function logDebug(mensaje: string, ...args: any[]) {
  if (DEBUG_VEHICULOS) {
    console.log(`[VEHICULOS] ${mensaje}`, ...args);
  }
}

// ============================================================================
// HELPERS - DOCUMENTOS
// ============================================================================

/**
 * Umbral de días para considerar documento "próximo a vencer"
 */
export const UMBRAL_DIAS_DOCUMENTO = 30;

/**
 * Calcula estado de documento según fecha de vencimiento
 * Reglas:
 * - Si hoy > vencimiento → vencido
 * - Si faltan <= 30 días → proximo
 * - Else → vigente
 */
export function calcEstadoDocumento(fechaVencimiento: string): EstadoDocumento {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche
  
  const vencimiento = new Date(fechaVencimiento);
  vencimiento.setHours(0, 0, 0, 0);
  
  const diffMs = vencimiento.getTime() - hoy.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diasRestantes < 0) {
    return 'vencido';
  } else if (diasRestantes <= UMBRAL_DIAS_DOCUMENTO) {
    return 'proximo';
  } else {
    return 'vigente';
  }
}

/**
 * Calcula días restantes hasta vencimiento
 */
export function calcDiasRestantesDocumento(fechaVencimiento: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const vencimiento = new Date(fechaVencimiento);
  vencimiento.setHours(0, 0, 0, 0);
  
  const diffMs = vencimiento.getTime() - hoy.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Retorna configuración de badge para estado de documento
 */
export function getEstadoDocumentoBadge(estado: EstadoDocumento): {
  variant: 'default' | 'secondary' | 'destructive';
  label: string;
  color: string;
} {
  switch (estado) {
    case 'vigente':
      return {
        variant: 'default',
        label: 'Vigente',
        color: '#10b981' // green
      };
    case 'proximo':
      return {
        variant: 'secondary',
        label: 'Próximo a Vencer',
        color: '#f59e0b' // amber
      };
    case 'vencido':
      return {
        variant: 'destructive',
        label: 'Vencido',
        color: '#ef4444' // red
      };
    default:
      return {
        variant: 'secondary',
        label: estado,
        color: '#6b7280' // gray
      };
  }
}

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
 * Genera ID único para documento
 * Formato: DOC-{timestamp}-{random}
 */
export function generarDocumentoId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `DOC-${timestamp}-${random}`.toUpperCase();
}

/**
 * Valida documento antes de crear/actualizar
 */
export function validarDocumento(
  documento: Partial<VehiculoDocumento>
): ValidacionResult {
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
  
  return {
    valido: errores.length === 0,
    errores
  };
}

// ============================================================================
// HELPERS - PLAN PREVENTIVO
// ============================================================================

/**
 * Labels para tipos de contrato
 */
export const TIPO_CONTRATO_LABELS: Record<TipoContratoFlota, string> = {
  solo_garantia: 'Solo Garantía',
  mantenimiento_y_garantia: 'Mantenimiento + Garantía',
  solo_mantenimiento: 'Solo Mantenimiento',
  full_service: 'Full Service',
  otro: 'Otro'
};

/**
 * Labels para tipos de plan preventivo
 */
export const TIPO_PLAN_PREVENTIVO_LABELS: Record<TipoPlanPreventivo, string> = {
  por_km: 'Por Kilometraje',
  por_meses: 'Por Meses',
  mixto: 'Mixto (Km + Meses)'
};

/**
 * Calcula preventivos usados y restantes para un vehículo
 * 
 * @param vehiculoId - ID del vehículo
 * @param ots - Lista completa de OTs del sistema
 * @param planPreventivo - Plan preventivo del vehículo
 * @returns Objeto con usados, restantes y porcentaje
 */
export function calcPreventivosUsadosRestantes(
  vehiculoId: string,
  ots: Array<{ vehiculoId: string; tipo: string; estado: string }>,
  planPreventivo?: PlanPreventivoContratado
): {
  usados: number;
  restantes: number;
  total: number;
  porcentajeUsado: number;
} {
  // Filtrar OTs preventivas cerradas del vehículo
  const otsPreventivas = ots.filter(
    ot => 
      ot.vehiculoId === vehiculoId && 
      ot.tipo === 'preventivo' && 
      ot.estado === 'cerrada'
  );
  
  const usados = otsPreventivas.length;
  const total = planPreventivo?.totalPreventivosContratados || 0;
  const restantes = Math.max(0, total - usados);
  const porcentajeUsado = total > 0 ? Math.round((usados / total) * 100) : 0;
  
  return {
    usados,
    restantes,
    total,
    porcentajeUsado
  };
}

/**
 * Valida vínculo de contrato
 */
export function validarVinculoContrato(
  vinculo: Partial<VehiculoVinculoContrato>
): ValidacionResult {
  const errores: string[] = [];
  
  // Cliente obligatorio (mín 3 chars)
  if (!vinculo.clienteNombre || vinculo.clienteNombre.trim().length < 3) {
    errores.push('El nombre del cliente debe tener al menos 3 caracteres');
  }
  
  // Proyecto obligatorio (mín 3 chars)
  if (!vinculo.proyectoNombre || vinculo.proyectoNombre.trim().length < 3) {
    errores.push('El nombre del proyecto debe tener al menos 3 caracteres');
  }
  
  // Contrato obligatorio (mín 3 chars)
  if (!vinculo.contratoNombre || vinculo.contratoNombre.trim().length < 3) {
    errores.push('El nombre del contrato debe tener al menos 3 caracteres');
  }
  
  // Tipo de contrato obligatorio
  if (!vinculo.tipoContrato) {
    errores.push('El tipo de contrato es obligatorio');
  }
  
  // Fechas obligatorias
  if (!vinculo.fechaInicio) {
    errores.push('La fecha de inicio es obligatoria');
  }
  
  if (!vinculo.fechaFin) {
    errores.push('La fecha de fin es obligatoria');
  }
  
  // Validar que fecha inicio sea anterior a fecha fin
  if (vinculo.fechaInicio && vinculo.fechaFin) {
    const inicio = new Date(vinculo.fechaInicio);
    const fin = new Date(vinculo.fechaFin);
    
    if (inicio >= fin) {
      errores.push('La fecha de inicio debe ser anterior a la fecha de fin');
    }
  }
  
  return {
    valido: errores.length === 0,
    errores
  };
}

/**
 * Valida plan preventivo
 */
export function validarPlanPreventivo(
  plan: Partial<PlanPreventivoContratado>
): ValidacionResult {
  const errores: string[] = [];
  
  // Habilitado obligatorio
  if (plan.habilitado === undefined) {
    errores.push('El estado de habilitación es obligatorio');
  }
  
  // Tipo de plan obligatorio
  if (!plan.tipoPlan) {
    errores.push('El tipo de plan preventivo es obligatorio');
  }
  
  // Total de preventivos contratados obligatorio
  if (plan.totalPreventivosContratados === undefined || plan.totalPreventivosContratados < 0) {
    errores.push('El total de preventivos contratados debe ser un número no negativo');
  }
  
  // Validaciones según tipo de plan
  if (plan.tipoPlan === 'por_km' || plan.tipoPlan === 'mixto') {
    if (plan.intervaloKm === undefined || plan.intervaloKm <= 0) {
      errores.push('El intervalo de km es obligatorio y debe ser mayor a 0');
    }
  }
  
  if (plan.tipoPlan === 'por_meses' || plan.tipoPlan === 'mixto') {
    if (plan.intervaloMeses === undefined || plan.intervaloMeses <= 0) {
      errores.push('El intervalo de meses es obligatorio y debe ser mayor a 0');
    }
  }
  
  return {
    valido: errores.length === 0,
    errores
  };
}
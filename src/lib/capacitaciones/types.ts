/**
 * Capacitaciones y certificados — tipos compartidos entre el módulo interno,
 * el portal público y la generación de PDF.
 *
 * Las tablas son nuevas (migración 20261005120000) y no están en los tipos
 * generados de `Database`, así que el acceso va con `(supabase as any)`.
 */

export interface TemaTemario {
  tema: string;
  horas: number;
}

export interface Curso {
  id: string;
  tenant_id: string;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  temario: TemaTemario[];
  horas_total: number;
  activo: boolean;
  creado_en: string;
}

export type ModoPlantilla = 'estandar' | 'fondo_completo';

/** Ajustes finos del diseño. Todos opcionales; el renderizador tiene defaults. */
export interface LayoutPlantilla {
  /** Dónde va el logo en el modo estándar. */
  logo_pos?: 'arriba' | 'arriba-izq' | 'abajo-izq' | 'ninguno';
  /**
   * Esquinas con las franjas decorativas. 'tl-br' = arriba-izquierda y
   * abajo-derecha (diseño original). 'tr-bl' las intercala para dejar libre la
   * esquina superior izquierda (logo) sin pelearse con el azul.
   */
  marco_pos?: 'tl-br' | 'tr-bl';
  /** Posición del QR: abajo derecha / abajo izquierda / arriba derecha / arriba izquierda. */
  qr_pos?: 'br' | 'bl' | 'tr' | 'tl' | 'none';
  /** Código y dirección del portal debajo del QR (por defecto sí). */
  qr_texto?: boolean;
  /** Ancho del logo en px del pliego (modo estándar, abajo a la izquierda). Por defecto 236. */
  logo_ancho?: number;
  /** Línea con las fechas y el lugar del curso (además de la fecha de emisión). Por defecto sí. */
  mostrar_fecha_curso?: boolean;
  /** Color del papel (modo estándar). */
  color_fondo?: string;
  /** Marco y franjas decorativas (modo estándar). */
  mostrar_marco?: boolean;
  /** Modo fondo completo: dónde empieza el bloque de texto, en % del alto. */
  texto_top?: number;
  /** Modo fondo completo: alto del bloque de texto, en % del alto. */
  texto_alto?: number;
  /** Modo fondo completo: margen lateral del bloque, en % del ancho. */
  texto_margen?: number;
  /** Opacidad de la foto de fondo (modo estándar), 0–1. */
  fondo_opacidad?: number;
  /** Rúbrica: alto en px (por defecto 110) y desplazamiento respecto a la línea (dx a la derecha, dy hacia abajo). */
  firma_alto?: number;
  firma_dx?: number;
  firma_dy?: number;
  /** Sello: tamaño en px (por defecto 100) y desplazamiento (dx a la derecha, dy hacia abajo). */
  sello_tamano?: number;
  sello_dx?: number;
  sello_dy?: number;
}

export interface Plantilla {
  id: string;
  tenant_id: string;
  nombre: string;
  descripcion: string | null;
  modo: ModoPlantilla;
  es_default: boolean;
  proyecto_id: string | null;
  curso_id: string | null;
  consorcio_nombre: string | null;
  logo_url: string | null;
  sello_url: string | null;
  fondo_url: string | null;
  firma_url: string | null;
  color_acento: string;
  color_primario: string;
  color_secundario: string;
  color_texto: string;
  titulo: string;
  texto_otorga: string;
  texto_reconocimiento: string;
  ciudad: string;
  firmante_nombre: string | null;
  firmante_cargo: string | null;
  mostrar_temario: boolean;
  mostrar_dni: boolean;
  mostrar_qr: boolean;
  mostrar_proyecto: boolean;
  layout: LayoutPlantilla;
  activa: boolean;
  creado_en?: string;
}

/** Lo que se congela en cada certificado: la plantilla sin sus ids. */
export type PlantillaSnapshot = Omit<Plantilla, 'id' | 'tenant_id' | 'es_default' | 'proyecto_id' | 'curso_id' | 'activa' | 'creado_en'> & {
  plantilla_id?: string;
  plantilla_nombre?: string;
};

export type EstadoCapacitacion = 'programada' | 'en_curso' | 'cerrada' | 'anulada';

export interface Capacitacion {
  id: string;
  tenant_id: string;
  codigo: string;
  proyecto_id: string | null;
  curso_id: string | null;
  plantilla_id: string | null;
  titulo: string;
  descripcion: string | null;
  temario: TemaTemario[];
  horas_total: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  lugar: string | null;
  ciudad: string | null;
  instructor_nombre: string | null;
  instructor_cargo: string | null;
  entidad_beneficiaria: string | null;
  estado: EstadoCapacitacion;
  asistencia_token: string;
  asistencia_abierta: boolean;
  observaciones: string | null;
  creado_por: string | null;
  creado_en: string;
  // Embebidos
  proyecto?: { id?: string; codigo: string; nombre: string; entidad_cliente?: string | null; region?: string | null } | null;
  // Contadores calculados en el cliente
  total_participantes?: number;
  total_firmados?: number;
  total_certificados?: number;
}

export interface Participante {
  id: string;
  tenant_id: string;
  capacitacion_id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  cargo: string | null;
  institucion: string | null;
  email: string | null;
  telefono: string | null;
  firma_data_url: string | null;
  firmado_en: string | null;
  firma_origen: 'erp' | 'enlace' | null;
  asistio: boolean;
  nota: string | null;
  orden: number | null;
  creado_en: string;
  certificado?: Pick<Certificado, 'id' | 'codigo' | 'token' | 'estado' | 'emitido_en'> | null;
}

export type EstadoCertificado = 'emitido' | 'revocado';

export interface DatosCertificado {
  participante: {
    nombres: string;
    apellidos: string;
    dni: string;
    cargo?: string | null;
    institucion?: string | null;
  };
  capacitacion: {
    codigo: string;
    titulo: string;
    descripcion?: string | null;
    temario: TemaTemario[];
    horas_total: number;
    fecha_inicio: string;
    fecha_fin?: string | null;
    lugar?: string | null;
    ciudad?: string | null;
    instructor_nombre?: string | null;
    instructor_cargo?: string | null;
    entidad_beneficiaria?: string | null;
  };
  proyecto?: { codigo: string; nombre: string; entidad_cliente?: string | null; region?: string | null } | null;
  emision: { ciudad: string; fecha: string };
  firmante: { nombre: string; cargo: string; firma_url?: string | null };
  consorcio?: string | null;
}

export interface Certificado {
  id: string;
  tenant_id: string;
  capacitacion_id: string;
  participante_id: string;
  codigo: string;
  token: string;
  estado: EstadoCertificado;
  emitido_en: string;
  emitido_por: string | null;
  emitido_por_email: string | null;
  revocado_en: string | null;
  revocado_por: string | null;
  motivo_revocacion: string | null;
  datos: DatosCertificado;
  plantilla: PlantillaSnapshot;
  participante?: Pick<Participante, 'id' | 'dni' | 'nombres' | 'apellidos' | 'email'> | null;
}

export interface AccesoPortal {
  id: number;
  tipo: 'consulta_dni' | 'verificacion' | 'firma' | 'formulario';
  certificado_id: string | null;
  capacitacion_id: string | null;
  ip: string | null;
  resultado: string | null;
  creado_en: string;
}

/** Respuestas de la Edge Function `capacitaciones-publico`. */
export interface CertificadoPublico {
  id: string;
  codigo: string;
  token: string;
  estado: EstadoCertificado;
  emitido_en: string;
  revocado_en?: string | null;
  motivo_revocacion?: string | null;
  datos: DatosCertificado;
  plantilla: PlantillaSnapshot;
}

export interface CapacitacionPublica {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  temario: TemaTemario[];
  horas_total: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  lugar: string | null;
  ciudad: string | null;
  instructor_nombre: string | null;
  instructor_cargo?: string | null;
  entidad_beneficiaria: string | null;
  proyecto: { codigo: string; nombre: string } | null;
  cargo?: string | null;
  institucion?: string | null;
  certificado: CertificadoPublico | null;
}

export const ESTADO_CAPACITACION: Record<EstadoCapacitacion, { label: string; color: string }> = {
  programada: { label: 'Programada', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  en_curso:   { label: 'En curso',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  cerrada:    { label: 'Cerrada',    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  anulada:    { label: 'Anulada',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

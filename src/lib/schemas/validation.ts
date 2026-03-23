/**
 * Memphis ERP — Schemas de validación con Zod v4
 * Usados con react-hook-form + @hookform/resolvers/zod
 */
import { z } from 'zod';

// ─── Helpers reutilizables ──────────────────────────────────────────────────

const requiredText = (label: string) =>
  z.string().min(1, `${label} es obligatorio`).trim();

const optionalText = z.string().trim().optional().or(z.literal(''));

const positiveNumber = (label: string) =>
  z.coerce.number().min(0, `${label} debe ser un número positivo`);

const positiveInt = (label: string) =>
  z.coerce.number().int().min(0, `${label} debe ser un número entero positivo`);

const dateString = (label: string) =>
  z
    .string()
    .min(1, `${label} es obligatoria`)
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} debe tener formato YYYY-MM-DD`);

// ─── Auth ───────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});
export type LoginFormData = z.infer<typeof loginSchema>;

// ─── Vehículos ──────────────────────────────────────────────────────────────

export const vehiculoSchema = z.object({
  codigo: requiredText('Código'),
  placa: requiredText('Placa'),
  vin: optionalText,
  tipo: z.enum(
    ['ambulancia', 'camioneta', 'van', 'auto', 'otro'] as const,
    { message: 'Tipo de vehículo inválido' },
  ),
  marca: requiredText('Marca'),
  modelo: requiredText('Modelo'),
  anio: z.coerce.number().int().min(1990, 'Año mínimo: 1990').max(2100, 'Año máximo: 2100'),
  color: requiredText('Color'),
  motor: optionalText,
  combustible: z.enum(
    ['gasolina', 'diesel', 'gnv', 'electrico', 'hibrido'] as const,
    { message: 'Combustible inválido' },
  ),
  capacidad: optionalText,
  kilometraje: positiveInt('Kilometraje'),
  ubicacion_actual: requiredText('Ubicación actual'),
  estado: z.enum(['activo', 'en_taller', 'inactivo'] as const).default('activo'),
});
export type VehiculoFormData = z.infer<typeof vehiculoSchema>;

// ─── Orden de Trabajo ───────────────────────────────────────────────────────

export const ordenTrabajoSchema = z.object({
  vehiculo_id: requiredText('Vehículo'),
  tipo: z.enum(
    ['preventivo', 'correctivo', 'predictivo'] as const,
    { message: 'Tipo de OT inválido' },
  ),
  criticidad: z.enum(['baja', 'media', 'alta', 'critica'] as const).default('media'),
  titulo: requiredText('Título').max(200, 'Máximo 200 caracteres'),
  descripcion: requiredText('Descripción'),
  taller_nombre: requiredText('Nombre del taller'),
  taller_tipo: z.enum(['interno', 'externo'] as const).default('externo'),
  fecha_programada: dateString('Fecha programada'),
  kilometraje_registro: positiveInt('Kilometraje'),
  sla_estimado_horas: z.coerce.number().int().min(0).optional(),
  costo_mano_obra: positiveNumber('Costo mano de obra').default(0),
  costo_repuestos: positiveNumber('Costo repuestos').default(0),
  costo_terceros: positiveNumber('Costo terceros').default(0),
  costo_otros: positiveNumber('Otros costos').default(0),
});
export type OrdenTrabajoFormData = z.infer<typeof ordenTrabajoSchema>;

// ─── Proveedor ──────────────────────────────────────────────────────────────

export const proveedorSchema = z.object({
  codigo: requiredText('Código'),
  razon_social: requiredText('Razón social'),
  nombre_comercial: optionalText,
  ruc: z.string()
    .min(11, 'El RUC debe tener 11 dígitos')
    .max(11, 'El RUC debe tener 11 dígitos')
    .regex(/^\d+$/, 'El RUC debe contener solo números'),
  tipo: z.enum(['bienes', 'servicios', 'mixto'] as const, { message: 'Tipo inválido' }),
  categoria: z.enum(
    [
      'repuestos', 'taller', 'combustible', 'seguros',
      'equipos_medicos', 'insumos', 'servicios_profesionales',
      'construccion', 'tecnologia', 'otros',
    ] as const,
    { message: 'Categoría inválida' },
  ),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefono: optionalText,
  celular: optionalText,
  web: z.string().url('URL inválida').optional().or(z.literal('')),
  departamento: optionalText,
  provincia: optionalText,
  distrito: optionalText,
  direccion: optionalText,
});
export type ProveedorFormData = z.infer<typeof proveedorSchema>;

// ─── Requerimiento de Compra ─────────────────────────────────────────────────

export const requerimientoSchema = z.object({
  titulo: requiredText('Título').max(200, 'Máximo 200 caracteres'),
  descripcion: optionalText,
  prioridad: z.enum(['alta', 'media', 'baja'] as const).default('media'),
  centro_costo: z.enum(
    ['flota', 'biomedico', 'administracion', 'operaciones', 'ti', 'mantenimiento'] as const,
    { message: 'Centro de costo inválido' },
  ),
  fecha_requerida: z.string().optional().or(z.literal('')),
});
export type RequerimientoFormData = z.infer<typeof requerimientoSchema>;

// ─── Equipo Biomédico ────────────────────────────────────────────────────────

export const equipoBiomedicoSchema = z.object({
  codigo: requiredText('Código'),
  nombre: requiredText('Nombre del equipo'),
  marca: requiredText('Marca'),
  modelo: requiredText('Modelo'),
  serie: optionalText,
  anio_fabricacion: z.coerce.number().int().min(1900).max(2100).optional(),
  categoria: z.enum(
    ['diagnostico', 'terapeutico', 'soporte_vital', 'laboratorio', 'rehabilitacion'] as const,
    { message: 'Categoría inválida' },
  ),
  riesgo: z.enum(['bajo', 'medio', 'alto', 'critico'] as const).default('medio'),
  estado: z.enum(
    ['operativo', 'mantenimiento', 'fuera_servicio', 'baja', 'calibracion'] as const,
  ).default('operativo'),
  ubicacion: requiredText('Ubicación'),
  servicio_clinico: optionalText,
  fecha_adquisicion: z.string().optional().or(z.literal('')),
  costo_adquisicion: z.coerce.number().min(0).optional(),
  garantia_vence: z.string().optional().or(z.literal('')),
  frecuencia_mp_dias: positiveInt('Frecuencia de mantenimiento').default(180),
});
export type EquipoBiomedicoFormData = z.infer<typeof equipoBiomedicoSchema>;

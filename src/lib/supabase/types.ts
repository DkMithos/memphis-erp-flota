/**
 * Memphis ERP – Tipos TypeScript generados del schema de Supabase
 * Refleja exactamente las tablas definidas en la migración inicial
 */

// =============================================================================
// HELPERS
// =============================================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// =============================================================================
// DATABASE TYPE (patrón oficial de Supabase)
// =============================================================================

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: Tenant;
        Insert: TenantInsert;
        Update: TenantUpdate;
      };
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      proveedores: {
        Row: Proveedor;
        Insert: ProveedorInsert;
        Update: ProveedorUpdate;
      };
      vehiculos: {
        Row: VehiculoDB;
        Insert: VehiculoInsert;
        Update: VehiculoUpdate;
      };
      vehiculo_documentos: {
        Row: VehiculoDocumentoDB;
        Insert: VehiculoDocumentoInsert;
        Update: VehiculoDocumentoUpdate;
      };
      ordenes_trabajo: {
        Row: OrdenTrabajoDB;
        Insert: OrdenTrabajoInsert;
        Update: OrdenTrabajoUpdate;
      };
      ot_repuestos: {
        Row: OTRepuesto;
        Insert: OTRepuestoInsert;
        Update: OTRepuestoUpdate;
      };
      ot_extras: {
        Row: OTExtra;
        Insert: OTExtraInsert;
        Update: OTExtraUpdate;
      };
      gps_dispositivos: {
        Row: GpsDispositivo;
        Insert: GpsDispositivoInsert;
        Update: GpsDispositivoUpdate;
      };
      gps_sync_logs: {
        Row: GpsSyncLog;
        Insert: GpsSyncLogInsert;
        Update: never;
      };
      clientes_bio: {
        Row: ClienteBio;
        Insert: ClienteBioInsert;
        Update: ClienteBioUpdate;
      };
      sedes: {
        Row: Sede;
        Insert: SedeInsert;
        Update: SedeUpdate;
      };
      areas_clinicas: {
        Row: AreaClinica;
        Insert: AreaClinicaInsert;
        Update: AreaClinicaUpdate;
      };
      historial_ubicacion_equipo: {
        Row: HistorialUbicacionEquipo;
        Insert: Omit<HistorialUbicacionEquipo, 'id'>;
        Update: never;
      };
      equipos_biomedicos: {
        Row: EquipoBiomedico;
        Insert: EquipoBiomedicoInsert;
        Update: EquipoBiomedicoUpdate;
      };
      mantenimientos_biomedicos: {
        Row: MantenimientoBiomedico;
        Insert: MantenimientoBiomedicoInsert;
        Update: MantenimientoBiomedicoUpdate;
      };
      requerimientos_compra: {
        Row: RequerimientoCompra;
        Insert: RequerimientoCompraInsert;
        Update: RequerimientoCompraUpdate;
      };
      requerimiento_items: {
        Row: RequerimientoItem;
        Insert: RequerimientoItemInsert;
        Update: RequerimientoItemUpdate;
      };
      cotizaciones: {
        Row: Cotizacion;
        Insert: CotizacionInsert;
        Update: CotizacionUpdate;
      };
      cotizacion_items: {
        Row: CotizacionItem;
        Insert: CotizacionItemInsert;
        Update: CotizacionItemUpdate;
      };
      ordenes_compra: {
        Row: OrdenCompra;
        Insert: OrdenCompraInsert;
        Update: OrdenCompraUpdate;
      };
      orden_items: {
        Row: OrdenItem;
        Insert: OrdenItemInsert;
        Update: OrdenItemUpdate;
      };
      recepciones: {
        Row: Recepcion;
        Insert: RecepcionInsert;
        Update: RecepcionUpdate;
      };
      recepcion_items: {
        Row: RecepcionItem;
        Insert: RecepcionItemInsert;
        Update: RecepcionItemUpdate;
      };
      calibraciones_biomedicas: {
        Row: CalibracionBiomedica;
        Insert: Omit<CalibracionBiomedica, 'id' | 'creado_en' | 'equipo'>;
        Update: Partial<Omit<CalibracionBiomedica, 'id' | 'tenant_id' | 'creado_en' | 'equipo'>>;
      };
      incidencias_biomedicas: {
        Row: IncidenciaBiomedica;
        Insert: Omit<IncidenciaBiomedica, 'id' | 'creado_en' | 'equipo'>;
        Update: Partial<Omit<IncidenciaBiomedica, 'id' | 'tenant_id' | 'creado_en' | 'equipo'>>;
      };
      documentos_biomedicos: {
        Row: DocumentoBiomedico;
        Insert: Omit<DocumentoBiomedico, 'id' | 'creado_en' | 'equipo'>;
        Update: never;
      };
      contratos_bio: {
        Row: ContratoBioDB;
        Insert: Omit<ContratoBioDB, 'id' | 'equipo'>;
        Update: Partial<Omit<ContratoBioDB, 'id' | 'tenant_id' | 'equipo'>>;
      };
      evaluaciones_proveedores: {
        Row: EvaluacionProveedor;
        Insert: Omit<EvaluacionProveedor, 'id' | 'creado_en' | 'proveedor'>;
        Update: Partial<Omit<EvaluacionProveedor, 'id' | 'tenant_id' | 'creado_en' | 'proveedor'>>;
      };
      contratos_proveedores: {
        Row: ContratoProveedor;
        Insert: Omit<ContratoProveedor, 'id' | 'creado_en' | 'proveedor'>;
        Update: Partial<Omit<ContratoProveedor, 'id' | 'tenant_id' | 'creado_en' | 'proveedor'>>;
      };
      talleres: {
        Row: TallerDB;
        Insert: Omit<TallerDB, 'id' | 'creado_en' | 'proveedor'>;
        Update: Partial<Omit<TallerDB, 'id' | 'tenant_id' | 'creado_en' | 'proveedor'>>;
      };
      roles: {
        Row: RolDB;
        Insert: Omit<RolDB, 'id' | 'creado_en' | 'permisos'>;
        Update: Partial<Omit<RolDB, 'id' | 'tenant_id' | 'creado_en' | 'permisos'>>;
      };
      permisos: {
        Row: PermisoDBRow;
        Insert: Omit<PermisoDBRow, 'id'>;
        Update: Partial<Omit<PermisoDBRow, 'id'>>;
      };
      roles_permisos: {
        Row: { id: string; rol_id: string; permiso_id: string };
        Insert: { rol_id: string; permiso_id: string };
        Update: never;
      };
      usuarios_tenant: {
        Row: UsuarioTenantDB;
        Insert: Omit<UsuarioTenantDB, 'id' | 'creado_en' | 'roles'>;
        Update: Partial<Omit<UsuarioTenantDB, 'id' | 'tenant_id' | 'creado_en' | 'roles'>>;
      };
      usuarios_roles: {
        Row: UsuarioRolDB;
        Insert: Omit<UsuarioRolDB, 'id' | 'asignado_en' | 'rol'>;
        Update: never;
      };
      gps_posiciones: {
        Row: GpsPosicionDB;
        Insert: Omit<GpsPosicionDB, 'id' | 'recibido_en' | 'vehiculo'>;
        Update: never;
      };
      categorias_inventario: {
        Row: CategoriaInventarioDB;
        Insert: Omit<CategoriaInventarioDB, 'id' | 'creado_en'>;
        Update: Partial<Omit<CategoriaInventarioDB, 'id' | 'tenant_id' | 'creado_en'>>;
      };
      almacenes: {
        Row: AlmacenDB;
        Insert: Omit<AlmacenDB, 'id' | 'creado_en'>;
        Update: Partial<Omit<AlmacenDB, 'id' | 'tenant_id' | 'creado_en'>>;
      };
      articulos: {
        Row: ArticuloDB;
        Insert: Omit<ArticuloDB, 'id' | 'creado_en' | 'categoria'>;
        Update: Partial<Omit<ArticuloDB, 'id' | 'tenant_id' | 'creado_en' | 'categoria'>>;
      };
      movimientos_inventario: {
        Row: MovimientoInventarioDB;
        Insert: Omit<MovimientoInventarioDB, 'id' | 'creado_en' | 'articulo' | 'almacen'>;
        Update: never;
      };
      clientes: {
        Row: ClienteDB;
        Insert: Omit<ClienteDB, 'id' | 'creado_en'>;
        Update: Partial<Omit<ClienteDB, 'id' | 'tenant_id' | 'creado_en'>>;
      };
      oportunidades: {
        Row: OportunidadDB;
        Insert: Omit<OportunidadDB, 'id' | 'creado_en' | 'cliente'>;
        Update: Partial<Omit<OportunidadDB, 'id' | 'tenant_id' | 'creado_en' | 'cliente'>>;
      };
      actividades_crm: {
        Row: ActividadCRMDB;
        Insert: Omit<ActividadCRMDB, 'id' | 'creado_en' | 'cliente' | 'oportunidad'>;
        Update: Partial<Omit<ActividadCRMDB, 'id' | 'tenant_id' | 'creado_en' | 'cliente' | 'oportunidad'>>;
      };
      transacciones: {
        Row: TransaccionDB;
        Insert: Omit<TransaccionDB, 'id' | 'creado_en'>;
        Update: Partial<Omit<TransaccionDB, 'id' | 'tenant_id' | 'creado_en'>>;
      };
      presupuestos: {
        Row: PresupuestoDB;
        Insert: Omit<PresupuestoDB, 'id' | 'creado_en' | 'lineas'>;
        Update: Partial<Omit<PresupuestoDB, 'id' | 'tenant_id' | 'creado_en' | 'lineas'>>;
      };
      presupuesto_lineas: {
        Row: PresupuestoLineaDB;
        Insert: Omit<PresupuestoLineaDB, 'id'>;
        Update: Partial<Omit<PresupuestoLineaDB, 'id' | 'tenant_id'>>;
      };
      cajas_chicas: {
        Row: CajaChicaDB;
        Insert: Omit<CajaChicaDB, 'id' | 'creado_en'>;
        Update: Partial<Omit<CajaChicaDB, 'id' | 'tenant_id' | 'creado_en'>>;
      };
      gastos_caja_chica: {
        Row: GastoCajaChicaDB;
        Insert: Omit<GastoCajaChicaDB, 'id' | 'creado_en' | 'caja'>;
        Update: Partial<Omit<GastoCajaChicaDB, 'id' | 'tenant_id' | 'creado_en' | 'caja'>>;
      };
      proyectos: {
        Row: ProyectoDB;
        Insert: Omit<ProyectoDB, 'id' | 'creado_en' | 'fases' | 'tareas' | 'miembros'>;
        Update: Partial<Omit<ProyectoDB, 'id' | 'tenant_id' | 'creado_en' | 'fases' | 'tareas' | 'miembros'>>;
      };
      fases_proyecto: {
        Row: FaseProyectoDB;
        Insert: Omit<FaseProyectoDB, 'id'>;
        Update: Partial<Omit<FaseProyectoDB, 'id' | 'tenant_id'>>;
      };
      tareas_proyecto: {
        Row: TareaProyectoDB;
        Insert: Omit<TareaProyectoDB, 'id' | 'creado_en'>;
        Update: Partial<Omit<TareaProyectoDB, 'id' | 'tenant_id' | 'creado_en'>>;
      };
      miembros_proyecto: {
        Row: MiembroProyectoDB;
        Insert: Omit<MiembroProyectoDB, 'id'>;
        Update: Partial<Omit<MiembroProyectoDB, 'id' | 'tenant_id'>>;
      };
      centros_costo: {
        Row: CentroCostoDB;
        Insert: Omit<CentroCostoDB, 'id' | 'creado_en'>;
        Update: Partial<Omit<CentroCostoDB, 'id' | 'tenant_id' | 'creado_en'>>;
      };
      valorizaciones: {
        Row: ValorizacionDB;
        Insert: Omit<ValorizacionDB, 'id' | 'creado_en'>;
        Update: Partial<Omit<ValorizacionDB, 'id' | 'tenant_id' | 'creado_en'>>;
      };
    };
    Functions: {
      auth_tenant_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
  };
}

// =============================================================================
// CORE SAAS
// =============================================================================

export type TenantPlan = 'standard' | 'professional' | 'enterprise';
export type TenantEstado = 'activo' | 'suspendido' | 'cancelado';

export interface Tenant {
  id: string;
  nombre: string;
  ruc: string | null;
  plan: TenantPlan;
  estado: TenantEstado;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}
export type TenantInsert = Omit<Tenant, 'id' | 'created_at' | 'updated_at'>;
export type TenantUpdate = Partial<TenantInsert>;

export type ProfileRol =
  | 'superadmin'
  | 'admin_empresa'
  | 'gerencia'
  | 'compras'
  | 'operaciones'
  | 'tecnico'
  | 'operador';

export type ProfileEstado = 'activo' | 'inactivo' | 'suspendido';

export interface Profile {
  id: string;
  tenant_id: string;
  nombre: string;
  apellido: string | null;
  email: string;
  rol: ProfileRol;
  estado: ProfileEstado;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>;
export type ProfileUpdate = Partial<Omit<ProfileInsert, 'id' | 'tenant_id'>>;

// =============================================================================
// PROVEEDORES
// =============================================================================

export type EstadoProveedor = 'activo' | 'inactivo' | 'observado' | 'bloqueado';
export type CondicionProveedor = 'excelente' | 'bueno' | 'regular' | 'deficiente' | 'sin_evaluar';
export type TipoProveedor = 'bienes' | 'servicios' | 'mixto';
export type CategoriaProveedor =
  | 'repuestos' | 'taller' | 'combustible' | 'seguros'
  | 'equipos_medicos' | 'insumos' | 'servicios_profesionales'
  | 'construccion' | 'tecnologia' | 'otros';

export interface Proveedor {
  id: string;
  tenant_id: string;
  codigo: string;
  razon_social: string;
  nombre_comercial: string | null;
  ruc: string;
  tipo: TipoProveedor;
  categoria: CategoriaProveedor;
  estado: EstadoProveedor;
  condicion: CondicionProveedor;
  score: number;
  email: string | null;
  telefono: string | null;
  celular: string | null;
  web: string | null;
  pais: string;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  direccion: string | null;
  banco: string | null;
  cuenta_bancaria: string | null;
  cci: string | null;
  tipo_cuenta: string | null;
  moneda_cuenta: string | null;
  sujeto_detraccion: boolean;
  tasa_detraccion: number | null;
  codigo_bien_servicio: string | null;
  sujeto_retencion: boolean;
  observaciones: string | null;
  motivo_cambio_estado: string | null;
  creado_por: string | null;
  creado_en: string;
  modificado_por: string | null;
  modificado_en: string | null;
}
export type ProveedorInsert = Omit<Proveedor, 'id' | 'creado_en'>;
export type ProveedorUpdate = Partial<Omit<ProveedorInsert, 'tenant_id'>>;

// =============================================================================
// FLOTA — VEHÍCULOS
// =============================================================================

export type EstadoVehiculoDB = 'activo' | 'en_taller' | 'inactivo';
export type TipoVehiculoDB = 'ambulancia' | 'camioneta' | 'van' | 'auto' | 'otro';
export type CombustibleVehiculo = 'gasolina' | 'diesel' | 'gnv' | 'electrico' | 'hibrido';
export type FuenteKm = 'manual' | 'gps' | 'mixto';
export type TipoContratoFlota =
  | 'solo_garantia' | 'mantenimiento_y_garantia' | 'solo_mantenimiento'
  | 'full_service' | 'otro';
export type TipoPlanPreventivo = 'por_km' | 'por_meses' | 'mixto';

export interface VehiculoDB {
  id: string;
  tenant_id: string;
  codigo: string;
  placa: string;
  vin: string | null;
  tipo: TipoVehiculoDB;
  marca: string;
  modelo: string;
  anio: number;
  color: string;
  motor: string | null;
  combustible: CombustibleVehiculo;
  capacidad: string | null;
  kilometraje: number;
  fuente_km: FuenteKm;
  ubicacion_actual: string;
  estado: EstadoVehiculoDB;
  ultimo_mantenimiento: string | null;
  proximo_mantenimiento: string | null;
  public_view_enabled: boolean;
  public_token: string | null;
  // Contrato
  contrato_cliente_nombre: string | null;
  contrato_proyecto_nombre: string | null;
  contrato_nombre: string | null;
  contrato_tipo: TipoContratoFlota | null;
  contrato_fecha_inicio: string | null;
  contrato_fecha_fin: string | null;
  // Proyecto y tipo de flota
  proyecto_id: string | null;
  tipo_flota: string | null;
  // Plan preventivo
  plan_preventivo_habilitado: boolean;
  plan_preventivo_tipo: TipoPlanPreventivo | null;
  plan_preventivo_total_contratados: number;
  plan_preventivo_intervalo_km: number | null;
  plan_preventivo_intervalo_meses: number | null;
  plan_preventivo_costo_total: number;
  plan_preventivo_costo_por_servicio: number;
  // Adquisición y depreciación
  precio_adquisicion: number;
  fecha_adquisicion: string | null;
  valor_residual: number;
  moneda_adquisicion: string;
  // Inactivación
  motivo_inactivacion: string | null;
  inactivado_por: string | null;
  inactivado_en: string | null;
  // Auditoría
  creado_por: string | null;
  creado_en: string;
  modificado_por: string | null;
  modificado_en: string | null;
}
export type VehiculoInsert = Omit<VehiculoDB, 'id' | 'creado_en' | 'public_token'>;
export type VehiculoUpdate = Partial<Omit<VehiculoInsert, 'tenant_id'>>;

export type TipoDocumentoVehiculoDB =
  | 'SOAT' | 'REVISION_TECNICA' | 'TARJETA_PROPIEDAD'
  | 'SEGURO_VEHICULAR' | 'PERMISO_OPERACION' | 'OTRO';

export interface VehiculoDocumentoDB {
  id: string;
  tenant_id: string;
  vehiculo_id: string;
  codigo: string;
  tipo: TipoDocumentoVehiculoDB;
  nombre: string;
  numero: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string;
  archivo_nombre: string | null;
  archivo_url: string | null;
  observaciones: string | null;
  creado_por: string | null;
  creado_en: string;
  modificado_por: string | null;
  modificado_en: string | null;
}
export type VehiculoDocumentoInsert = Omit<VehiculoDocumentoDB, 'id' | 'creado_en'>;
export type VehiculoDocumentoUpdate = Partial<Omit<VehiculoDocumentoInsert, 'tenant_id' | 'vehiculo_id'>>;

// =============================================================================
// FLOTA — ÓRDENES DE TRABAJO
// =============================================================================

export type EstadoOTDB =
  | 'programada' | 'en_ejecucion' | 'espera_repuesto'
  | 'espera_aprobacion' | 'cerrada' | 'anulada';
export type TipoOTDB = 'preventivo' | 'correctivo' | 'predictivo';
export type CriticidadOTDB = 'baja' | 'media' | 'alta' | 'critica';
export type TipoTaller = 'interno' | 'externo';

export interface OrdenTrabajoDB {
  id: string;
  tenant_id: string;
  numero_ot: string;
  vehiculo_id: string;
  vehiculo_placa: string;
  tipo: TipoOTDB;
  criticidad: CriticidadOTDB;
  estado: EstadoOTDB;
  titulo: string;
  descripcion: string;
  taller_nombre: string;
  taller_tipo: TipoTaller;
  fecha_programada: string;
  fecha_inicio: string | null;
  fecha_cierre: string | null;
  sla_estimado_horas: number | null;
  sla_real_horas: number | null;
  kilometraje_registro: number;
  costo_mano_obra: number;
  costo_repuestos: number;
  costo_terceros: number;
  costo_otros: number;
  costo_total: number; // columna generada
  aprobado_por: string | null;
  aprobado_en: string | null;
  motivo_anulacion: string | null;
  creado_por: string | null;
  creado_en: string;
  modificado_por: string | null;
  modificado_en: string | null;
  cerrado_por: string | null;
  proyecto_id?: string | null;
  centro_costo_id?: string | null;
}
export type OrdenTrabajoInsert = Omit<OrdenTrabajoDB, 'id' | 'costo_total' | 'creado_en'>;
export type OrdenTrabajoUpdate = Partial<Omit<OrdenTrabajoInsert, 'tenant_id' | 'vehiculo_id'>>;

export interface OTRepuesto {
  id: string;
  tenant_id: string;
  orden_trabajo_id: string;
  nombre: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number; // generado
}
export type OTRepuestoInsert = Omit<OTRepuesto, 'id' | 'costo_total'>;
export type OTRepuestoUpdate = Partial<Omit<OTRepuestoInsert, 'tenant_id' | 'orden_trabajo_id'>>;

export type TipoExtraOT = 'pieza' | 'servicio';

export interface OTExtra {
  id: string;
  tenant_id: string;
  orden_trabajo_id: string;
  tipo: TipoExtraOT;
  categoria: string | null;
  descripcion: string;
  motivo: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number; // generado
  eliminado: boolean;
  motivo_eliminacion: string | null;
  eliminado_por: string | null;
  fecha_eliminacion: string | null;
  registrado_por: string | null;
  fecha_registro: string;
}
export type OTExtraInsert = Omit<OTExtra, 'id' | 'costo_total' | 'fecha_registro'>;
export type OTExtraUpdate = Partial<Omit<OTExtraInsert, 'tenant_id' | 'orden_trabajo_id'>>;

// =============================================================================
// FLOTA — GPS
// =============================================================================

export interface GpsPosicionDB {
  id: string;
  tenant_id: string;
  vehiculo_id: string;
  dispositivo_id?: string | null;
  latitud: number;
  longitud: number;
  velocidad?: number | null;
  rumbo?: number | null;
  altitud?: number | null;
  odometro?: number | null;
  evento?: string | null;
  ignicion?: boolean | null;
  bateria_voltaje?: number | null;
  satelites?: number | null;
  precision_gps?: number | null;
  direccion_texto?: string | null;
  fecha_dispositivo: string;
  recibido_en: string;
  vehiculo?: { codigo: string; placa: string; marca?: string; modelo?: string; } | null;
}

export type EstadoGps = 'activo' | 'inactivo';

export interface GpsDispositivo {
  id: string;
  tenant_id: string;
  vehiculo_id: string;
  proveedor: string;
  identificador_api: string;
  estado: EstadoGps;
  creado_en: string;
}
export type GpsDispositivoInsert = Omit<GpsDispositivo, 'id' | 'creado_en'>;
export type GpsDispositivoUpdate = Partial<Omit<GpsDispositivoInsert, 'tenant_id' | 'vehiculo_id'>>;

export type EstadoGpsSync = 'ok' | 'error' | 'inconsistente';

export interface GpsSyncLog {
  id: string;
  tenant_id: string;
  vehiculo_id: string;
  km_recibido: number;
  km_anterior: number;
  diferencia: number; // generado
  sync_datetime: string;
  estado: EstadoGpsSync;
  error_mensaje: string | null;
}
export type GpsSyncLogInsert = Omit<GpsSyncLog, 'id' | 'diferencia' | 'sync_datetime'>;

// =============================================================================
// BIOMÉDICO — CLIENTES / SEDES / ÁREAS
// =============================================================================

export interface ClienteBio {
  id: string;
  tenant_id: string;
  codigo: string;
  nombre: string;
  ruc: string | null;
  tipo: 'hospital' | 'clinica' | 'centro_salud' | 'laboratorio' | 'otro';
  sector: 'publico' | 'privado' | 'mixto';
  estado: 'activo' | 'inactivo';
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
  contrato_activo: boolean;
  contrato_inicio: string | null;
  contrato_fin: string | null;
  observaciones: string | null;
  creado_por: string | null;
  creado_en: string;
  modificado_por: string | null;
  modificado_en: string | null;
}
export type ClienteBioInsert = Omit<ClienteBio, 'id' | 'creado_en'>;
export type ClienteBioUpdate = Partial<Omit<ClienteBioInsert, 'tenant_id'>>;

export interface Sede {
  id: string;
  tenant_id: string;
  cliente_id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
  telefono: string | null;
  responsable: string | null;
  estado: 'activo' | 'inactivo';
  creado_por: string | null;
  creado_en: string;
  modificado_por: string | null;
  modificado_en: string | null;
}
export type SedeInsert = Omit<Sede, 'id' | 'creado_en'>;
export type SedeUpdate = Partial<Omit<SedeInsert, 'tenant_id'>>;

export interface AreaClinica {
  id: string;
  tenant_id: string;
  sede_id: string;
  codigo: string;
  nombre: string;
  tipo: string | null;
  piso: string | null;
  responsable: string | null;
  estado: 'activo' | 'inactivo';
  creado_por: string | null;
  creado_en: string;
  modificado_por: string | null;
  modificado_en: string | null;
}
export type AreaClinicaInsert = Omit<AreaClinica, 'id' | 'creado_en'>;
export type AreaClinicaUpdate = Partial<Omit<AreaClinicaInsert, 'tenant_id'>>;

export interface HistorialUbicacionEquipo {
  id: string;
  tenant_id: string;
  equipo_id: string;
  cliente_id_anterior: string | null;
  sede_id_anterior: string | null;
  area_id_anterior: string | null;
  ubicacion_anterior: string | null;
  cliente_id_nuevo: string | null;
  sede_id_nuevo: string | null;
  area_id_nuevo: string | null;
  ubicacion_nueva: string | null;
  motivo: string | null;
  fecha_cambio: string;
  realizado_por: string | null;
}

// BIOMÉDICO
// =============================================================================

export type EstadoEquipoBiomedico =
  | 'operativo' | 'mantenimiento' | 'fuera_servicio' | 'baja' | 'calibracion';
export type CategoriaEquipoBiomedico =
  | 'diagnostico' | 'terapeutico' | 'soporte_vital' | 'laboratorio' | 'rehabilitacion';
export type RiesgoBiomedico = 'bajo' | 'medio' | 'alto' | 'critico';

export interface EquipoBiomedico {
  id: string;
  tenant_id: string;
  codigo: string;
  nombre: string;
  marca: string;
  modelo: string;
  serie: string | null;
  anio_fabricacion: number | null;
  categoria: CategoriaEquipoBiomedico;
  riesgo: RiesgoBiomedico;
  estado: EstadoEquipoBiomedico;
  ubicacion: string;
  servicio_clinico: string | null;
  cliente_id: string | null;
  sede_id: string | null;
  area_id: string | null;
  fecha_adquisicion: string | null;
  proveedor_id: string | null;
  costo_adquisicion: number | null;
  garantia_vence: string | null;
  frecuencia_mp_dias: number;
  ultimo_mantenimiento: string | null;
  proximo_mantenimiento: string | null;
  motivo_baja: string | null;
  dado_de_baja_por: string | null;
  dado_de_baja_en: string | null;
  // Campos adicionales persistibles
  especificaciones: Record<string, unknown> | null;
  fecha_instalacion: string | null;
  garantia_proveedor: string | null;
  garantia_fecha_inicio: string | null;
  observaciones: string | null;
  creado_por: string | null;
  creado_en: string;
  modificado_por: string | null;
  modificado_en: string | null;
  // Proyecto asociado
  proyecto_id?: string | null;
  // QR público
  public_token?: string | null;
  public_view_enabled?: boolean;
}
export type EquipoBiomedicoInsert = Omit<EquipoBiomedico, 'id' | 'creado_en'>;
export type EquipoBiomedicoUpdate = Partial<Omit<EquipoBiomedicoInsert, 'tenant_id'>>;

export type EstadoMantenimientoBio = 'programado' | 'en_ejecucion' | 'completado' | 'anulado';
export type TipoMantenimientoBio = 'preventivo' | 'correctivo' | 'calibracion';

export interface MantenimientoBiomedico {
  id: string;
  tenant_id: string;
  numero: string;
  equipo_id: string;
  equipo_codigo: string;
  tipo: TipoMantenimientoBio;
  estado: EstadoMantenimientoBio;
  prioridad: CriticidadOTDB;
  titulo: string;
  descripcion: string | null;
  hallazgos: string | null;
  acciones_realizadas: string | null;
  recomendaciones: string | null;
  fecha_programada: string;
  fecha_inicio: string | null;
  fecha_cierre: string | null;
  tecnico_nombre: string | null;
  proveedor_id: string | null;
  costo_mano_obra: number;
  costo_repuestos: number;
  costo_total: number; // generado
  proxima_fecha: string | null;
  creado_por: string | null;
  creado_en: string;
  modificado_por: string | null;
  modificado_en: string | null;
  proyecto_id?: string | null;
  centro_costo_id?: string | null;
}
export type MantenimientoBiomedicoInsert = Omit<MantenimientoBiomedico, 'id' | 'costo_total' | 'creado_en'>;
export type MantenimientoBiomedicoUpdate = Partial<Omit<MantenimientoBiomedicoInsert, 'tenant_id' | 'equipo_id'>>;

// =============================================================================
// COMPRAS
// =============================================================================

export type EstadoRequerimiento = 'borrador' | 'enviado' | 'aprobado' | 'rechazado' | 'anulado';
export type PrioridadCompra = 'alta' | 'media' | 'baja';
export type CentroCostoCompra =
  | 'flota' | 'biomedico' | 'administracion' | 'operaciones' | 'ti' | 'mantenimiento';

export interface RequerimientoCompra {
  id: string;
  tenant_id: string;
  numero: string;
  titulo: string;
  descripcion: string | null;
  estado: EstadoRequerimiento;
  prioridad: PrioridadCompra;
  centro_costo: CentroCostoCompra;
  fecha_requerida: string | null;
  motivo_rechazo: string | null;
  motivo_anulacion: string | null;
  aprobado_por: string | null;
  aprobado_en: string | null;
  creado_por: string | null;
  creado_en: string;
  modificado_por: string | null;
  modificado_en: string | null;
  proyecto_id?: string | null;
  centro_costo_id?: string | null;
}
export type RequerimientoCompraInsert = Omit<RequerimientoCompra, 'id' | 'creado_en'>;
export type RequerimientoCompraUpdate = Partial<Omit<RequerimientoCompraInsert, 'tenant_id'>>;

export interface RequerimientoItem {
  id: string;
  tenant_id: string;
  requerimiento_id: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  costo_estimado_unitario: number;
  observaciones: string | null;
}
export type RequerimientoItemInsert = Omit<RequerimientoItem, 'id'>;
export type RequerimientoItemUpdate = Partial<Omit<RequerimientoItemInsert, 'tenant_id' | 'requerimiento_id'>>;

export type EstadoCotizacion =
  | 'borrador' | 'enviada' | 'recibida' | 'aprobada' | 'rechazada' | 'anulada';

export interface Cotizacion {
  id: string;
  tenant_id: string;
  numero: string;
  requerimiento_id: string | null;
  proveedor_id: string;
  estado: EstadoCotizacion;
  fecha_emision: string;
  fecha_validez: string | null;
  moneda: string;
  subtotal: number;
  igv: number;
  total: number;
  plazo_entrega: string | null;
  condiciones_pago: string | null;
  observaciones: string | null;
  // Aprobación / Rechazo
  aprobado_por: string | null;
  aprobado_en: string | null;
  rechazado_por: string | null;
  rechazado_en: string | null;
  motivo_rechazo: string | null;
  motivo_anulacion: string | null;
  creado_por: string | null;
  creado_en: string;
  modificado_por: string | null;
  modificado_en: string | null;
  proyecto_id?: string | null;
  centro_costo_id?: string | null;
}
export type CotizacionInsert = Omit<Cotizacion, 'id' | 'creado_en'>;
export type CotizacionUpdate = Partial<Omit<CotizacionInsert, 'tenant_id'>>;

export interface CotizacionItem {
  id: string;
  tenant_id: string;
  cotizacion_id: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number; // generado
}
export type CotizacionItemInsert = Omit<CotizacionItem, 'id' | 'precio_total'>;
export type CotizacionItemUpdate = Partial<Omit<CotizacionItemInsert, 'tenant_id' | 'cotizacion_id'>>;

export type EstadoOrdenCompra =
  | 'borrador' | 'enviada' | 'aprobada' | 'recibida_parcial' | 'recibida_total' | 'anulada';
export type TipoOrdenCompra = 'oc' | 'os';

export interface OrdenCompra {
  id: string;
  tenant_id: string;
  numero: string;
  tipo: TipoOrdenCompra;
  cotizacion_id: string | null;
  proveedor_id: string;
  estado: EstadoOrdenCompra;
  fecha_emision: string;
  fecha_entrega_esperada: string | null;
  moneda: string;
  subtotal: number;
  igv: number;
  total: number;
  condiciones_pago: string | null;
  lugar_entrega: string | null;
  observaciones: string | null;
  aprobado_por: string | null;
  aprobado_en: string | null;
  rechazado_por: string | null;
  rechazado_en: string | null;
  motivo_rechazo: string | null;
  motivo_anulacion: string | null;
  en_ejecucion_desde: string | null;
  creado_por: string | null;
  creado_en: string;
  modificado_por: string | null;
  modificado_en: string | null;
  proyecto_id?: string | null;
  centro_costo_id?: string | null;
}
export type OrdenCompraInsert = Omit<OrdenCompra, 'id' | 'creado_en'>;
export type OrdenCompraUpdate = Partial<Omit<OrdenCompraInsert, 'tenant_id'>>;

export interface OrdenItem {
  id: string;
  tenant_id: string;
  orden_id: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number; // generado
}
export type OrdenItemInsert = Omit<OrdenItem, 'id' | 'precio_total'>;
export type OrdenItemUpdate = Partial<Omit<OrdenItemInsert, 'tenant_id' | 'orden_id'>>;

export type EstadoRecepcion = 'pendiente' | 'conforme' | 'observado' | 'rechazado';

export interface Recepcion {
  id: string;
  tenant_id: string;
  numero: string;
  orden_id: string;
  proveedor_id: string;
  estado: EstadoRecepcion;
  fecha_recepcion: string;
  numero_guia: string | null;
  numero_factura: string | null;
  observaciones: string | null;
  proyecto_id?: string | null;
  centro_costo_id?: string | null;
  creado_por: string | null;
  creado_en: string;
  modificado_por: string | null;
  modificado_en: string | null;
}
export type RecepcionInsert = Omit<Recepcion, 'id' | 'creado_en'>;
export type RecepcionUpdate = Partial<Omit<RecepcionInsert, 'tenant_id'>>;

export interface RecepcionItem {
  id: string;
  tenant_id: string;
  recepcion_id: string;
  descripcion: string;
  unidad: string;
  cantidad_pedida: number;
  cantidad_recibida: number;
  conforme: boolean;
  observaciones: string | null;
}
export type RecepcionItemInsert = Omit<RecepcionItem, 'id'>;
export type RecepcionItemUpdate = Partial<Omit<RecepcionItemInsert, 'tenant_id' | 'recepcion_id'>>;

// =============================================================================
// BIOMÉDICO — CALIBRACIONES
// =============================================================================

export interface CalibracionBiomedica {
  id: string;
  tenant_id: string;
  equipo_id: string;
  numero: string;
  tipo: 'interna' | 'externa' | 'verificacion';
  estado: 'programada' | 'en_proceso' | 'aprobada' | 'rechazada' | 'vencida';
  fecha_programada: string;
  fecha_realizada?: string | null;
  fecha_vencimiento?: string | null;
  responsable?: string | null;
  proveedor_calibracion?: string | null;
  resultado?: 'aprobada' | 'rechazada' | 'con_observaciones' | null;
  incertidumbre?: string | null;
  certificado_numero?: string | null;
  observaciones?: string | null;
  creado_por?: string | null;
  creado_en: string;
  modificado_por?: string | null;
  modificado_en?: string | null;
  // joined
  equipo?: { codigo: string; nombre: string; } | null;
}

// =============================================================================
// BIOMÉDICO — INCIDENCIAS
// =============================================================================

export interface IncidenciaBiomedica {
  id: string;
  tenant_id: string;
  equipo_id: string;
  numero: string;
  tipo: 'falla' | 'error_usuario' | 'accidente' | 'deterioro' | 'otro';
  severidad: 'baja' | 'media' | 'alta' | 'critica';
  estado: 'abierta' | 'en_investigacion' | 'resuelta' | 'cerrada';
  fecha_ocurrencia: string;
  descripcion: string;
  acciones_tomadas?: string | null;
  reportado_por?: string | null;
  resuelto_por?: string | null;
  fecha_resolucion?: string | null;
  requiere_mantenimiento: boolean;
  creado_por?: string | null;
  creado_en: string;
  modificado_por?: string | null;
  modificado_en?: string | null;
  // joined
  equipo?: { codigo: string; nombre: string; } | null;
}

// =============================================================================
// BIOMÉDICO — DOCUMENTOS
// =============================================================================

export interface DocumentoBiomedico {
  id: string;
  tenant_id: string;
  equipo_id: string;
  nombre: string;
  tipo: 'manual' | 'certificado' | 'protocolo' | 'garantia' | 'ficha_tecnica' | 'otro';
  descripcion?: string | null;
  url_storage?: string | null;
  nombre_archivo?: string | null;
  tamano_bytes?: number | null;
  mime_type?: string | null;
  vigencia?: string | null;
  subido_por?: string | null;
  creado_en: string;
  // joined
  equipo?: { codigo: string; nombre: string; } | null;
}

// ── Contratos Biomédicos ─────────────────────────────────
export interface ContratoBioDB {
  id: string;
  tenant_id: string;
  numero: string;
  equipo_id: string;
  tipo: 'garantia' | 'mantenimiento_preventivo' | 'correctivo' | 'sla' | 'oem' | 'integral';
  estado: 'activo' | 'vencido' | 'cancelado' | 'en_renovacion' | 'borrador';
  proveedor_nombre: string;
  proveedor_id?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  valor_contrato?: number | null;
  moneda: string;
  cobertura?: string | null;
  sla_tiempo_respuesta_hrs?: number | null;
  sla_disponibilidad_pct?: number | null;
  sla_penalidades?: string | null;
  observaciones?: string | null;
  creado_por?: string | null;
  creado_en: string;
  modificado_por?: string | null;
  modificado_en?: string | null;
  equipo?: { codigo: string; nombre: string } | null;
}

// ── Evaluaciones de Proveedores ───────────────────────────
export interface EvaluacionProveedor {
  id: string;
  tenant_id: string;
  proveedor_id: string;
  numero: string;
  periodo: string;
  tipo: 'mensual' | 'trimestral' | 'anual' | 'puntual';
  estado: 'borrador' | 'en_revision' | 'aprobada' | 'rechazada';
  calidad?: number | null;
  entrega?: number | null;
  precio?: number | null;
  servicio?: number | null;
  documentacion?: number | null;
  puntaje_total?: number | null;
  resultado?: 'excelente' | 'bueno' | 'regular' | 'deficiente' | null;
  evaluador?: string | null;
  comentarios?: string | null;
  acciones_mejora?: string | null;
  creado_por?: string | null;
  creado_en: string;
  modificado_por?: string | null;
  modificado_en?: string | null;
  proveedor?: { codigo: string; razon_social: string; } | null;
}

// ── Contratos de Proveedores ──────────────────────────────
export interface ContratoProveedor {
  id: string;
  tenant_id: string;
  proveedor_id: string;
  numero: string;
  tipo: 'servicio' | 'suministro' | 'mantenimiento' | 'consultoria' | 'otro';
  estado: 'borrador' | 'activo' | 'vencido' | 'rescindido' | 'renovacion';
  descripcion: string;
  monto_total?: number | null;
  moneda: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_firma?: string | null;
  condiciones_pago?: string | null;
  penalidades?: string | null;
  url_documento?: string | null;
  observaciones?: string | null;
  creado_por?: string | null;
  creado_en: string;
  modificado_por?: string | null;
  modificado_en?: string | null;
  proveedor?: { codigo: string; razon_social: string; } | null;
}

// ── RBAC ─────────────────────────────────────────────────
export interface RolDB {
  id: string;
  tenant_id: string;
  nombre: string;
  descripcion?: string | null;
  es_sistema: boolean;
  creado_en: string;
  permisos?: PermisoDBRow[] | null;
}

export interface PermisoDBRow {
  id: string;
  modulo: string;
  accion: string;
  descripcion?: string | null;
}

export interface UsuarioRolDB {
  id: string;
  tenant_id: string;
  user_id: string;
  rol_id: string;
  asignado_por?: string | null;
  asignado_en: string;
  rol?: RolDB | null;
}

export interface UsuarioTenantDB {
  id: string;
  tenant_id: string;
  user_id: string;
  nombre: string;
  email: string;
  cargo?: string | null;
  departamento?: string | null;
  telefono?: string | null;
  avatar_url?: string | null;
  estado: 'activo' | 'inactivo' | 'suspendido';
  creado_en: string;
  roles?: RolDB[] | null;
}

// ── Inventario ────────────────────────────────────────────
export interface CategoriaInventarioDB {
  id: string; tenant_id: string; nombre: string; descripcion?: string | null; codigo?: string | null; creado_en: string;
}
export interface AlmacenDB {
  id: string; tenant_id: string; nombre: string; codigo: string;
  tipo: 'general' | 'repuestos' | 'suministros' | 'herramientas' | 'consumibles';
  ubicacion?: string | null; responsable?: string | null;
  estado: 'activo' | 'inactivo'; creado_en: string;
}
export interface ArticuloDB {
  id: string; tenant_id: string; categoria_id?: string | null; codigo: string; nombre: string; descripcion?: string | null;
  unidad_medida: 'unidad' | 'kg' | 'litro' | 'metro' | 'caja' | 'par' | 'juego' | 'rollo' | 'galón';
  tipo: 'repuesto' | 'suministro' | 'herramienta' | 'consumible' | 'equipo';
  stock_actual: number; stock_minimo: number; stock_maximo?: number | null;
  precio_unitario?: number | null; moneda: string;
  marca?: string | null; modelo?: string | null; codigo_fabricante?: string | null; imagen_url?: string | null;
  activo: boolean; creado_por?: string | null; creado_en: string; modificado_por?: string | null; modificado_en?: string | null;
  categoria?: { nombre: string; codigo?: string | null } | null;
}
export interface MovimientoInventarioDB {
  id: string; tenant_id: string; articulo_id: string; almacen_id: string; numero: string;
  tipo: 'entrada' | 'salida' | 'ajuste' | 'transferencia';
  motivo: 'compra' | 'devolucion' | 'consumo' | 'mantenimiento' | 'ajuste_positivo' | 'ajuste_negativo' | 'transferencia_entrada' | 'transferencia_salida' | 'merma' | 'inicial';
  cantidad: number; stock_anterior: number; stock_nuevo: number;
  precio_unitario?: number | null; costo_total?: number | null;
  referencia_id?: string | null; referencia_tipo?: string | null;
  notas?: string | null; realizado_por?: string | null;
  fecha: string; creado_en: string;
  articulo?: { codigo: string; nombre: string; unidad_medida: string } | null;
  almacen?: { nombre: string; codigo: string } | null;
}

// ── Talleres ──────────────────────────────────────────────
export interface TallerDB {
  id: string;
  tenant_id: string;
  proveedor_id?: string | null;
  codigo: string;
  nombre: string;
  tipo: 'mecanico' | 'electrico' | 'carroceria' | 'neumaticos' | 'aire_acondicionado' | 'general' | 'especializado';
  estado: 'activo' | 'inactivo' | 'suspendido';
  contacto_nombre?: string | null;
  contacto_telefono?: string | null;
  contacto_email?: string | null;
  departamento?: string | null;
  provincia?: string | null;
  distrito?: string | null;
  direccion?: string | null;
  especialidades?: string[] | null;
  marcas_autorizadas?: string[] | null;
  horario_atencion?: string | null;
  tiempo_respuesta_horas?: number | null;
  moneda: string;
  condiciones_pago?: string | null;
  observaciones?: string | null;
  creado_por?: string | null;
  creado_en: string;
  modificado_por?: string | null;
  modificado_en?: string | null;
  proveedor?: { codigo: string; razon_social: string; } | null;
}

// ── CRM ───────────────────────────────────────────────────
export interface ClienteDB {
  id: string; tenant_id: string; codigo: string; razon_social: string;
  nombre_comercial?: string | null;
  tipo: 'empresa' | 'persona_natural' | 'gobierno' | 'ong';
  sector?: string | null;
  estado: 'activo' | 'inactivo' | 'prospecto' | 'perdido';
  contacto_nombre?: string | null; contacto_cargo?: string | null;
  contacto_telefono?: string | null; contacto_email?: string | null;
  departamento?: string | null; provincia?: string | null;
  distrito?: string | null; direccion?: string | null;
  ruc?: string | null; credito_limite?: number | null; credito_dias?: number | null;
  moneda: string; categoria?: 'A' | 'B' | 'C' | null;
  origen?: string | null; descripcion?: string | null; observaciones?: string | null;
  ejecutivo_cuenta?: string | null;
  creado_por?: string | null; creado_en: string;
  modificado_por?: string | null; modificado_en?: string | null;
}
export interface OportunidadDB {
  id: string; tenant_id: string; cliente_id: string; codigo: string; titulo: string;
  descripcion?: string | null;
  etapa: 'prospecto' | 'calificado' | 'propuesta' | 'negociacion' | 'cerrado_ganado' | 'cerrado_perdido';
  probabilidad: number; monto_estimado?: number | null; moneda: string;
  fecha_cierre_estimada?: string | null; fecha_cierre_real?: string | null;
  motivo_cierre?: string | null;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  ejecutivo?: string | null;
  creado_por?: string | null; creado_en: string;
  modificado_por?: string | null; modificado_en?: string | null;
  cliente?: { codigo: string; razon_social: string; } | null;
}
export interface ActividadCRMDB {
  id: string; tenant_id: string; cliente_id: string; oportunidad_id?: string | null;
  tipo: 'llamada' | 'reunion' | 'email' | 'visita' | 'propuesta' | 'seguimiento' | 'otro';
  estado: 'pendiente' | 'realizada' | 'cancelada';
  titulo: string; descripcion?: string | null;
  fecha_programada: string; fecha_realizada?: string | null;
  resultado?: string | null; proxima_accion?: string | null;
  realizado_por?: string | null; creado_por?: string | null; creado_en: string;
  cliente?: { codigo: string; razon_social: string; } | null;
  oportunidad?: { codigo: string; titulo: string; } | null;
}

// ── Finanzas ──────────────────────────────────────────────
export interface TransaccionDB {
  id: string; tenant_id: string; numero: string;
  tipo: 'ingreso' | 'egreso' | 'transferencia';
  categoria: string; subcategoria?: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'pagada' | 'anulada';
  monto: number; moneda: string; tipo_cambio?: number | null; monto_soles?: number | null;
  fecha: string; fecha_pago?: string | null; descripcion: string;
  cuenta_id?: string | null; centro_costo_id?: string | null; proyecto_id?: string | null;
  referencia_numero?: string | null; referencia_tipo?: string | null;
  proveedor_nombre?: string | null;
  aprobado_por?: string | null; aprobado_en?: string | null;
  comprobante_url?: string | null;
  creado_por?: string | null; creado_en: string;
  modificado_por?: string | null; modificado_en?: string | null;
}
export interface PresupuestoLineaDB {
  id: string; tenant_id: string; presupuesto_id: string;
  categoria: string; subcategoria?: string | null;
  monto_presupuestado: number; monto_ejecutado: number;
  centro_costo_id?: string | null; proyecto_id?: string | null;
}
export interface PresupuestoDB {
  id: string; tenant_id: string; nombre: string; periodo: string;
  tipo: 'mensual' | 'trimestral' | 'anual';
  estado: 'borrador' | 'aprobado' | 'cerrado';
  moneda: string; descripcion?: string | null;
  creado_por?: string | null; creado_en: string;
  lineas?: PresupuestoLineaDB[] | null;
}
export interface CajaChicaDB {
  id: string; tenant_id: string; nombre: string; codigo: string;
  responsable: string; monto_asignado: number; monto_disponible: number;
  moneda: string; estado: 'activo' | 'en_reposicion' | 'cerrada'; creado_en: string;
}
export interface GastoCajaChicaDB {
  id: string; tenant_id: string; caja_id: string; numero: string;
  descripcion: string; categoria: string; monto: number; moneda: string;
  fecha: string; beneficiario?: string | null;
  comprobante_numero?: string | null;
  comprobante_tipo?: 'boleta' | 'factura' | 'recibo' | 'sin_comprobante' | null;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  aprobado_por?: string | null; notas?: string | null;
  realizado_por?: string | null; creado_en: string;
  proyecto_id?: string | null; centro_costo_id?: string | null;
  caja?: { nombre: string; codigo: string } | null;
}

// ── Proyectos ─────────────────────────────────────────────
export interface ProyectoDB {
  id: string; tenant_id: string; codigo: string; nombre: string; descripcion?: string | null;
  tipo: 'interno' | 'cliente' | 'infraestructura' | 'mejora' | 'investigacion';
  estado: 'planificacion' | 'en_ejecucion' | 'pausado' | 'completado' | 'cancelado';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  fecha_inicio?: string | null; fecha_fin_estimada?: string | null; fecha_fin_real?: string | null;
  presupuesto?: number | null; costo_real?: number | null; moneda: string;
  gerente_proyecto?: string | null; cliente_id?: string | null;
  porcentaje_avance: number;
  // Fase 2: Proyecto-céntrico
  modalidad?: string | null; // oxi, ioarr, licitacion, adjudicacion, otro
  entidad_cliente?: string | null; // Municipalidad, GORE, etc.
  region?: string | null; // Región/departamento
  monto_contrato?: number | null; // Monto base del contrato
  monto_adenda?: number | null; // Monto adicional por adendas
  creado_por?: string | null; creado_en: string;
  modificado_por?: string | null; modificado_en?: string | null;
  fases?: FaseProyectoDB[] | null;
  tareas?: TareaProyectoDB[] | null;
  miembros?: MiembroProyectoDB[] | null;
}
export interface FaseProyectoDB {
  id: string; tenant_id: string; proyecto_id: string; nombre: string;
  descripcion?: string | null; orden: number;
  estado: 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';
  fecha_inicio?: string | null; fecha_fin?: string | null; porcentaje_avance: number;
  presupuesto?: number | null; costo_real?: number | null;
}
export interface TareaProyectoDB {
  id: string; tenant_id: string; proyecto_id: string; fase_id?: string | null;
  titulo: string; descripcion?: string | null;
  estado: 'pendiente' | 'en_progreso' | 'completada' | 'bloqueada' | 'cancelada';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  asignado_a?: string | null;
  fecha_inicio?: string | null; fecha_vencimiento?: string | null; fecha_completada?: string | null;
  estimacion_horas?: number | null; horas_reales?: number | null;
  orden: number; creado_por?: string | null; creado_en: string;
}
export interface MiembroProyectoDB {
  id: string; tenant_id: string; proyecto_id: string; user_id?: string | null;
  nombre: string; rol: string; horas_asignadas?: number | null;
}

// ── Valorizaciones (hitos de facturación por proyecto) ───
export interface ValorizacionDB {
  id: string; tenant_id: string; proyecto_id: string; fase_id?: string | null;
  numero: number; // Valorización N°
  descripcion: string;
  monto: number; moneda: string;
  estado: 'pendiente' | 'presentada' | 'aprobada' | 'rechazada' | 'facturada' | 'pagada';
  fecha_presentacion?: string | null;
  fecha_aprobacion?: string | null;
  fecha_pago?: string | null;
  observaciones?: string | null;
  conformidad_parcial?: boolean; // true = conformidad parcial, false = total
  porcentaje_conformidad?: number | null; // 0-100 si parcial
  creado_por?: string | null; creado_en: string;
}

// ── Adendas de Proyecto ──────────────────────────────────
export interface AdendaProyectoDB {
  id: string; tenant_id: string; proyecto_id: string;
  numero: number; descripcion: string; monto: number; moneda: string;
  fecha?: string | null; documento_url?: string | null;
  creado_por?: string | null; creado_en: string;
}

// ── Centros de Costo ─────────────────────────────────────
export interface CentroCostoDB {
  id: string; tenant_id: string; codigo: string; nombre: string;
  descripcion?: string | null; activo: boolean; creado_en: string;
}

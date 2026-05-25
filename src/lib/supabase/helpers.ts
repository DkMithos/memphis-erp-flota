/**
 * Memphis ERP – Helpers de acceso a Supabase por módulo
 * Cada función devuelve un query builder pre-filtrado por tenant.
 * Usar estos helpers garantiza que nunca se acceda a datos de otro tenant.
 */

import { supabase } from "./client";
import type { EvaluacionProveedor, ContratoProveedor, TallerDB, RolDB, UsuarioTenantDB, ArticuloDB, AlmacenDB, CategoriaInventarioDB, MovimientoInventarioDB, ClienteDB, OportunidadDB, ActividadCRMDB, TransaccionDB, PresupuestoDB, CajaChicaDB, GastoCajaChicaDB, ProyectoDB, FaseProyectoDB, TareaProyectoDB, MiembroProyectoDB, CentroCostoDB, ValorizacionDB, ClienteBioInsert, ClienteBioUpdate, SedeInsert, SedeUpdate, AreaClinicaInsert, AreaClinicaUpdate } from "./types";

// =============================================================================
// HELPER BASE — obtiene tenant_id del usuario autenticado
// =============================================================================

/** Devuelve el tenant_id del usuario autenticado desde la función RPC de Supabase */
export async function getTenantId(): Promise<string> {
  const { data, error } = await supabase.rpc("auth_tenant_id");
  if (error || !data) throw new Error("No se pudo obtener el tenant_id del usuario");
  return data as string;
}

// =============================================================================
// FLOTA — VEHÍCULOS
// =============================================================================

export const dbVehiculos = {
  /** Lista todos los vehículos del tenant */
  list: () => supabase.from("vehiculos").select("*"),

  /** Obtiene un vehículo por su UUID interno */
  getById: (id: string) =>
    supabase.from("vehiculos").select("*").eq("id", id).single(),

  /** Obtiene un vehículo por su código legible (VH-001) */
  getByCodigo: (codigo: string) =>
    supabase.from("vehiculos").select("*").eq("codigo", codigo).single(),

  /** Obtiene un vehículo por su token público (para QR sin auth) */
  getByPublicToken: (token: string) =>
    supabase
      .from("vehiculos")
      .select("*")
      .eq("public_token", token)
      .eq("public_view_enabled", true)
      .single(),

  /** Crea un nuevo vehículo */
  create: (data: Parameters<typeof supabase.from<"vehiculos">>[0] extends never ? never : any) =>
    supabase.from("vehiculos").insert(data).select().single(),

  /** Actualiza un vehículo */
  update: (id: string, data: object) =>
    supabase.from("vehiculos").update(data).eq("id", id).select().single(),

  /** Documentos de un vehículo */
  documentos: {
    list: (vehiculoId: string) =>
      supabase.from("vehiculo_documentos").select("*").eq("vehiculo_id", vehiculoId),
    create: (data: object) =>
      supabase.from("vehiculo_documentos").insert(data).select().single(),
    update: (id: string, data: object) =>
      supabase.from("vehiculo_documentos").update(data).eq("id", id).select().single(),
    delete: (id: string) =>
      supabase.from("vehiculo_documentos").delete().eq("id", id),
  },
};

// =============================================================================
// FLOTA — ÓRDENES DE TRABAJO
// =============================================================================

export const dbOrdenesTrabajo = {
  /** Lista todas las OTs (con datos del vehículo en join) */
  list: () =>
    supabase
      .from("ordenes_trabajo")
      .select("*, vehiculo:vehiculos(codigo, placa, tipo, marca, modelo)")
      .order("creado_en", { ascending: false }),

  /** Lista OTs de un vehículo específico */
  listByVehiculo: (vehiculoId: string) =>
    supabase
      .from("ordenes_trabajo")
      .select("*")
      .eq("vehiculo_id", vehiculoId)
      .order("creado_en", { ascending: false }),

  /** Obtiene una OT por su número (OT-2024-001) */
  getByNumero: (numeroOT: string) =>
    supabase
      .from("ordenes_trabajo")
      .select("*, repuestos:ot_repuestos(*), extras:ot_extras(*)")
      .eq("numero_ot", numeroOT)
      .single(),

  create: (data: object) =>
    supabase.from("ordenes_trabajo").insert(data).select().single(),

  update: (id: string, data: object) =>
    supabase.from("ordenes_trabajo").update(data).eq("id", id).select().single(),

  /** Repuestos */
  repuestos: {
    list: (otId: string) =>
      supabase.from("ot_repuestos").select("*").eq("orden_trabajo_id", otId),
    create: (data: object) =>
      supabase.from("ot_repuestos").insert(data).select().single(),
    delete: (id: string) =>
      supabase.from("ot_repuestos").delete().eq("id", id),
  },

  /** Extras / hallazgos */
  extras: {
    list: (otId: string) =>
      supabase
        .from("ot_extras")
        .select("*")
        .eq("orden_trabajo_id", otId)
        .eq("eliminado", false),
    create: (data: object) =>
      supabase.from("ot_extras").insert(data).select().single(),
    softDelete: (id: string, motivoEliminacion: string, eliminadoPor: string) =>
      supabase
        .from("ot_extras")
        .update({ eliminado: true, motivo_eliminacion: motivoEliminacion, eliminado_por: eliminadoPor, fecha_eliminacion: new Date().toISOString() })
        .eq("id", id),
  },
};

// =============================================================================
// BIOMÉDICO — CLIENTES / SEDES / ÁREAS CLÍNICAS
// =============================================================================

export const dbClientesBio = {
  list: () =>
    supabase.from("clientes_bio").select("*").order("nombre"),

  getById: (id: string) =>
    supabase.from("clientes_bio").select("*").eq("id", id).single(),

  create: (data: ClienteBioInsert) =>
    supabase.from("clientes_bio").insert(data).select().single(),

  update: (id: string, data: ClienteBioUpdate) =>
    supabase.from("clientes_bio").update(data).eq("id", id).select().single(),
};

export const dbSedes = {
  listByCliente: (clienteId: string) =>
    supabase.from("sedes").select("*").eq("cliente_id", clienteId).order("nombre"),

  list: () =>
    supabase.from("sedes").select("*, cliente:clientes_bio(codigo, nombre)").order("nombre"),

  getById: (id: string) =>
    supabase.from("sedes").select("*").eq("id", id).single(),

  create: (data: SedeInsert) =>
    supabase.from("sedes").insert(data).select().single(),

  update: (id: string, data: SedeUpdate) =>
    supabase.from("sedes").update(data).eq("id", id).select().single(),
};

export const dbAreasClincias = {
  listBySede: (sedeId: string) =>
    supabase.from("areas_clinicas").select("*").eq("sede_id", sedeId).order("nombre"),

  list: () =>
    supabase
      .from("areas_clinicas")
      .select("*, sede:sedes(codigo, nombre, cliente_id)")
      .order("nombre"),

  create: (data: AreaClinicaInsert) =>
    supabase.from("areas_clinicas").insert(data).select().single(),

  update: (id: string, data: AreaClinicaUpdate) =>
    supabase.from("areas_clinicas").update(data).eq("id", id).select().single(),
};

export const dbHistorialUbicacion = {
  listByEquipo: (equipoId: string) =>
    supabase
      .from("historial_ubicacion_equipo")
      .select("*")
      .eq("equipo_id", equipoId)
      .order("fecha_cambio", { ascending: false }),

  create: (data: object) =>
    supabase.from("historial_ubicacion_equipo").insert(data).select().single(),
};

// =============================================================================
// BIOMÉDICO — EQUIPOS
// =============================================================================

export const dbEquiposBiomedicos = {
  list: () =>
    supabase.from("equipos_biomedicos").select("*").order("creado_en", { ascending: false }),

  getByCodigo: (codigo: string) =>
    supabase.from("equipos_biomedicos").select("*").eq("codigo", codigo).single(),

  create: (data: object) =>
    supabase.from("equipos_biomedicos").insert(data).select().single(),

  update: (id: string, data: object) =>
    supabase.from("equipos_biomedicos").update(data).eq("id", id).select().single(),

  getByPublicToken: (token: string) =>
    supabase
      .from("equipos_biomedicos")
      .select("*")
      .eq("public_token", token)
      .eq("public_view_enabled", true)
      .maybeSingle(),
};

// =============================================================================
// BIOMÉDICO — MANTENIMIENTOS
// =============================================================================

export const dbMantenimientosBiomedicos = {
  list: () =>
    supabase
      .from("mantenimientos_biomedicos")
      .select("*, equipo:equipos_biomedicos(codigo, nombre, categoria)")
      .order("creado_en", { ascending: false }),

  listByEquipo: (equipoId: string) =>
    supabase
      .from("mantenimientos_biomedicos")
      .select("*")
      .eq("equipo_id", equipoId)
      .order("fecha_programada", { ascending: false }),

  getByNumero: (numero: string) =>
    supabase.from("mantenimientos_biomedicos").select("*").eq("numero", numero).single(),

  create: (data: object) =>
    supabase.from("mantenimientos_biomedicos").insert(data).select().single(),

  update: (id: string, data: object) =>
    supabase.from("mantenimientos_biomedicos").update(data).eq("id", id).select().single(),
};

// =============================================================================
// PROVEEDORES
// =============================================================================

export const dbProveedores = {
  list: () =>
    supabase.from("proveedores").select("*").order("razon_social"),

  getById: (id: string) =>
    supabase.from("proveedores").select("*").eq("id", id).single(),

  getByCodigo: (codigo: string) =>
    supabase.from("proveedores").select("*").eq("codigo", codigo).single(),

  create: (data: object) =>
    supabase.from("proveedores").insert(data).select().single(),

  update: (id: string, data: object) =>
    supabase.from("proveedores").update(data).eq("id", id).select().single(),
};

// =============================================================================
// COMPRAS — REQUERIMIENTOS
// =============================================================================

export const dbRequerimientos = {
  list: () =>
    supabase
      .from("requerimientos_compra")
      .select("*, items:requerimiento_items(*)")
      .order("creado_en", { ascending: false }),

  getByNumero: (numero: string) =>
    supabase
      .from("requerimientos_compra")
      .select("*, items:requerimiento_items(*)")
      .eq("numero", numero)
      .single(),

  create: (data: object) =>
    supabase.from("requerimientos_compra").insert(data).select().single(),

  update: (id: string, data: object) =>
    supabase.from("requerimientos_compra").update(data).eq("id", id).select().single(),

  items: {
    create: (data: object) =>
      supabase.from("requerimiento_items").insert(data).select().single(),
    delete: (id: string) =>
      supabase.from("requerimiento_items").delete().eq("id", id),
  },
};

// =============================================================================
// COMPRAS — COTIZACIONES
// =============================================================================

export const dbCotizaciones = {
  list: () =>
    supabase
      .from("cotizaciones")
      .select("*, proveedor:proveedores(razon_social, ruc), items:cotizacion_items(*)")
      .order("creado_en", { ascending: false }),

  getByNumero: (numero: string) =>
    supabase
      .from("cotizaciones")
      .select("*, proveedor:proveedores(*), items:cotizacion_items(*)")
      .eq("numero", numero)
      .single(),

  create: (data: object) =>
    supabase.from("cotizaciones").insert(data).select().single(),

  update: (id: string, data: object) =>
    supabase.from("cotizaciones").update(data).eq("id", id).select().single(),
};

// =============================================================================
// COMPRAS — ÓRDENES DE COMPRA
// =============================================================================

export const dbOrdenesCompra = {
  list: () =>
    supabase
      .from("ordenes_compra")
      .select("*, proveedor:proveedores(razon_social, ruc), items:orden_items(*)")
      .order("creado_en", { ascending: false }),

  getByNumero: (numero: string) =>
    supabase
      .from("ordenes_compra")
      .select("*, proveedor:proveedores(*), items:orden_items(*)")
      .eq("numero", numero)
      .single(),

  create: (data: object) =>
    supabase.from("ordenes_compra").insert(data).select().single(),

  update: (id: string, data: object) =>
    supabase.from("ordenes_compra").update(data).eq("id", id).select().single(),
};

// =============================================================================
// FLOTA — GPS POSICIONES
// =============================================================================

export const dbGpsPosiciones = {
  listUltimasPorVehiculo: (tenantId: string) =>
    supabase
      .from('gps_posiciones')
      .select('*, vehiculo:vehiculos(codigo, placa, marca, modelo)')
      .eq('tenant_id', tenantId)
      .order('fecha_dispositivo', { ascending: false })
      .limit(500),

  listHistorial: (vehiculoId: string, desde: string, hasta: string) =>
    supabase
      .from('gps_posiciones')
      .select('latitud, longitud, velocidad, evento, ignicion, fecha_dispositivo')
      .eq('vehiculo_id', vehiculoId)
      .gte('fecha_dispositivo', desde)
      .lte('fecha_dispositivo', hasta)
      .order('fecha_dispositivo', { ascending: true }),
};

// =============================================================================
// BIOMÉDICO — CALIBRACIONES
// =============================================================================

export const dbCalibraciones = {
  list: (tenantId: string) =>
    supabase
      .from('calibraciones_biomedicas')
      .select('*, equipo:equipos_biomedicos(codigo, nombre)')
      .eq('tenant_id', tenantId)
      .order('creado_en', { ascending: false }),

  insert: (data: object) =>
    supabase.from('calibraciones_biomedicas').insert(data).select().single(),

  update: (id: string, data: object) =>
    supabase.from('calibraciones_biomedicas').update(data).eq('id', id).select().single(),

  delete: (id: string) =>
    supabase.from('calibraciones_biomedicas').delete().eq('id', id),
};

// =============================================================================
// BIOMÉDICO — INCIDENCIAS
// =============================================================================

export const dbIncidencias = {
  list: (tenantId: string) =>
    supabase
      .from('incidencias_biomedicas')
      .select('*, equipo:equipos_biomedicos(codigo, nombre)')
      .eq('tenant_id', tenantId)
      .order('creado_en', { ascending: false }),

  insert: (data: object) =>
    supabase.from('incidencias_biomedicas').insert(data).select().single(),

  update: (id: string, data: object) =>
    supabase.from('incidencias_biomedicas').update(data).eq('id', id).select().single(),

  delete: (id: string) =>
    supabase.from('incidencias_biomedicas').delete().eq('id', id),
};

// =============================================================================
// BIOMÉDICO — DOCUMENTOS
// =============================================================================

export const dbDocumentosBiomedicos = {
  list: (tenantId: string) =>
    supabase
      .from('documentos_biomedicos')
      .select('*, equipo:equipos_biomedicos(codigo, nombre)')
      .eq('tenant_id', tenantId)
      .order('creado_en', { ascending: false }),

  insert: (data: object) =>
    supabase.from('documentos_biomedicos').insert(data).select().single(),

  delete: (id: string) =>
    supabase.from('documentos_biomedicos').delete().eq('id', id),
};

// =============================================================================
// PROVEEDORES — EVALUACIONES
// =============================================================================

export const dbEvaluaciones = {
  list: (tenantId: string) =>
    supabase
      .from('evaluaciones_proveedores')
      .select('*, proveedor:proveedores(codigo, razon_social)')
      .eq('tenant_id', tenantId)
      .order('creado_en', { ascending: false }),
  insert: (data: Omit<EvaluacionProveedor, 'id' | 'creado_en' | 'proveedor'>) =>
    supabase.from('evaluaciones_proveedores').insert(data).select().single(),
  update: (id: string, data: Partial<EvaluacionProveedor>) =>
    supabase.from('evaluaciones_proveedores').update(data).eq('id', id).select().single(),
  delete: (id: string) =>
    supabase.from('evaluaciones_proveedores').delete().eq('id', id),
};

// =============================================================================
// PROVEEDORES — CONTRATOS
// =============================================================================

export const dbContratos = {
  list: (tenantId: string) =>
    supabase
      .from('contratos_proveedores')
      .select('*, proveedor:proveedores(codigo, razon_social)')
      .eq('tenant_id', tenantId)
      .order('creado_en', { ascending: false }),
  insert: (data: Omit<ContratoProveedor, 'id' | 'creado_en' | 'proveedor'>) =>
    supabase.from('contratos_proveedores').insert(data).select().single(),
  update: (id: string, data: Partial<ContratoProveedor>) =>
    supabase.from('contratos_proveedores').update(data).eq('id', id).select().single(),
  delete: (id: string) =>
    supabase.from('contratos_proveedores').delete().eq('id', id),
};

// =============================================================================
// PROVEEDORES — TALLERES
// =============================================================================

export const dbTalleres = {
  list: (tenantId: string) =>
    supabase
      .from('talleres')
      .select('*, proveedor:proveedores(codigo, razon_social)')
      .eq('tenant_id', tenantId)
      .order('creado_en', { ascending: false }),
  insert: (data: Omit<TallerDB, 'id' | 'creado_en' | 'proveedor'>) =>
    supabase.from('talleres').insert(data).select().single(),
  update: (id: string, data: Partial<TallerDB>) =>
    supabase.from('talleres').update(data).eq('id', id).select().single(),
  delete: (id: string) =>
    supabase.from('talleres').delete().eq('id', id),
};

// =============================================================================
// RBAC — ROLES
// =============================================================================

export const dbRoles = {
  list: (tenantId: string) =>
    supabase
      .from('roles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('nombre'),

  listWithPermisos: (tenantId: string) =>
    supabase
      .from('roles')
      .select('*, roles_permisos(permiso_id, permisos(*))')
      .eq('tenant_id', tenantId),

  insert: (data: Omit<RolDB, 'id' | 'creado_en' | 'permisos'>) =>
    supabase.from('roles').insert(data).select().single(),

  update: (id: string, data: Partial<RolDB>) =>
    supabase.from('roles').update(data).eq('id', id).select().single(),

  delete: (id: string) =>
    supabase.from('roles').delete().eq('id', id),
};

// =============================================================================
// RBAC — PERMISOS
// =============================================================================

export const dbPermisos = {
  listAll: () =>
    supabase.from('permisos').select('*').order('modulo').order('accion'),
};

// =============================================================================
// RBAC — ROLES_PERMISOS
// =============================================================================

export const dbRolesPermisos = {
  setForRol: async (rolId: string, permisoIds: string[]) => {
    await supabase.from('roles_permisos').delete().eq('rol_id', rolId);
    if (permisoIds.length === 0) return { error: null };
    return supabase.from('roles_permisos').insert(
      permisoIds.map(pid => ({ rol_id: rolId, permiso_id: pid }))
    );
  },
};

// =============================================================================
// RBAC — USUARIOS_TENANT
// =============================================================================

export const dbUsuariosTenant = {
  list: (tenantId: string) =>
    supabase
      .from('usuarios_tenant')
      .select('*, usuarios_roles(rol_id, roles(*))')
      .eq('tenant_id', tenantId)
      .order('nombre'),

  upsert: (data: Omit<UsuarioTenantDB, 'id' | 'creado_en' | 'roles'>) =>
    supabase.from('usuarios_tenant').upsert(data, { onConflict: 'tenant_id,user_id' }).select().single(),

  updateEstado: (id: string, estado: string) =>
    supabase.from('usuarios_tenant').update({ estado }).eq('id', id),
};

// =============================================================================
// RBAC — USUARIOS_ROLES
// =============================================================================

export const dbUsuariosRoles = {
  assign: (tenantId: string, userId: string, rolId: string, asignadoPor: string) =>
    supabase.from('usuarios_roles').upsert(
      { tenant_id: tenantId, user_id: userId, rol_id: rolId, asignado_por: asignadoPor },
      { onConflict: 'tenant_id,user_id,rol_id' }
    ),

  remove: (tenantId: string, userId: string, rolId: string) =>
    supabase.from('usuarios_roles').delete()
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('rol_id', rolId),
};

// =============================================================================
// INVENTARIO — ARTÍCULOS
// =============================================================================

export const dbArticulos = {
  list: (tenantId: string) =>
    supabase.from('articulos').select('*, categoria:categorias_inventario(nombre, codigo)')
      .eq('tenant_id', tenantId).order('nombre'),
  insert: (data: Omit<ArticuloDB, 'id' | 'creado_en' | 'categoria'>) =>
    supabase.from('articulos').insert(data).select().single(),
  update: (id: string, data: Partial<ArticuloDB>) =>
    supabase.from('articulos').update(data).eq('id', id).select().single(),
  delete: (id: string) => supabase.from('articulos').delete().eq('id', id),
};

// =============================================================================
// INVENTARIO — ALMACENES
// =============================================================================

export const dbAlmacenes = {
  list: (tenantId: string) =>
    supabase.from('almacenes').select('*').eq('tenant_id', tenantId).order('nombre'),
  insert: (data: Omit<AlmacenDB, 'id' | 'creado_en'>) =>
    supabase.from('almacenes').insert(data).select().single(),
  update: (id: string, data: Partial<AlmacenDB>) =>
    supabase.from('almacenes').update(data).eq('id', id).select().single(),
};

// =============================================================================
// INVENTARIO — CATEGORÍAS
// =============================================================================

export const dbCategoriasInventario = {
  list: (tenantId: string) =>
    supabase.from('categorias_inventario').select('*').eq('tenant_id', tenantId).order('nombre'),
  insert: (data: Omit<CategoriaInventarioDB, 'id' | 'creado_en'>) =>
    supabase.from('categorias_inventario').insert(data).select().single(),
};

// =============================================================================
// INVENTARIO — MOVIMIENTOS
// =============================================================================

export const dbMovimientos = {
  list: (tenantId: string, limit = 200) =>
    supabase.from('movimientos_inventario')
      .select('*, articulo:articulos(codigo, nombre, unidad_medida), almacen:almacenes(nombre, codigo)')
      .eq('tenant_id', tenantId).order('fecha', { ascending: false }).limit(limit),
  listByArticulo: (tenantId: string, articuloId: string) =>
    supabase.from('movimientos_inventario')
      .select('*, almacen:almacenes(nombre, codigo)')
      .eq('tenant_id', tenantId).eq('articulo_id', articuloId)
      .order('fecha', { ascending: false }),
  insert: (data: Omit<MovimientoInventarioDB, 'id' | 'creado_en' | 'articulo' | 'almacen'>) =>
    supabase.from('movimientos_inventario').insert(data).select().single(),
};

// =============================================================================
// COMPRAS — RECEPCIONES
// =============================================================================

export const dbRecepciones = {
  list: () =>
    supabase
      .from("recepciones")
      .select("*, orden:ordenes_compra(numero, tipo), proveedor:proveedores(razon_social), items:recepcion_items(*)")
      .order("creado_en", { ascending: false }),

  getByNumero: (numero: string) =>
    supabase
      .from("recepciones")
      .select("*, orden:ordenes_compra(*), proveedor:proveedores(*), items:recepcion_items(*)")
      .eq("numero", numero)
      .single(),

  create: (data: object) =>
    supabase.from("recepciones").insert(data).select().single(),

  update: (id: string, data: object) =>
    supabase.from("recepciones").update(data).eq("id", id).select().single(),
};

// =============================================================================
// CRM — CLIENTES
// =============================================================================

export const dbClientes = {
  list: (tenantId: string) =>
    supabase.from('clientes').select('*').eq('tenant_id', tenantId).order('razon_social'),
  insert: (data: Omit<ClienteDB, 'id' | 'creado_en'>) =>
    supabase.from('clientes').insert(data).select().single(),
  update: (id: string, data: Partial<ClienteDB>) =>
    supabase.from('clientes').update(data).eq('id', id).select().single(),
};

// =============================================================================
// CRM — OPORTUNIDADES
// =============================================================================

export const dbOportunidades = {
  list: (tenantId: string) =>
    supabase.from('oportunidades')
      .select('*, cliente:clientes(codigo, razon_social)')
      .eq('tenant_id', tenantId).order('creado_en', { ascending: false }),
  insert: (data: Omit<OportunidadDB, 'id' | 'creado_en' | 'cliente'>) =>
    supabase.from('oportunidades').insert(data).select().single(),
  update: (id: string, data: Partial<OportunidadDB>) =>
    supabase.from('oportunidades').update(data).eq('id', id).select().single(),
};

// =============================================================================
// CRM — ACTIVIDADES
// =============================================================================

export const dbActividadesCRM = {
  list: (tenantId: string) =>
    supabase.from('actividades_crm')
      .select('*, cliente:clientes(codigo, razon_social), oportunidad:oportunidades(codigo, titulo)')
      .eq('tenant_id', tenantId).order('fecha_programada', { ascending: false }),
  insert: (data: Omit<ActividadCRMDB, 'id' | 'creado_en' | 'cliente' | 'oportunidad'>) =>
    supabase.from('actividades_crm').insert(data).select().single(),
  update: (id: string, data: Partial<ActividadCRMDB>) =>
    supabase.from('actividades_crm').update(data).eq('id', id).select().single(),
};

// =============================================================================
// FINANZAS — TRANSACCIONES
// =============================================================================

export const dbTransacciones = {
  list: (tenantId: string) =>
    supabase.from('transacciones').select('*').eq('tenant_id', tenantId)
      .order('fecha', { ascending: false }),
  insert: (data: Omit<TransaccionDB, 'id' | 'creado_en'>) =>
    supabase.from('transacciones').insert(data).select().single(),
  update: (id: string, data: Partial<TransaccionDB>) =>
    supabase.from('transacciones').update(data).eq('id', id).select().single(),
};

// =============================================================================
// FINANZAS — PRESUPUESTOS
// =============================================================================

export const dbPresupuestos = {
  list: (tenantId: string) =>
    supabase.from('presupuestos').select('*, lineas:presupuesto_lineas(*)')
      .eq('tenant_id', tenantId).order('periodo', { ascending: false }),
  insert: (data: Omit<PresupuestoDB, 'id' | 'creado_en' | 'lineas'>) =>
    supabase.from('presupuestos').insert(data).select().single(),
  update: (id: string, data: Partial<PresupuestoDB>) =>
    supabase.from('presupuestos').update(data).eq('id', id).select().single(),
  insertLinea: (data: { tenant_id: string; presupuesto_id: string; categoria: string; subcategoria?: string; monto_presupuestado: number; monto_ejecutado?: number }) =>
    supabase.from('presupuesto_lineas').insert(data).select().single(),
  updateLinea: (id: string, data: { categoria?: string; subcategoria?: string; monto_presupuestado?: number; monto_ejecutado?: number }) =>
    supabase.from('presupuesto_lineas').update(data).eq('id', id).select().single(),
  deleteLinea: (id: string) =>
    supabase.from('presupuesto_lineas').delete().eq('id', id),
};

// =============================================================================
// FINANZAS — CAJAS CHICAS
// =============================================================================

export const dbCajasChicas = {
  list: (tenantId: string) =>
    supabase.from('cajas_chicas').select('*').eq('tenant_id', tenantId).order('nombre'),
  insert: (data: Omit<CajaChicaDB, 'id' | 'creado_en'>) =>
    supabase.from('cajas_chicas').insert(data).select().single(),
  update: (id: string, data: Partial<CajaChicaDB>) =>
    supabase.from('cajas_chicas').update(data).eq('id', id).select().single(),
};

// =============================================================================
// FINANZAS — GASTOS CAJA CHICA
// =============================================================================

export const dbGastosCajaChica = {
  list: (tenantId: string) =>
    supabase.from('gastos_caja_chica')
      .select('*, caja:cajas_chicas(nombre, codigo)')
      .eq('tenant_id', tenantId).order('fecha', { ascending: false }),
  insert: (data: Omit<GastoCajaChicaDB, 'id' | 'creado_en' | 'caja'>) =>
    supabase.from('gastos_caja_chica').insert(data).select().single(),
  update: (id: string, data: Partial<GastoCajaChicaDB>) =>
    supabase.from('gastos_caja_chica').update(data).eq('id', id).select().single(),
};

// =============================================================================
// PROYECTOS
// =============================================================================

export const dbProyectos = {
  list: (tenantId: string) =>
    supabase.from('proyectos')
      .select('*, fases:fases_proyecto(*), tareas:tareas_proyecto(*), miembros:miembros_proyecto(*)')
      .eq('tenant_id', tenantId)
      .order('creado_en', { ascending: false }),
  getWithDetails: (id: string) =>
    supabase.from('proyectos')
      .select('*, fases:fases_proyecto(*), tareas:tareas_proyecto(*), miembros:miembros_proyecto(*)')
      .eq('id', id).single(),
  insert: (data: Omit<ProyectoDB, 'id' | 'creado_en' | 'fases' | 'tareas' | 'miembros'>) =>
    supabase.from('proyectos').insert(data).select().single(),
  update: (id: string, data: Partial<Omit<ProyectoDB, 'fases' | 'tareas' | 'miembros'>>) =>
    supabase.from('proyectos').update(data).eq('id', id).select().single(),
};

export const dbFasesProyecto = {
  insert: (data: Omit<FaseProyectoDB, 'id'>) =>
    supabase.from('fases_proyecto').insert(data).select().single(),
  update: (id: string, data: Partial<FaseProyectoDB>) =>
    supabase.from('fases_proyecto').update(data).eq('id', id).select().single(),
  delete: (id: string) => supabase.from('fases_proyecto').delete().eq('id', id),
};

export const dbTareasProyecto = {
  listByProyecto: (proyectoId: string) =>
    supabase.from('tareas_proyecto').select('*').eq('proyecto_id', proyectoId).order('orden'),
  insert: (data: Omit<TareaProyectoDB, 'id' | 'creado_en'>) =>
    supabase.from('tareas_proyecto').insert(data).select().single(),
  update: (id: string, data: Partial<TareaProyectoDB>) =>
    supabase.from('tareas_proyecto').update(data).eq('id', id).select().single(),
  delete: (id: string) => supabase.from('tareas_proyecto').delete().eq('id', id),
};

export const dbMiembrosProyecto = {
  insert: (data: Omit<MiembroProyectoDB, 'id'>) =>
    supabase.from('miembros_proyecto').insert(data).select().single(),
  update: (id: string, data: Partial<MiembroProyectoDB>) =>
    supabase.from('miembros_proyecto').update(data).eq('id', id).select().single(),
  delete: (id: string) => supabase.from('miembros_proyecto').delete().eq('id', id),
};

// =============================================================================
// CENTROS DE COSTO
// =============================================================================

export const dbCentrosCosto = {
  /** Lista centros de costo activos del tenant */
  list: () => supabase.from('centros_costo').select('*').eq('activo', true).order('codigo'),
  /** Lista todos (incluyendo inactivos) */
  listAll: () => supabase.from('centros_costo').select('*').order('codigo'),
  /** Obtiene un centro de costo por UUID */
  getById: (id: string) => supabase.from('centros_costo').select('*').eq('id', id).single(),
  /** Crea un centro de costo */
  create: (data: Omit<CentroCostoDB, 'id' | 'creado_en'>) =>
    supabase.from('centros_costo').insert(data).select().single(),
  /** Actualiza un centro de costo */
  update: (id: string, data: Partial<Omit<CentroCostoDB, 'id' | 'tenant_id' | 'creado_en'>>) =>
    supabase.from('centros_costo').update(data).eq('id', id).select().single(),
};

// =============================================================================
// VALORIZACIONES (hitos de facturación por proyecto)
// =============================================================================

export const dbValorizaciones = {
  /** Lista valorizaciones de un proyecto */
  listByProyecto: (proyectoId: string) =>
    supabase.from('valorizaciones').select('*').eq('proyecto_id', proyectoId).order('numero'),
  /** Crea una valorización */
  insert: (data: Omit<ValorizacionDB, 'id' | 'creado_en'>) =>
    supabase.from('valorizaciones').insert(data).select().single(),
  /** Actualiza una valorización */
  update: (id: string, data: Partial<Omit<ValorizacionDB, 'id' | 'tenant_id' | 'creado_en'>>) =>
    supabase.from('valorizaciones').update(data).eq('id', id).select().single(),
  /** Elimina una valorización */
  delete: (id: string) =>
    supabase.from('valorizaciones').delete().eq('id', id),
};


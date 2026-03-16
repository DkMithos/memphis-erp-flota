/**
 * KESA ERP – Helpers de acceso a Supabase por módulo
 * Cada función devuelve un query builder pre-filtrado por tenant.
 * Usar estos helpers garantiza que nunca se acceda a datos de otro tenant.
 */

import { supabase } from "./client";

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

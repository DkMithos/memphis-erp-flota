/**
 * STORE DE INVENTARIO
 * Conectado a Supabase — tablas articulos, almacenes, movimientos_inventario
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { dbArticulos, dbAlmacenes, dbCategoriasInventario, dbMovimientos } from '../supabase/helpers';
import { logAudit } from '../shared/audit';
import { useAuth } from '../../auth/AuthProvider';
import type { ArticuloDB, AlmacenDB, CategoriaInventarioDB, MovimientoInventarioDB } from '../supabase/types';

// ============================================================================
// TIPOS FRONTEND
// ============================================================================

export type EstadoStock = 'normal' | 'bajo' | 'critico' | 'sobrestock';

export interface Articulo {
  _dbId: string;
  id: string;              // ART-NNNN
  categoriaId?: string;    // display
  categoriaDbId?: string;  // UUID
  categoriaNombre?: string;
  nombre: string;
  descripcion?: string;
  unidadMedida: ArticuloDB['unidad_medida'];
  tipo: ArticuloDB['tipo'];
  stockActual: number;
  stockMinimo: number;
  stockMaximo?: number;
  precioUnitario?: number;
  moneda: string;
  marca?: string;
  modelo?: string;
  codigoFabricante?: string;
  activo: boolean;
  creadoEn: string;
  // computed
  estadoStock: EstadoStock;
  valorTotal?: number;
}

export interface Almacen {
  _dbId: string;
  id: string;              // ALM-NNN
  nombre: string;
  tipo: AlmacenDB['tipo'];
  ubicacion?: string;
  responsable?: string;
  estado: 'activo' | 'inactivo';
}

export interface CategoriaInventario {
  _dbId: string;
  id: string;
  nombre: string;
  descripcion?: string;
  codigo?: string;
}

export interface Movimiento {
  _dbId: string;
  id: string;              // MOV-YYYY-NNNN
  articuloId: string;
  articuloNombre: string;
  articuloDbId: string;
  almacenId: string;
  almacenNombre: string;
  almacenDbId: string;
  tipo: MovimientoInventarioDB['tipo'];
  motivo: MovimientoInventarioDB['motivo'];
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  precioUnitario?: number;
  costoTotal?: number;
  referenciaId?: string;
  referenciaTipo?: string;
  notas?: string;
  realizadoPor?: string;
  fecha: string;
}

export interface NuevoMovimientoInput {
  articuloId: string;      // display code
  articuloDbId: string;    // UUID
  almacenId: string;
  almacenDbId: string;
  tipo: Movimiento['tipo'];
  motivo: Movimiento['motivo'];
  cantidad: number;
  precioUnitario?: number;
  notas?: string;
  referenciaId?: string;
  referenciaTipo?: string;
}

interface InventarioContextValue {
  articulos: Articulo[];
  almacenes: Almacen[];
  movimientos: Movimiento[];
  categorias: CategoriaInventario[];
  loading: boolean;
  // Artículos
  crearArticulo: (data: Omit<Articulo, '_dbId' | 'id' | 'estadoStock' | 'valorTotal' | 'creadoEn'>) => Promise<Articulo>;
  actualizarArticulo: (dbId: string, data: Partial<Omit<Articulo, '_dbId' | 'id' | 'estadoStock' | 'valorTotal' | 'creadoEn'>>) => Promise<{ exito: boolean }>;
  // Almacenes
  crearAlmacen: (data: Omit<Almacen, '_dbId' | 'id'>) => Promise<Almacen>;
  actualizarAlmacen: (dbId: string, data: Partial<Omit<Almacen, '_dbId' | 'id'>>) => Promise<{ exito: boolean }>;
  // Movimientos
  registrarMovimiento: (input: NuevoMovimientoInput) => Promise<Movimiento>;
  cargarKardex: (articuloDbId: string) => Promise<Movimiento[]>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const InventarioContext = createContext<InventarioContextValue | undefined>(undefined);

// ============================================================================
// HELPERS
// ============================================================================

function calcularEstadoStock(stockActual: number, stockMinimo: number, stockMaximo?: number | null): EstadoStock {
  if (stockActual <= 0) return 'critico';
  if (stockActual <= stockMinimo) return 'bajo';
  if (stockMaximo != null && stockActual > stockMaximo) return 'sobrestock';
  return 'normal';
}

function mapArticuloFromDB(row: ArticuloDB): Articulo {
  const cat = row.categoria as { nombre: string; codigo?: string | null } | null;
  const estadoStock = calcularEstadoStock(row.stock_actual, row.stock_minimo, row.stock_maximo);
  return {
    _dbId: row.id,
    id: row.codigo,
    categoriaDbId: row.categoria_id ?? undefined,
    categoriaNombre: cat?.nombre ?? undefined,
    nombre: row.nombre,
    descripcion: row.descripcion ?? undefined,
    unidadMedida: row.unidad_medida,
    tipo: row.tipo,
    stockActual: Number(row.stock_actual),
    stockMinimo: Number(row.stock_minimo),
    stockMaximo: row.stock_maximo != null ? Number(row.stock_maximo) : undefined,
    precioUnitario: row.precio_unitario != null ? Number(row.precio_unitario) : undefined,
    moneda: row.moneda,
    marca: row.marca ?? undefined,
    modelo: row.modelo ?? undefined,
    codigoFabricante: row.codigo_fabricante ?? undefined,
    activo: row.activo,
    creadoEn: row.creado_en,
    estadoStock,
    valorTotal: row.precio_unitario != null ? Number(row.stock_actual) * Number(row.precio_unitario) : undefined,
  };
}

function mapAlmacenFromDB(row: AlmacenDB): Almacen {
  return {
    _dbId: row.id,
    id: row.codigo,
    nombre: row.nombre,
    tipo: row.tipo,
    ubicacion: row.ubicacion ?? undefined,
    responsable: row.responsable ?? undefined,
    estado: row.estado,
  };
}

function mapCategoriaFromDB(row: CategoriaInventarioDB): CategoriaInventario {
  return {
    _dbId: row.id,
    id: row.codigo ?? row.id,
    nombre: row.nombre,
    descripcion: row.descripcion ?? undefined,
    codigo: row.codigo ?? undefined,
  };
}

function mapMovimientoFromDB(row: MovimientoInventarioDB): Movimiento {
  const art = row.articulo as { codigo: string; nombre: string; unidad_medida: string } | null;
  const alm = row.almacen as { nombre: string; codigo: string } | null;
  return {
    _dbId: row.id,
    id: row.numero,
    articuloId: art?.codigo ?? '',
    articuloNombre: art?.nombre ?? '',
    articuloDbId: row.articulo_id,
    almacenId: alm?.codigo ?? '',
    almacenNombre: alm?.nombre ?? '',
    almacenDbId: row.almacen_id,
    tipo: row.tipo,
    motivo: row.motivo,
    cantidad: Number(row.cantidad),
    stockAnterior: Number(row.stock_anterior),
    stockNuevo: Number(row.stock_nuevo),
    precioUnitario: row.precio_unitario != null ? Number(row.precio_unitario) : undefined,
    costoTotal: row.costo_total != null ? Number(row.costo_total) : undefined,
    referenciaId: row.referencia_id ?? undefined,
    referenciaTipo: row.referencia_tipo ?? undefined,
    notas: row.notas ?? undefined,
    realizadoPor: row.realizado_por ?? undefined,
    fecha: row.fecha,
  };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function InventarioProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, user } = useAuth();
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [categorias, setCategorias] = useState<CategoriaInventario[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [artRes, almRes, catRes, movRes] = await Promise.all([
        dbArticulos.list(tenantId),
        dbAlmacenes.list(tenantId),
        dbCategoriasInventario.list(tenantId),
        dbMovimientos.list(tenantId),
      ]);
      if (artRes.data) setArticulos((artRes.data as ArticuloDB[]).map(mapArticuloFromDB));
      if (almRes.data) setAlmacenes((almRes.data as AlmacenDB[]).map(mapAlmacenFromDB));
      if (catRes.data) setCategorias((catRes.data as CategoriaInventarioDB[]).map(mapCategoriaFromDB));
      if (movRes.data) setMovimientos((movRes.data as MovimientoInventarioDB[]).map(mapMovimientoFromDB));
    } catch (err) {
      console.error('[inventario] error al cargar datos:', err);
    } finally {
      setLoading(false); // garantizar salida del estado de carga aunque falle la red
    }
  }, [tenantId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // --------------------------------------------------------------------------
  // ARTÍCULOS
  // --------------------------------------------------------------------------

  const crearArticulo = useCallback(async (
    data: Omit<Articulo, '_dbId' | 'id' | 'estadoStock' | 'valorTotal' | 'creadoEn'>
  ): Promise<Articulo> => {
    if (!tenantId || !user) throw new Error('Sin sesión activa');

    const numeros = articulos.map(a => {
      const m = a.id.match(/^ART-(\d{4})$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const siguiente = (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;
    const codigo = `ART-${siguiente.toString().padStart(4, '0')}`;

    const payload: Omit<ArticuloDB, 'id' | 'creado_en' | 'categoria'> = {
      tenant_id: tenantId,
      categoria_id: data.categoriaDbId ?? null,
      codigo,
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      unidad_medida: data.unidadMedida,
      tipo: data.tipo,
      stock_actual: data.stockActual,
      stock_minimo: data.stockMinimo,
      stock_maximo: data.stockMaximo ?? null,
      precio_unitario: data.precioUnitario ?? null,
      moneda: data.moneda,
      marca: data.marca ?? null,
      modelo: data.modelo ?? null,
      codigo_fabricante: data.codigoFabricante ?? null,
      imagen_url: null,
      activo: data.activo,
      creado_por: user.id,
      modificado_por: null,
      modificado_en: null,
    };

    const { data: dbData, error } = await dbArticulos.insert(payload);
    if (error) throw new Error(error.message);

    const nuevo = mapArticuloFromDB({
      ...(dbData as ArticuloDB),
      categoria: data.categoriaDbId ? { nombre: data.categoriaNombre ?? '', codigo: null } : null,
    });
    setArticulos(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    logAudit({ tenantId: tenantId!, usuarioEmail: user.email, accion: 'crear', entidadTipo: 'articulo', entidadId: nuevo.id, entidadLabel: nuevo.nombre });
    return nuevo;
  }, [articulos, tenantId, user]);

  const actualizarArticulo = useCallback(async (
    dbId: string,
    data: Partial<Omit<Articulo, '_dbId' | 'id' | 'estadoStock' | 'valorTotal' | 'creadoEn'>>
  ): Promise<{ exito: boolean }> => {
    if (!user) return { exito: false };

    const payload: Partial<ArticuloDB> = {
      modificado_por: user.id,
      modificado_en: new Date().toISOString(),
    };
    if (data.nombre !== undefined) payload.nombre = data.nombre;
    if (data.descripcion !== undefined) payload.descripcion = data.descripcion ?? null;
    if (data.categoriaDbId !== undefined) payload.categoria_id = data.categoriaDbId ?? null;
    if (data.unidadMedida !== undefined) payload.unidad_medida = data.unidadMedida;
    if (data.tipo !== undefined) payload.tipo = data.tipo;
    if (data.stockActual !== undefined) payload.stock_actual = data.stockActual;
    if (data.stockMinimo !== undefined) payload.stock_minimo = data.stockMinimo;
    if (data.stockMaximo !== undefined) payload.stock_maximo = data.stockMaximo ?? null;
    if (data.precioUnitario !== undefined) payload.precio_unitario = data.precioUnitario ?? null;
    if (data.moneda !== undefined) payload.moneda = data.moneda;
    if (data.marca !== undefined) payload.marca = data.marca ?? null;
    if (data.modelo !== undefined) payload.modelo = data.modelo ?? null;
    if (data.codigoFabricante !== undefined) payload.codigo_fabricante = data.codigoFabricante ?? null;
    if (data.activo !== undefined) payload.activo = data.activo;

    const { error } = await dbArticulos.update(dbId, payload);
    if (error) return { exito: false };

    const artActual = articulos.find(a => a._dbId === dbId);
    setArticulos(prev => prev.map(a => {
      if (a._dbId !== dbId) return a;
      const updated = { ...a, ...data };
      return {
        ...updated,
        estadoStock: calcularEstadoStock(updated.stockActual, updated.stockMinimo, updated.stockMaximo),
        valorTotal: updated.precioUnitario != null ? updated.stockActual * updated.precioUnitario : undefined,
      };
    }));
    if (artActual && tenantId) logAudit({ tenantId, usuarioEmail: user.email, accion: 'editar', entidadTipo: 'articulo', entidadId: artActual.id, entidadLabel: artActual.nombre });
    return { exito: true };
  }, [user, tenantId, articulos]);

  // --------------------------------------------------------------------------
  // ALMACENES
  // --------------------------------------------------------------------------

  const crearAlmacen = useCallback(async (
    data: Omit<Almacen, '_dbId' | 'id'>
  ): Promise<Almacen> => {
    if (!tenantId || !user) throw new Error('Sin sesión activa');

    const numeros = almacenes.map(a => {
      const m = a.id.match(/^ALM-(\d{3})$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const siguiente = (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;
    const codigo = `ALM-${siguiente.toString().padStart(3, '0')}`;

    const payload: Omit<AlmacenDB, 'id' | 'creado_en'> = {
      tenant_id: tenantId,
      nombre: data.nombre,
      codigo,
      tipo: data.tipo,
      ubicacion: data.ubicacion ?? null,
      responsable: data.responsable ?? null,
      estado: data.estado,
    };

    const { data: dbData, error } = await dbAlmacenes.insert(payload);
    if (error) throw new Error(error.message);

    const nuevo = mapAlmacenFromDB(dbData as AlmacenDB);
    setAlmacenes(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return nuevo;
  }, [almacenes, tenantId, user]);

  const actualizarAlmacen = useCallback(async (
    dbId: string,
    data: Partial<Omit<Almacen, '_dbId' | 'id'>>
  ): Promise<{ exito: boolean }> => {
    if (!user) return { exito: false };

    const payload: Partial<AlmacenDB> = {};
    if (data.nombre !== undefined) payload.nombre = data.nombre;
    if (data.tipo !== undefined) payload.tipo = data.tipo;
    if (data.ubicacion !== undefined) payload.ubicacion = data.ubicacion ?? null;
    if (data.responsable !== undefined) payload.responsable = data.responsable ?? null;
    if (data.estado !== undefined) payload.estado = data.estado;

    const { error } = await dbAlmacenes.update(dbId, payload);
    if (error) return { exito: false };

    setAlmacenes(prev => prev.map(a => a._dbId === dbId ? { ...a, ...data } : a));
    return { exito: true };
  }, [user]);

  // --------------------------------------------------------------------------
  // MOVIMIENTOS
  // --------------------------------------------------------------------------

  const registrarMovimiento = useCallback(async (input: NuevoMovimientoInput): Promise<Movimiento> => {
    if (!tenantId || !user) throw new Error('Sin sesión activa');

    const articulo = articulos.find(a => a._dbId === input.articuloDbId);
    if (!articulo) throw new Error('Artículo no encontrado');

    const year = new Date().getFullYear();
    const numeros = movimientos.map(m => {
      const match = m.id.match(/^MOV-\d{4}-(\d{4})$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const siguiente = (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;
    const numero = `MOV-${year}-${siguiente.toString().padStart(4, '0')}`;

    const stockAnterior = articulo.stockActual;
    let stockNuevo: number;
    if (input.tipo === 'entrada') {
      stockNuevo = stockAnterior + input.cantidad;
    } else if (input.tipo === 'salida') {
      stockNuevo = stockAnterior - input.cantidad;
    } else if (input.tipo === 'ajuste') {
      if (input.motivo === 'ajuste_positivo') {
        stockNuevo = stockAnterior + input.cantidad;
      } else {
        stockNuevo = stockAnterior - input.cantidad;
      }
    } else {
      stockNuevo = stockAnterior;
    }

    // Prevenir stock negativo
    if (stockNuevo < 0) {
      throw new Error(`Stock insuficiente para ${articulo.nombre}. Stock actual: ${stockAnterior}, cantidad solicitada: ${input.cantidad}`);
    }

    const costoTotal = input.precioUnitario != null ? input.precioUnitario * input.cantidad : null;

    const payload: Omit<MovimientoInventarioDB, 'id' | 'creado_en' | 'articulo' | 'almacen'> = {
      tenant_id: tenantId,
      articulo_id: input.articuloDbId,
      almacen_id: input.almacenDbId,
      numero,
      tipo: input.tipo,
      motivo: input.motivo,
      cantidad: input.cantidad,
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo,
      precio_unitario: input.precioUnitario ?? null,
      costo_total: costoTotal,
      referencia_id: input.referenciaId ?? null,
      referencia_tipo: input.referenciaTipo ?? null,
      notas: input.notas ?? null,
      realizado_por: user.id,
      fecha: new Date().toISOString(),
    };

    const { data: dbData, error } = await dbMovimientos.insert(payload);
    if (error) throw new Error(error.message);

    const almacen = almacenes.find(a => a._dbId === input.almacenDbId);
    const nuevo = mapMovimientoFromDB({
      ...(dbData as MovimientoInventarioDB),
      articulo: { codigo: articulo.id, nombre: articulo.nombre, unidad_medida: articulo.unidadMedida },
      almacen: { nombre: almacen?.nombre ?? '', codigo: almacen?.id ?? '' },
    });
    setMovimientos(prev => [nuevo, ...prev]);

    // Update stock in articulos state
    setArticulos(prev => prev.map(a => {
      if (a._dbId !== input.articuloDbId) return a;
      const updated = { ...a, stockActual: stockNuevo };
      return {
        ...updated,
        estadoStock: calcularEstadoStock(stockNuevo, updated.stockMinimo, updated.stockMaximo),
        valorTotal: updated.precioUnitario != null ? stockNuevo * updated.precioUnitario : undefined,
      };
    }));

    // Also update stock via DB for consistency
    await dbArticulos.update(input.articuloDbId, { stock_actual: stockNuevo });

    return nuevo;
  }, [articulos, almacenes, movimientos, tenantId, user]);

  const cargarKardex = useCallback(async (articuloDbId: string): Promise<Movimiento[]> => {
    if (!tenantId) return [];
    const { data, error } = await dbMovimientos.listByArticulo(tenantId, articuloDbId);
    if (error || !data) return [];
    return (data as MovimientoInventarioDB[]).map(row => {
      const alm = row.almacen as { nombre: string; codigo: string } | null;
      const articulo = articulos.find(a => a._dbId === articuloDbId);
      return {
        _dbId: row.id,
        id: row.numero,
        articuloId: articulo?.id ?? '',
        articuloNombre: articulo?.nombre ?? '',
        articuloDbId,
        almacenId: alm?.codigo ?? '',
        almacenNombre: alm?.nombre ?? '',
        almacenDbId: row.almacen_id,
        tipo: row.tipo,
        motivo: row.motivo,
        cantidad: Number(row.cantidad),
        stockAnterior: Number(row.stock_anterior),
        stockNuevo: Number(row.stock_nuevo),
        precioUnitario: row.precio_unitario != null ? Number(row.precio_unitario) : undefined,
        costoTotal: row.costo_total != null ? Number(row.costo_total) : undefined,
        referenciaId: row.referencia_id ?? undefined,
        referenciaTipo: row.referencia_tipo ?? undefined,
        notas: row.notas ?? undefined,
        realizadoPor: row.realizado_por ?? undefined,
        fecha: row.fecha,
      };
    });
  }, [tenantId, articulos]);

  const value: InventarioContextValue = {
    articulos,
    almacenes,
    movimientos,
    categorias,
    loading,
    crearArticulo,
    actualizarArticulo,
    crearAlmacen,
    actualizarAlmacen,
    registrarMovimiento,
    cargarKardex,
  };

  return (
    <InventarioContext.Provider value={value}>
      {children}
    </InventarioContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useInventarioStore() {
  const context = useContext(InventarioContext);
  if (!context) throw new Error('useInventarioStore debe usarse dentro de InventarioProvider');
  return context;
}

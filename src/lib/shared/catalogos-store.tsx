/**
 * CATÁLOGOS CONFIGURABLES — Memphis ERP
 * Gestiona listas desplegables que pueden administrarse desde el panel admin.
 * Tipos soportados: unidades de medida, condiciones de pago, formas de pago,
 * tipos de comprobante, regiones/zonas IGV, etc.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';

// ============================================================================
// TIPOS
// ============================================================================

export type TipoCatalogo =
  | 'unidad_medida'
  | 'condicion_pago'
  | 'forma_pago'
  | 'tipo_comprobante'
  | 'zona_igv'
  | 'banco'
  | 'moneda'
  // Catálogos operativos
  | 'tipo_vehiculo'
  | 'tipo_flota'
  | 'tipo_contrato_flota'
  | 'tipo_doc_vehiculo'
  | 'categoria_proveedor'
  | 'categoria_equipo_bio';

export interface ItemCatalogo {
  id: string;
  tipo: TipoCatalogo;
  key: string;
  label: string;
  descripcion?: string;
  activo: boolean;
  orden: number;
  esSistema: boolean; // items del sistema no se pueden eliminar
}

export const TIPO_CATALOGO_LABELS: Record<TipoCatalogo, string> = {
  unidad_medida:       'Unidades de Medida',
  condicion_pago:      'Condiciones de Pago',
  forma_pago:          'Formas de Pago',
  tipo_comprobante:    'Tipos de Comprobante',
  zona_igv:            'Zonas / IGV',
  banco:               'Bancos',
  moneda:              'Monedas',
  tipo_vehiculo:       'Tipos de Vehículo',
  tipo_flota:          'Tipos de Flota',
  tipo_contrato_flota: 'Tipos de Contrato Flota',
  tipo_doc_vehiculo:   'Tipos de Doc. Vehículo',
  categoria_proveedor: 'Categorías de Proveedor',
  categoria_equipo_bio:'Categorías Equipo Biomédico',
};

// ============================================================================
// DATOS POR DEFECTO (fallback si no hay DB)
// ============================================================================

const CATALOGOS_DEFAULT: ItemCatalogo[] = [
  // Unidades de medida
  { id: 'u1', tipo: 'unidad_medida', key: 'und', label: 'Unidad', activo: true, orden: 1, esSistema: true },
  { id: 'u2', tipo: 'unidad_medida', key: 'kg', label: 'Kilogramo (kg)', activo: true, orden: 2, esSistema: true },
  { id: 'u3', tipo: 'unidad_medida', key: 'gr', label: 'Gramo (gr)', activo: true, orden: 3, esSistema: true },
  { id: 'u4', tipo: 'unidad_medida', key: 'm', label: 'Metro (m)', activo: true, orden: 4, esSistema: true },
  { id: 'u5', tipo: 'unidad_medida', key: 'm2', label: 'Metro cuadrado (m²)', activo: true, orden: 5, esSistema: false },
  { id: 'u6', tipo: 'unidad_medida', key: 'l', label: 'Litro (L)', activo: true, orden: 6, esSistema: false },
  { id: 'u7', tipo: 'unidad_medida', key: 'gln', label: 'Galón', activo: true, orden: 7, esSistema: false },
  { id: 'u8', tipo: 'unidad_medida', key: 'caja', label: 'Caja', activo: true, orden: 8, esSistema: false },
  { id: 'u9', tipo: 'unidad_medida', key: 'paq', label: 'Paquete', activo: true, orden: 9, esSistema: false },
  { id: 'u10', tipo: 'unidad_medida', key: 'rollo', label: 'Rollo', activo: true, orden: 10, esSistema: false },
  { id: 'u11', tipo: 'unidad_medida', key: 'hr', label: 'Hora (hr)', activo: true, orden: 11, esSistema: true },
  { id: 'u12', tipo: 'unidad_medida', key: 'mes', label: 'Mes', activo: true, orden: 12, esSistema: false },
  { id: 'u13', tipo: 'unidad_medida', key: 'servicio', label: 'Servicio', activo: true, orden: 13, esSistema: true },
  // Condiciones de pago
  { id: 'c1', tipo: 'condicion_pago', key: 'contado', label: 'Al contado', activo: true, orden: 1, esSistema: true },
  { id: 'c2', tipo: 'condicion_pago', key: '15d', label: '15 días', activo: true, orden: 2, esSistema: false },
  { id: 'c3', tipo: 'condicion_pago', key: '30d', label: '30 días', activo: true, orden: 3, esSistema: true },
  { id: 'c4', tipo: 'condicion_pago', key: '45d', label: '45 días', activo: true, orden: 4, esSistema: false },
  { id: 'c5', tipo: 'condicion_pago', key: '60d', label: '60 días', activo: true, orden: 5, esSistema: false },
  { id: 'c6', tipo: 'condicion_pago', key: '90d', label: '90 días', activo: true, orden: 6, esSistema: false },
  { id: 'c7', tipo: 'condicion_pago', key: 'anticipo50', label: '50% anticipo / 50% entrega', activo: true, orden: 7, esSistema: false },
  // Formas de pago
  { id: 'f1', tipo: 'forma_pago', key: 'transferencia', label: 'Transferencia bancaria', activo: true, orden: 1, esSistema: true },
  { id: 'f2', tipo: 'forma_pago', key: 'cheque', label: 'Cheque', activo: true, orden: 2, esSistema: false },
  { id: 'f3', tipo: 'forma_pago', key: 'efectivo', label: 'Efectivo', activo: true, orden: 3, esSistema: true },
  { id: 'f4', tipo: 'forma_pago', key: 'deposito', label: 'Depósito en cuenta', activo: true, orden: 4, esSistema: false },
  { id: 'f5', tipo: 'forma_pago', key: 'detraccion', label: 'Cuenta de detracción', activo: true, orden: 5, esSistema: false },
  // Tipos de comprobante
  { id: 'tc1', tipo: 'tipo_comprobante', key: 'factura', label: 'Factura', activo: true, orden: 1, esSistema: true },
  { id: 'tc2', tipo: 'tipo_comprobante', key: 'boleta', label: 'Boleta de venta', activo: true, orden: 2, esSistema: true },
  { id: 'tc3', tipo: 'tipo_comprobante', key: 'recibo', label: 'Recibo por honorarios', activo: true, orden: 3, esSistema: true },
  { id: 'tc4', tipo: 'tipo_comprobante', key: 'nc', label: 'Nota de crédito', activo: true, orden: 4, esSistema: false },
  { id: 'tc5', tipo: 'tipo_comprobante', key: 'nd', label: 'Nota de débito', activo: true, orden: 5, esSistema: false },
  { id: 'tc6', tipo: 'tipo_comprobante', key: 'liquidacion', label: 'Liquidación de compra', activo: true, orden: 6, esSistema: false },
  // Zonas / IGV
  { id: 'z1', tipo: 'zona_igv', key: 'general', label: 'Régimen general (18%)', descripcion: 'IGV 18% aplicable en la mayoría de regiones', activo: true, orden: 1, esSistema: true },
  { id: 'z2', tipo: 'zona_igv', key: 'amazonia', label: 'Amazonía (0%)', descripcion: 'Loreto, Ucayali, San Martín, Madre de Dios — Ley 27037', activo: true, orden: 2, esSistema: true },
  { id: 'z3', tipo: 'zona_igv', key: 'selva', label: 'Selva alta (8%)', descripcion: 'Zonas de selva alta — tasa reducida', activo: true, orden: 3, esSistema: true },
  // Bancos
  { id: 'b1', tipo: 'banco', key: 'bcp', label: 'BCP', activo: true, orden: 1, esSistema: true },
  { id: 'b2', tipo: 'banco', key: 'bbva', label: 'BBVA', activo: true, orden: 2, esSistema: true },
  { id: 'b3', tipo: 'banco', key: 'scotiabank', label: 'Scotiabank', activo: true, orden: 3, esSistema: true },
  { id: 'b4', tipo: 'banco', key: 'interbank', label: 'Interbank', activo: true, orden: 4, esSistema: true },
  { id: 'b5', tipo: 'banco', key: 'banbif', label: 'BanBif', activo: true, orden: 5, esSistema: false },
  { id: 'b6', tipo: 'banco', key: 'pichincha', label: 'Banco Pichincha', activo: true, orden: 6, esSistema: false },
  { id: 'b7', tipo: 'banco', key: 'mibanco', label: 'Mibanco', activo: true, orden: 7, esSistema: false },
  { id: 'b8', tipo: 'banco', key: 'nacion', label: 'Banco de la Nación', activo: true, orden: 8, esSistema: true },
  // Monedas
  { id: 'm1', tipo: 'moneda', key: 'PEN', label: 'Soles (PEN)', activo: true, orden: 1, esSistema: true },
  { id: 'm2', tipo: 'moneda', key: 'USD', label: 'Dólares (USD)', activo: true, orden: 2, esSistema: true },
  { id: 'm3', tipo: 'moneda', key: 'EUR', label: 'Euros (EUR)', activo: false, orden: 3, esSistema: false },
  // Tipos de Vehículo
  { id: 'tv1', tipo: 'tipo_vehiculo', key: 'ambulancia', label: 'Ambulancia', activo: true, orden: 1, esSistema: true },
  { id: 'tv2', tipo: 'tipo_vehiculo', key: 'camioneta', label: 'Camioneta', activo: true, orden: 2, esSistema: true },
  { id: 'tv3', tipo: 'tipo_vehiculo', key: 'motocicleta', label: 'Motocicleta', activo: true, orden: 3, esSistema: true },
  { id: 'tv4', tipo: 'tipo_vehiculo', key: 'van', label: 'Van', activo: true, orden: 4, esSistema: true },
  { id: 'tv5', tipo: 'tipo_vehiculo', key: 'auto', label: 'Auto', activo: true, orden: 5, esSistema: true },
  { id: 'tv6', tipo: 'tipo_vehiculo', key: 'patrullero', label: 'Patrullero', activo: true, orden: 6, esSistema: false },
  { id: 'tv7', tipo: 'tipo_vehiculo', key: 'hidro_ambulancia', label: 'Hidro Ambulancia', activo: true, orden: 7, esSistema: false },
  { id: 'tv8', tipo: 'tipo_vehiculo', key: 'hidro_patrulla', label: 'Hidro Patrulla', activo: true, orden: 8, esSistema: false },
  { id: 'tv9', tipo: 'tipo_vehiculo', key: 'camioneta_supervision', label: 'Camioneta de Supervisión', activo: true, orden: 9, esSistema: false },
  { id: 'tv10', tipo: 'tipo_vehiculo', key: 'otro', label: 'Otro', activo: true, orden: 10, esSistema: true },
  // Tipos de Flota (categoría de uso en proyecto)
  { id: 'tf1', tipo: 'tipo_flota', key: 'patrulleros', label: 'Patrulleros', descripcion: 'Vehículos de patrullaje', activo: true, orden: 1, esSistema: true },
  { id: 'tf2', tipo: 'tipo_flota', key: 'ambulancias', label: 'Ambulancias', descripcion: 'Ambulancias terrestres', activo: true, orden: 2, esSistema: true },
  { id: 'tf3', tipo: 'tipo_flota', key: 'hidro_ambulancias', label: 'Hidro Ambulancias', descripcion: 'Ambulancias acuáticas', activo: true, orden: 3, esSistema: false },
  { id: 'tf4', tipo: 'tipo_flota', key: 'hidro_patrullas', label: 'Hidro Patrullas', descripcion: 'Patrullas acuáticas', activo: true, orden: 4, esSistema: false },
  { id: 'tf5', tipo: 'tipo_flota', key: 'supervision', label: 'Supervisión', descripcion: 'Camionetas de supervisión', activo: true, orden: 5, esSistema: false },
  { id: 'tf6', tipo: 'tipo_flota', key: 'carga', label: 'Carga', descripcion: 'Vehículos de carga', activo: true, orden: 6, esSistema: false },
  { id: 'tf7', tipo: 'tipo_flota', key: 'otro', label: 'Otro', descripcion: 'Otros tipos de flota', activo: true, orden: 7, esSistema: true },
  // Tipos de Contrato Flota
  { id: 'tcf1', tipo: 'tipo_contrato_flota', key: 'solo_garantia', label: 'Solo Garantía', activo: true, orden: 1, esSistema: true },
  { id: 'tcf2', tipo: 'tipo_contrato_flota', key: 'mantenimiento_y_garantia', label: 'Mantenimiento + Garantía', activo: true, orden: 2, esSistema: true },
  { id: 'tcf3', tipo: 'tipo_contrato_flota', key: 'solo_mantenimiento', label: 'Solo Mantenimiento', activo: true, orden: 3, esSistema: true },
  { id: 'tcf4', tipo: 'tipo_contrato_flota', key: 'full_service', label: 'Full Service', activo: true, orden: 4, esSistema: true },
  { id: 'tcf5', tipo: 'tipo_contrato_flota', key: 'otro', label: 'Otro', activo: true, orden: 5, esSistema: true },
  // Tipos de Documento Vehículo
  { id: 'tdv1', tipo: 'tipo_doc_vehiculo', key: 'SOAT', label: 'SOAT', activo: true, orden: 1, esSistema: true },
  { id: 'tdv2', tipo: 'tipo_doc_vehiculo', key: 'REVISION_TECNICA', label: 'Revisión Técnica', activo: true, orden: 2, esSistema: true },
  { id: 'tdv3', tipo: 'tipo_doc_vehiculo', key: 'TARJETA_PROPIEDAD', label: 'Tarjeta de Propiedad', activo: true, orden: 3, esSistema: true },
  { id: 'tdv4', tipo: 'tipo_doc_vehiculo', key: 'SEGURO_VEHICULAR', label: 'Seguro Vehicular', activo: true, orden: 4, esSistema: true },
  { id: 'tdv5', tipo: 'tipo_doc_vehiculo', key: 'PERMISO_OPERACION', label: 'Permiso de Operación', activo: true, orden: 5, esSistema: true },
  { id: 'tdv6', tipo: 'tipo_doc_vehiculo', key: 'OTRO', label: 'Otro', activo: true, orden: 6, esSistema: true },
  // Categorías de Proveedor
  { id: 'cp1', tipo: 'categoria_proveedor', key: 'repuestos', label: 'Repuestos', activo: true, orden: 1, esSistema: true },
  { id: 'cp2', tipo: 'categoria_proveedor', key: 'taller', label: 'Taller', activo: true, orden: 2, esSistema: true },
  { id: 'cp3', tipo: 'categoria_proveedor', key: 'combustible', label: 'Combustible', activo: true, orden: 3, esSistema: true },
  { id: 'cp4', tipo: 'categoria_proveedor', key: 'seguros', label: 'Seguros', activo: true, orden: 4, esSistema: true },
  { id: 'cp5', tipo: 'categoria_proveedor', key: 'equipos_medicos', label: 'Equipos Médicos', activo: true, orden: 5, esSistema: true },
  { id: 'cp6', tipo: 'categoria_proveedor', key: 'insumos', label: 'Insumos', activo: true, orden: 6, esSistema: true },
  { id: 'cp7', tipo: 'categoria_proveedor', key: 'servicios_profesionales', label: 'Servicios Profesionales', activo: true, orden: 7, esSistema: true },
  { id: 'cp8', tipo: 'categoria_proveedor', key: 'construccion', label: 'Construcción', activo: true, orden: 8, esSistema: false },
  { id: 'cp9', tipo: 'categoria_proveedor', key: 'tecnologia', label: 'Tecnología', activo: true, orden: 9, esSistema: false },
  { id: 'cp10', tipo: 'categoria_proveedor', key: 'otros', label: 'Otros', activo: true, orden: 10, esSistema: true },
  // Categorías de Equipo Biomédico
  { id: 'ceb1', tipo: 'categoria_equipo_bio', key: 'diagnostico', label: 'Diagnóstico', activo: true, orden: 1, esSistema: true },
  { id: 'ceb2', tipo: 'categoria_equipo_bio', key: 'terapeutico', label: 'Terapéutico', activo: true, orden: 2, esSistema: true },
  { id: 'ceb3', tipo: 'categoria_equipo_bio', key: 'soporte_vital', label: 'Soporte Vital', activo: true, orden: 3, esSistema: true },
  { id: 'ceb4', tipo: 'categoria_equipo_bio', key: 'laboratorio', label: 'Laboratorio', activo: true, orden: 4, esSistema: true },
  { id: 'ceb5', tipo: 'categoria_equipo_bio', key: 'rehabilitacion', label: 'Rehabilitación', activo: true, orden: 5, esSistema: true },
  { id: 'ceb6', tipo: 'categoria_equipo_bio', key: 'imagenologia', label: 'Imagenología', activo: true, orden: 6, esSistema: false },
  { id: 'ceb7', tipo: 'categoria_equipo_bio', key: 'odontologia', label: 'Odontología', activo: true, orden: 7, esSistema: false },
];

// ============================================================================
// CONTEXT
// ============================================================================

interface CatalogosContextValue {
  items: ItemCatalogo[];
  loading: boolean;
  getByTipo: (tipo: TipoCatalogo, soloActivos?: boolean) => ItemCatalogo[];
  crearItem: (input: Omit<ItemCatalogo, 'id'>) => Promise<void>;
  actualizarItem: (id: string, changes: Partial<Pick<ItemCatalogo, 'label' | 'descripcion' | 'activo' | 'orden'>>) => Promise<void>;
  eliminarItem: (id: string) => Promise<void>;
}

const CatalogosContext = createContext<CatalogosContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function CatalogosProvider({ children }: { children: React.ReactNode }) {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<ItemCatalogo[]>(CATALOGOS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [dbAvailable, setDbAvailable] = useState(false);

  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }
    loadFromDB();
  }, [tenantId]);

  const loadFromDB = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catalogos')
        .select('*')
        .order('orden', { ascending: true });

      if (error) {
        // Table may not exist yet — use defaults silently
        console.warn('[CATALOGOS] DB no disponible, usando defaults:', error.message);
        setItems(CATALOGOS_DEFAULT);
        setDbAvailable(false);
      } else if (data && data.length > 0) {
        setItems(data.map(row => ({
          id: row.id,
          tipo: row.tipo as TipoCatalogo,
          key: row.key,
          label: row.label,
          descripcion: row.descripcion ?? undefined,
          activo: row.activo,
          orden: row.orden,
          esSistema: row.es_sistema ?? false,
        })));
        setDbAvailable(true);
      } else {
        // DB exists but empty — use defaults
        setItems(CATALOGOS_DEFAULT);
        setDbAvailable(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const getByTipo = useCallback((tipo: TipoCatalogo, soloActivos = true) => {
    return items.filter(i => i.tipo === tipo && (!soloActivos || i.activo));
  }, [items]);

  const crearItem = useCallback(async (input: Omit<ItemCatalogo, 'id'>) => {
    if (dbAvailable && tenantId) {
      const { data, error } = await supabase
        .from('catalogos')
        .insert({
          tenant_id: tenantId,
          tipo: input.tipo,
          key: input.key,
          label: input.label,
          descripcion: input.descripcion ?? null,
          activo: input.activo,
          orden: input.orden,
          es_sistema: input.esSistema,
        })
        .select()
        .single();
      if (!error && data) {
        const nuevo: ItemCatalogo = {
          id: data.id, tipo: data.tipo, key: data.key, label: data.label,
          descripcion: data.descripcion, activo: data.activo, orden: data.orden, esSistema: data.es_sistema,
        };
        setItems(prev => [...prev, nuevo]);
        return;
      }
    }
    // Fallback: local only
    const id = `local_${Date.now()}`;
    setItems(prev => [...prev, { ...input, id }]);
  }, [dbAvailable, tenantId]);

  const actualizarItem = useCallback(async (id: string, changes: Partial<Pick<ItemCatalogo, 'label' | 'descripcion' | 'activo' | 'orden'>>) => {
    if (dbAvailable) {
      await supabase.from('catalogos').update({
        ...(changes.label !== undefined && { label: changes.label }),
        ...(changes.descripcion !== undefined && { descripcion: changes.descripcion }),
        ...(changes.activo !== undefined && { activo: changes.activo }),
        ...(changes.orden !== undefined && { orden: changes.orden }),
      }).eq('id', id);
    }
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...changes } : i));
  }, [dbAvailable]);

  const eliminarItem = useCallback(async (id: string) => {
    if (dbAvailable) {
      await supabase.from('catalogos').delete().eq('id', id);
    }
    setItems(prev => prev.filter(i => i.id !== id));
  }, [dbAvailable]);

  return (
    <CatalogosContext.Provider value={{ items, loading, getByTipo, crearItem, actualizarItem, eliminarItem }}>
      {children}
    </CatalogosContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useCatalogos() {
  const ctx = useContext(CatalogosContext);
  if (!ctx) throw new Error('useCatalogos debe usarse dentro de <CatalogosProvider>');
  return ctx;
}

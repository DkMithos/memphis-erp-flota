/**
 * Memphis ERP — API v1 (Edge Function `api`)
 *
 *   https://<proyecto>.supabase.co/functions/v1/api/v1/<recurso>
 *   Producción: la misma URL (el dominio erp.memphismaquinarias.com sirve el frontend, no la API).
 *
 * Para qué: que otros sistemas (Power BI, el dashboard de TI, Microsoft 365, un proveedor) lean el ERP
 * con una clave propia y alcances por módulo, sin tocar PostgREST ni las claves de Supabase.
 *
 * Autenticación: cabecera `x-api-key: mm_live_…` (o `Authorization: Bearer mm_live_…`). La clave se
 * crea en Administración › API e integraciones; aquí solo se compara su SHA-256 con `api_claves`.
 * Alcances: `<modulo>:leer` / `<modulo>:escribir` o `*:leer`. Módulos: proyectos, compras, proveedores,
 * finanzas, inventario, flota, viajes, fianzas.
 * Tope: 120 llamadas por minuto por clave (429). Toda llamada queda en `api_accesos`.
 *
 * Respuesta de lista: { data: [...], paginacion: { pagina, por_pagina, total } }. Filtros por query string
 * (ver /v1/openapi.json y /v1/docs). Errores: { error: 'mensaje', codigo }.
 *
 * Por qué `auth: 'none'`: la credencial es la clave de la API (verificada aquí), no un JWT ni una
 * clave de Supabase. Las consultas usan el cliente admin y SIEMPRE filtran por el tenant de la clave.
 */
import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { withSupabase } from 'npm:@supabase/server'

type Admin = Parameters<Parameters<typeof withSupabase>[1]>[1]['supabaseAdmin']

// 1.1.0 (29/10/2026): recurso /cotizaciones y descuentos de proveedor en órdenes y cotizaciones.
// 1.2.0 (29/10/2026): órdenes y facturas completas — todas las columnas de negocio y `?incluir=` con ítems, firmas,
//   recepciones, facturas, pagos, compromisos, detracciones, detalle y archivos (URL firmada 10 min). El detalle por id
//   trae todo por defecto. Pedido de Kevin: "que con la API se pueda extraer TODA la información de órdenes y facturas".
const VERSION = '1.2.0'
const TOPE_POR_MINUTO = 120
const MAX_POR_PAGINA = 200

interface Clave { id: string; tenant_id: string; nombre: string; alcances: string[]; activa: boolean; expira_en: string | null }
interface Filtro { param: string; columna: string; op: 'eq' | 'gte' | 'lte' | 'ilike' | 'bool' | 'or'; descripcion: string; columnas?: string[] }
interface Recurso {
  ruta: string; modulo: string; tabla: string; titulo: string; columnas: string[]; orden: { columna: string; asc?: boolean }[]; filtros: Filtro[]
  /** Qué se puede pedir con `?incluir=a,b` (o `todo`). Solo órdenes y facturas por ahora. */
  incluye?: string[]
}

async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('')
}

// PostgREST devuelve como mucho 1,000 filas por llamada: para sumar hay que paginar.
async function todo<T = Record<string, any>>(q: (desde: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<{ data: T[] }> {
  const out: T[] = []
  for (let d = 0; d < 50_000; d += 1000) { const { data } = await q(d); out.push(...(data ?? [])); if (!data || data.length < 1000) break }
  return { data: out }
}

// ── Catálogo de recursos (solo columnas permitidas: nada de tokens, rutas de archivos ni firmas) ──
const fechas = (col: string): Filtro[] => [
  { param: 'desde', columna: col, op: 'gte', descripcion: `${col} ≥ (AAAA-MM-DD)` },
  { param: 'hasta', columna: col, op: 'lte', descripcion: `${col} ≤ (AAAA-MM-DD)` },
]
const RECURSOS: Recurso[] = [
  { ruta: 'proyectos', modulo: 'proyectos', tabla: 'proyectos', titulo: 'Proyectos',
    columnas: ['id','codigo','nombre','descripcion','tipo','estado','prioridad','fase','situacion','modalidad','entidad_cliente','region','codigo_inversion','fecha_inicio','fecha_fin_estimada','fecha_fin_real','fecha_firma_convenio','moneda','presupuesto','costo_real','monto_contrato','monto_adenda','monto_cobrado','porcentaje_avance','gerente_proyecto','fecha_ciprl_estimada','fecha_ciprl_cobro','creado_en','modificado_en'],
    orden: [{ columna: 'codigo' }],
    filtros: [{ param: 'estado', columna: 'estado', op: 'eq', descripcion: 'idea · planificacion · en_ejecucion · completado · cancelado' }, { param: 'region', columna: 'region', op: 'ilike', descripcion: 'contiene' }, { param: 'q', columna: '', op: 'or', columnas: ['codigo', 'nombre', 'entidad_cliente'], descripcion: 'busca en código, nombre y entidad' }] },
  { ruta: 'ordenes-compra', modulo: 'compras', tabla: 'ordenes_compra', titulo: 'Órdenes de compra',
    // Todas las columnas de negocio de la orden (solo queda fuera tenant_id).
    columnas: ['id','numero','tipo','estado','fecha_emision','fecha_entrega_esperada','fecha_vencimiento_pago','vencimiento_manual','vencimiento_estimado','cotizacion_id','proveedor_id','proyecto_id','centro_costo_id','centro_costo_texto','moneda','tipo_cambio','tipo_cambio_migracion','subtotal','descuento_global_tipo','descuento_global_valor','descuento_global','igv','total','condiciones_pago','dias_credito','lugar_entrega','regimen_igv','aplica_retencion_rh','detraccion','banco_seleccionado','cuenta_seleccionada','pago_ligado_a','comprador_email','aprobado_por','aprobado_en','motivo_rechazo','rechazado_por','rechazado_en','motivo_anulacion','solicitud_edicion','observaciones','migrado_de','migrado_id','creado_por','creado_en','modificado_por','modificado_en'],
    orden: [{ columna: 'fecha_emision', asc: false }, { columna: 'numero', asc: false }],
    filtros: [{ param: 'estado', columna: 'estado', op: 'eq', descripcion: 'estado de la OC' }, { param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }, { param: 'proveedor_id', columna: 'proveedor_id', op: 'eq', descripcion: 'uuid del proveedor' }, { param: 'numero', columna: 'numero', op: 'ilike', descripcion: 'MM-000123' }, ...fechas('fecha_emision')],
    incluye: ['items', 'proveedor', 'proyecto', 'centro_costo', 'firmas', 'recepciones', 'facturas', 'ediciones', 'pagos', 'compromisos'] },
  { ruta: 'cotizaciones', modulo: 'compras', tabla: 'cotizaciones', titulo: 'Cotizaciones de proveedores',
    columnas: ['id','numero','tipo','estado','fecha_emision','fecha_validez','requerimiento_id','proveedor_id','proyecto_id','centro_costo_id','moneda','subtotal','descuento_global_tipo','descuento_global_valor','descuento_global','igv','total','regimen_igv','plazo_entrega','condiciones_pago','es_tarifario','tarifario_vigencia','aprobado_por','aprobado_en','motivo_rechazo','observaciones','creado_en','modificado_en'],
    orden: [{ columna: 'fecha_emision', asc: false }],
    filtros: [{ param: 'estado', columna: 'estado', op: 'eq', descripcion: 'estado de la cotización' }, { param: 'proveedor_id', columna: 'proveedor_id', op: 'eq', descripcion: 'uuid del proveedor' }, { param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }, { param: 'requerimiento_id', columna: 'requerimiento_id', op: 'eq', descripcion: 'uuid del requerimiento' }, ...fechas('fecha_emision')] },
  { ruta: 'facturas', modulo: 'compras', tabla: 'comprobantes_pago', titulo: 'Facturas (recibidas y emitidas)',
    // Todas las columnas de negocio de la factura. Las rutas de archivo (pdf_path/xml_path) no salen: con `incluir=archivos`
    // se entregan URLs firmadas de 10 minutos (`pdf_url`, `xml_url`).
    columnas: ['id','tipo','serie','numero','numero_completo','direccion','fecha_emision','fecha_vencimiento','ruc_emisor','razon_social_emisor','ruc_receptor','razon_social_receptor','op_gravada','op_exonerada','op_inafecta','op_exportacion','subtotal','igv','otros_tributos','total','moneda','tipo_cambio','tiene_detraccion','detraccion_codigo','detraccion_tasa','detraccion_monto','tiene_retencion','retencion_tasa','retencion_monto','estado','estado_flujo','motivo_observacion','validado_en','conforme_por','conforme_en','proveedor_id','cliente_id','orden_compra_id','orden_compra_numero','recepcion_id','proyecto_id','centro_costo_id','contabilizado','asiento_id','contabilizacion_error','origen','periodo_sire','subido_por_proveedor','subido_por','observaciones','creado_por','creado_en'],
    orden: [{ columna: 'fecha_emision', asc: false }],
    filtros: [{ param: 'direccion', columna: 'direccion', op: 'eq', descripcion: 'recibido · emitido' }, { param: 'estado_flujo', columna: 'estado_flujo', op: 'eq', descripcion: 'recibida · conforme · programada_pago · pagada · observada · historica' }, { param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }, { param: 'ruc', columna: 'ruc_emisor', op: 'eq', descripcion: 'RUC del emisor' }, { param: 'proveedor_id', columna: 'proveedor_id', op: 'eq', descripcion: 'uuid del proveedor' }, { param: 'orden_compra_id', columna: 'orden_compra_id', op: 'eq', descripcion: 'uuid de la OC' }, { param: 'numero', columna: 'numero_completo', op: 'ilike', descripcion: 'F001-123' }, ...fechas('fecha_emision')],
    incluye: ['detalle', 'proveedor', 'proyecto', 'centro_costo', 'orden', 'detracciones', 'pagos', 'compromiso', 'archivos'] },
  { ruta: 'proveedores', modulo: 'proveedores', tabla: 'proveedores', titulo: 'Proveedores',
    columnas: ['id','codigo','razon_social','nombre_comercial','ruc','tipo','categoria','estado','condicion','score','email','telefono','celular','web','pais','departamento','provincia','distrito','direccion','contacto','contacto_cargo','contacto_email','contacto_telefono','domiciliado','regimen_igv','sujeto_detraccion','tasa_detraccion','sujeto_retencion','agente_retencion','agente_percepcion','buen_contribuyente','verificado_sunat','creado_en','modificado_en'],
    orden: [{ columna: 'razon_social' }],
    filtros: [{ param: 'estado', columna: 'estado', op: 'eq', descripcion: 'activo · inactivo' }, { param: 'ruc', columna: 'ruc', op: 'eq', descripcion: 'RUC' }, { param: 'q', columna: '', op: 'or', columnas: ['razon_social', 'nombre_comercial', 'ruc'], descripcion: 'busca en razón social y RUC' }] },
  { ruta: 'cuentas-por-pagar', modulo: 'finanzas', tabla: 'v_cxp', titulo: 'Cuentas por pagar (compromisos)',
    columnas: ['id','area','cdc','centro_costo_id','proyecto_id','concepto','categoria','proveedor','proveedor_id','moneda','tc','monto_presupuestado','monto_ejecutado','monto_pagado','monto_pendiente','fecha_vencimiento','vence','mes','estado_pago','pagado','vencido','fecha_pagado','origen','fuente','orden_compra_id','comprobante_id','referencia_doc','pago_ligado_a','observaciones'],
    orden: [{ columna: 'fecha_vencimiento', asc: true }],
    filtros: [{ param: 'estado_pago', columna: 'estado_pago', op: 'eq', descripcion: 'PENDIENTE · PARCIAL · PAGADO' }, { param: 'vencido', columna: 'vencido', op: 'bool', descripcion: 'true/false' }, { param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }, { param: 'proveedor_id', columna: 'proveedor_id', op: 'eq', descripcion: 'uuid del proveedor' }, { param: 'area', columna: 'area', op: 'eq', descripcion: 'área' }, ...fechas('fecha_vencimiento')] },
  { ruta: 'cuentas-por-cobrar', modulo: 'finanzas', tabla: 'v_cxc', titulo: 'Cuentas por cobrar',
    columnas: ['id','area','cdc','proyecto_id','concepto','categoria','proveedor','moneda','tc','monto_presupuestado','monto_ejecutado','monto_pagado','monto_pendiente','fecha_vencimiento','vence','mes','estado_pago','cobrado','fecha_pagado','origen','fuente','comprobante_id','valorizacion_id','referencia_doc','observaciones'],
    orden: [{ columna: 'fecha_vencimiento', asc: true }],
    filtros: [{ param: 'estado_pago', columna: 'estado_pago', op: 'eq', descripcion: 'PENDIENTE · PARCIAL · PAGADO' }, { param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }, ...fechas('fecha_vencimiento')] },
  { ruta: 'pagos', modulo: 'finanzas', tabla: 'transacciones', titulo: 'Pagos y cobros (tesorería)',
    columnas: ['id','numero','tipo','categoria','subcategoria','estado','monto','moneda','tipo_cambio','monto_soles','fecha','fecha_pago','descripcion','proveedor_nombre','referencia_numero','referencia_tipo','cuenta_bancaria_id','centro_costo_id','proyecto_id','comprobante_id','orden_compra_id','compromiso_id','movimiento_bancario_id','conciliado_en','creado_en'],
    orden: [{ columna: 'fecha_pago', asc: false }, { columna: 'numero', asc: false }],
    filtros: [{ param: 'tipo', columna: 'tipo', op: 'eq', descripcion: 'egreso · ingreso' }, { param: 'estado', columna: 'estado', op: 'eq', descripcion: 'pagada · pendiente · anulada' }, { param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }, { param: 'cuenta_bancaria_id', columna: 'cuenta_bancaria_id', op: 'eq', descripcion: 'uuid de la cuenta' }, { param: 'q', columna: '', op: 'or', columnas: ['numero', 'descripcion', 'proveedor_nombre', 'referencia_numero'], descripcion: 'busca en número, descripción, proveedor y OPE' }, ...fechas('fecha_pago')] },
  { ruta: 'bancos/cuentas', modulo: 'finanzas', tabla: 'cuentas_bancarias', titulo: 'Cuentas bancarias',
    columnas: ['id','nombre','banco','moneda','tipo','activa','saldo_inicial','saldo_inicial_fecha','orden'], orden: [{ columna: 'orden' }], filtros: [{ param: 'activa', columna: 'activa', op: 'bool', descripcion: 'true/false' }] },
  { ruta: 'bancos/movimientos', modulo: 'finanzas', tabla: 'movimientos_bancarios', titulo: 'Movimientos bancarios (extracto)',
    columnas: ['id','cuenta_bancaria_id','fecha_operacion','fecha_valor','numero_doc','concepto','importe','clasificacion','transaccion_id','conciliado_en','centro_costo_id','proyecto_id','notas','importado_en'],
    orden: [{ columna: 'fecha_operacion', asc: false }],
    filtros: [{ param: 'cuenta_bancaria_id', columna: 'cuenta_bancaria_id', op: 'eq', descripcion: 'uuid de la cuenta' }, { param: 'clasificacion', columna: 'clasificacion', op: 'eq', descripcion: 'pago_proveedor · itf · comision · abono …' }, { param: 'conciliado', columna: 'transaccion_id', op: 'bool', descripcion: 'true = con transacción' }, ...fechas('fecha_operacion')] },
  { ruta: 'caja-chica/cajas', modulo: 'finanzas', tabla: 'cajas_chicas', titulo: 'Cajas chicas',
    columnas: ['id','nombre','codigo','responsable','monto_asignado','monto_disponible','moneda','estado','creado_en'], orden: [{ columna: 'creado_en', asc: false }], filtros: [{ param: 'estado', columna: 'estado', op: 'eq', descripcion: 'activo · cerrada' }] },
  { ruta: 'caja-chica/gastos', modulo: 'finanzas', tabla: 'gastos_caja_chica', titulo: 'Gastos de caja chica',
    columnas: ['id','caja_id','numero','fecha','descripcion','categoria','monto','moneda','beneficiario','comprobante_tipo','comprobante_numero','estado','centro_costo','proyecto_id','realizado_por','aprobado_por','notas','creado_en'],
    orden: [{ columna: 'fecha', asc: false }],
    filtros: [{ param: 'caja_id', columna: 'caja_id', op: 'eq', descripcion: 'uuid de la caja' }, { param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }, { param: 'categoria', columna: 'categoria', op: 'ilike', descripcion: 'contiene' }, ...fechas('fecha')] },
  { ruta: 'inventario/articulos', modulo: 'inventario', tabla: 'articulos', titulo: 'Artículos',
    columnas: ['id','codigo','nombre','descripcion','tipo','unidad_medida','marca','modelo','codigo_fabricante','stock_actual','stock_minimo','stock_maximo','precio_unitario','moneda','activo','origen','creado_en'],
    orden: [{ columna: 'codigo' }], filtros: [{ param: 'activo', columna: 'activo', op: 'bool', descripcion: 'true/false' }, { param: 'q', columna: '', op: 'or', columnas: ['codigo', 'nombre', 'marca', 'modelo'], descripcion: 'busca en código, nombre, marca y modelo' }] },
  { ruta: 'inventario/unidades', modulo: 'inventario', tabla: 'v_inventario_unidades', titulo: 'Unidades con número de serie',
    columnas: ['id','articulo_id','articulo_codigo','articulo','marca','modelo','serie','lote','estado','almacen_id','almacen','proyecto_id','proyecto_codigo','proyecto','vehiculo_id','vehiculo_placa','proveedor','factura','orden_compra','valor_usd','valor_soles','fecha_ingreso','fecha_salida','documento_salida','observaciones','actualizado_en'],
    orden: [{ columna: 'articulo_codigo' }, { columna: 'serie' }],
    filtros: [{ param: 'estado', columna: 'estado', op: 'eq', descripcion: 'en_almacen · instalada · entregada · devuelta · en_reparacion · baja' }, { param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }, { param: 'articulo_id', columna: 'articulo_id', op: 'eq', descripcion: 'uuid del artículo' }, { param: 'serie', columna: 'serie', op: 'ilike', descripcion: 'contiene' }] },
  { ruta: 'flota/vehiculos', modulo: 'flota', tabla: 'vehiculos', titulo: 'Vehículos',
    columnas: ['id','codigo','placa','placa_interna','vin','tipo','tipo_flota','marca','modelo','anio','color','combustible','kilometraje','ubicacion_actual','estado','proyecto_id','flota_id','es_administrativo','contrato_cliente_nombre','contrato_proyecto_nombre','contrato_fecha_inicio','contrato_fecha_fin','ultimo_mantenimiento','proximo_mantenimiento','tiene_soat','soat_vigencia','tiene_seguro','seguro_vigencia','fecha_adquisicion','precio_adquisicion','moneda_adquisicion','creado_en','modificado_en'],
    orden: [{ columna: 'placa' }], filtros: [{ param: 'estado', columna: 'estado', op: 'eq', descripcion: 'estado del vehículo' }, { param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }, { param: 'placa', columna: 'placa', op: 'ilike', descripcion: 'contiene' }] },
  { ruta: 'viajes', modulo: 'viajes', tabla: 'v_viajes', titulo: 'Viajes y viáticos',
    columnas: ['id','numero','proyecto_id','proyecto_codigo','proyecto_nombre','cdc','motivo','origen','destino','fecha_salida','fecha_retorno','medio_sugerido','requiere_pasajes','requiere_viaticos','con_hospedaje','estado','solicitante','jefatura_nombre','aprobador_nombre','presupuesto_viaticos','tope_excedido','viajeros','viajeros_nombres','adelantos','reservas_soles','reservas_pagadas_soles','rendido','saldo_rendiciones','creado_en'],
    orden: [{ columna: 'fecha_salida', asc: false }], filtros: [{ param: 'estado', columna: 'estado', op: 'eq', descripcion: 'solicitado · aprobado_jefatura · aprobado · en_curso · rendido · cerrado · rechazado · anulado' }, { param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }, ...fechas('fecha_salida')] },
  { ruta: 'correspondencia', modulo: 'proyectos', tabla: 'v_correspondencia', titulo: 'Correspondencia con el Estado',
    columnas: ['id','proyecto_id','proyecto_codigo','proyecto_nombre','hilo_id','hilo_titulo','etapa','numero_doc','tipo','sentido','emisor','receptor','asunto','fecha_documento','fecha_recepcion','requiere_respuesta','plazo_dias','fecha_limite','dias_para_vencer','vencida','estado','responde_a','responde_a_numero','respondido_en','archivo_url','observaciones','creado_en','actualizado_en'],
    orden: [{ columna: 'fecha_documento', asc: false }], filtros: [{ param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }, { param: 'estado', columna: 'estado', op: 'eq', descripcion: 'registrado · pendiente · respondido · cerrado' }, { param: 'tipo', columna: 'tipo', op: 'eq', descripcion: 'carta · oficio · informe · memorandum · proveido …' }, { param: 'vencida', columna: 'vencida', op: 'bool', descripcion: 'true/false' }, ...fechas('fecha_documento')] },
  { ruta: 'valorizaciones', modulo: 'proyectos', tabla: 'valorizaciones', titulo: 'Valorizaciones',
    columnas: ['id','proyecto_id','numero','descripcion','monto','moneda','estado','fecha_presentacion','fecha_aprobacion','fecha_pago','porcentaje_conformidad','observaciones','creado_en'],
    orden: [{ columna: 'fecha_presentacion', asc: false }], filtros: [{ param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }, { param: 'estado', columna: 'estado', op: 'eq', descripcion: 'estado' }] },
  { ruta: 'fianzas', modulo: 'fianzas', tabla: 'fianzas', titulo: 'Cartas fianza (por proyecto)',
    columnas: ['id','concurso','nombre_proyecto','proyecto_id','consorcio','entidad','monto_contrato','porcentaje','notas','actualizado_en'], orden: [{ columna: 'nombre_proyecto' }], filtros: [{ param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }] },
  { ruta: 'capacitaciones', modulo: 'proyectos', tabla: 'capacitaciones', titulo: 'Capacitaciones',
    columnas: ['id','codigo','proyecto_id','titulo','descripcion','horas_total','fecha_inicio','fecha_fin','lugar','ciudad','instructor_nombre','entidad_beneficiaria','estado','creado_en'],
    orden: [{ columna: 'fecha_inicio', asc: false }], filtros: [{ param: 'proyecto_id', columna: 'proyecto_id', op: 'eq', descripcion: 'uuid del proyecto' }, { param: 'estado', columna: 'estado', op: 'eq', descripcion: 'estado' }] },
  { ruta: 'certificados', modulo: 'proyectos', tabla: 'certificados', titulo: 'Certificados emitidos',
    columnas: ['id','codigo','capacitacion_id','participante_id','estado','emitido_en','revocado_en','motivo_revocacion'], orden: [{ columna: 'emitido_en', asc: false }],
    filtros: [{ param: 'capacitacion_id', columna: 'capacitacion_id', op: 'eq', descripcion: 'uuid de la capacitación' }, { param: 'estado', columna: 'estado', op: 'eq', descripcion: 'emitido · revocado' }] },
]
const MODULOS = ['proyectos', 'compras', 'proveedores', 'finanzas', 'inventario', 'flota', 'viajes', 'fianzas']

function tieneAlcance(clave: Clave, modulo: string, accion: 'leer' | 'escribir'): boolean {
  const a = clave.alcances ?? []
  return a.includes('*') || a.includes(`*:${accion}`) || a.includes(`${modulo}:${accion}`) || (accion === 'leer' && a.includes(`${modulo}:escribir`))
}

// ── Expansiones (`?incluir=`): la orden y la factura con TODO lo que las rodea ──────────────────────────────────────
/** Qué pidió el cliente; `todo` = todas las expansiones del recurso. En el detalle por id, sin parámetro = todo. */
function incluirDe(url: URL, r: Recurso, todoPorDefecto: boolean): Set<string> {
  const permitidas = r.incluye ?? []
  const raw = url.searchParams.get('incluir')
  if (raw == null || raw === '') return new Set(todoPorDefecto ? permitidas : [])
  const pedidas = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  if (pedidas.includes('todo')) return new Set(permitidas)
  return new Set(pedidas.filter(p => permitidas.includes(p)))
}

function agrupar<T extends Record<string, any>>(filas: T[] | null | undefined, clave: string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const f of filas ?? []) { const k = String(f[clave] ?? ''); if (!m.has(k)) m.set(k, []); m.get(k)!.push(f) }
  return m
}

/** Catálogos pequeños que van en varios recursos: proveedor, proyecto y centro de costo (solo identificación). */
async function catalogos(admin: Admin, tenant: string, filas: Record<string, any>[], inc: Set<string>) {
  const ids = (col: string) => [...new Set(filas.map(f => f[col]).filter(Boolean))] as string[]
  if (inc.has('proveedor') && ids('proveedor_id').length) {
    const { data } = await admin.from('proveedores').select('id, codigo, razon_social, nombre_comercial, ruc, estado, sujeto_detraccion, tasa_detraccion, sujeto_retencion').eq('tenant_id', tenant).in('id', ids('proveedor_id'))
    const m = new Map((data ?? []).map(p => [p.id, p])); for (const f of filas) f.proveedor = m.get(f.proveedor_id) ?? null
  }
  if (inc.has('proyecto') && ids('proyecto_id').length) {
    const { data } = await admin.from('proyectos').select('id, codigo, nombre, estado, entidad_cliente').eq('tenant_id', tenant).in('id', ids('proyecto_id'))
    const m = new Map((data ?? []).map(p => [p.id, p])); for (const f of filas) f.proyecto = m.get(f.proyecto_id) ?? null
  }
  if (inc.has('centro_costo') && ids('centro_costo_id').length) {
    const { data } = await admin.from('centros_costo').select('id, codigo, nombre').eq('tenant_id', tenant).in('id', ids('centro_costo_id'))
    const m = new Map((data ?? []).map(p => [p.id, p])); for (const f of filas) f.centro_costo = m.get(f.centro_costo_id) ?? null
  }
}

/** Pagos (tesorería) y compromisos (CxP) son de Finanzas: solo salen si la clave tiene finanzas:leer. */
const COLS_PAGO = 'id, numero, tipo, estado, fecha, fecha_pago, monto, moneda, tipo_cambio, monto_soles, descripcion, referencia_tipo, referencia_numero, cuenta_bancaria_id, comprobante_id, orden_compra_id, compromiso_id, movimiento_bancario_id, conciliado_en'
const COLS_COMPROMISO = 'id, concepto, moneda, monto_presupuestado, monto_ejecutado, monto_pagado, estado_pago, fecha_vencimiento, fecha_pagado, origen, orden_compra_id, comprobante_id'

async function expandirOrdenes(admin: Admin, clave: Clave, filas: Record<string, any>[], inc: Set<string>) {
  if (!filas.length || !inc.size) return
  const t = clave.tenant_id; const ids = filas.map(f => f.id as string)
  await catalogos(admin, t, filas, inc)
  if (inc.has('items')) {
    const { data } = await admin.from('orden_items').select('id, orden_id, descripcion, unidad, cantidad, precio_unitario, descuento_tipo, descuento_valor, descuento, precio_total, articulo_id, partida_id, presupuesto_linea_id').eq('tenant_id', t).in('orden_id', ids).order('id')
    const m = agrupar(data, 'orden_id'); for (const f of filas) f.items = m.get(f.id) ?? []
  }
  if (inc.has('firmas')) {
    // Sin la imagen de la rúbrica: quién firmó qué etapa y cuándo.
    const { data } = await admin.from('orden_aprobaciones').select('orden_id, etapa, aprobado_por_nombre, aprobado_por_email, aprobado_en, origen').eq('tenant_id', t).in('orden_id', ids).order('aprobado_en')
    const m = agrupar(data, 'orden_id'); for (const f of filas) f.firmas = m.get(f.id) ?? []
  }
  if (inc.has('recepciones')) {
    const { data } = await admin.from('recepciones').select('id, orden_id, numero, estado, fecha_recepcion, numero_guia, numero_factura, almacen_id, observaciones, creado_en').eq('tenant_id', t).in('orden_id', ids).order('fecha_recepcion')
    const rec = data ?? []
    if (rec.length) {
      const { data: ri } = await admin.from('recepcion_items').select('id, recepcion_id, orden_item_id, descripcion, unidad, cantidad_pedida, cantidad_recibida, conforme, precio_unitario, valor_recibido, articulo_id, observaciones').eq('tenant_id', t).in('recepcion_id', rec.map(r => r.id))
      const mi = agrupar(ri, 'recepcion_id'); for (const r of rec) (r as any).items = mi.get(r.id) ?? []
    }
    const m = agrupar(rec, 'orden_id'); for (const f of filas) f.recepciones = m.get(f.id) ?? []
  }
  if (inc.has('facturas')) {
    const { data } = await admin.from('comprobantes_pago').select('id, orden_compra_id, tipo, numero_completo, fecha_emision, fecha_vencimiento, moneda, subtotal, igv, total, estado, estado_flujo, tiene_detraccion, detraccion_monto, tiene_retencion, retencion_monto, contabilizado').eq('tenant_id', t).eq('direccion', 'recibido').in('orden_compra_id', ids).order('fecha_emision')
    const m = agrupar(data, 'orden_compra_id'); for (const f of filas) f.facturas = m.get(f.id) ?? []
  }
  if (inc.has('ediciones')) {
    const { data } = await admin.from('orden_solicitudes_edicion').select('id, orden_id, solicitado_por, solicitado_en, motivo, estado, resuelto_por, resuelto_en, comentario_resolucion, origen').eq('tenant_id', t).in('orden_id', ids).order('solicitado_en')
    const m = agrupar(data, 'orden_id'); for (const f of filas) f.ediciones = m.get(f.id) ?? []
  }
  if (inc.has('pagos') || inc.has('compromisos')) {
    if (!tieneAlcance(clave, 'finanzas', 'leer')) { for (const f of filas) f._omitido = 'pagos y compromisos requieren el alcance finanzas:leer' }
    else {
      if (inc.has('pagos')) {
        const { data } = await admin.from('transacciones').select(COLS_PAGO).eq('tenant_id', t).in('orden_compra_id', ids).neq('estado', 'anulada').order('fecha_pago')
        const m = agrupar(data, 'orden_compra_id'); for (const f of filas) f.pagos = m.get(f.id) ?? []
      }
      if (inc.has('compromisos')) {
        const { data } = await admin.from('flujo_compromisos').select(COLS_COMPROMISO).eq('tenant_id', t).in('orden_compra_id', ids)
        const m = agrupar(data, 'orden_compra_id'); for (const f of filas) f.compromisos = m.get(f.id) ?? []
      }
    }
  }
}

async function expandirFacturas(admin: Admin, clave: Clave, filas: Record<string, any>[], inc: Set<string>) {
  if (!filas.length || !inc.size) return
  const t = clave.tenant_id; const ids = filas.map(f => f.id as string)
  await catalogos(admin, t, filas, inc)
  if (inc.has('detalle')) {
    const { data } = await admin.from('comprobantes_detalle').select('id, comprobante_id, numero_linea, descripcion, unidad, cantidad, precio_unitario, descuento, valor_venta, tipo_afectacion_igv, igv_linea, precio_venta, cuenta_contable').eq('tenant_id', t).in('comprobante_id', ids).order('numero_linea')
    const m = agrupar(data, 'comprobante_id'); for (const f of filas) f.detalle = m.get(f.id) ?? []
  }
  if (inc.has('orden')) {
    const oids = [...new Set(filas.map(f => f.orden_compra_id).filter(Boolean))] as string[]
    if (oids.length) {
      const { data } = await admin.from('ordenes_compra').select('id, numero, tipo, estado, fecha_emision, moneda, total, proyecto_id, centro_costo_id').eq('tenant_id', t).in('id', oids)
      const m = new Map((data ?? []).map(o => [o.id, o])); for (const f of filas) f.orden = m.get(f.orden_compra_id) ?? null
    } else for (const f of filas) f.orden = null
  }
  if (inc.has('detracciones') || inc.has('pagos') || inc.has('compromiso')) {
    if (!tieneAlcance(clave, 'finanzas', 'leer')) { for (const f of filas) f._omitido = 'detracciones, pagos y compromiso requieren el alcance finanzas:leer' }
    else {
      if (inc.has('detracciones')) {
        const { data } = await admin.from('detracciones').select('id, comprobante_id, codigo_bien_servicio, descripcion_bien_servicio, tasa, base_detraccion, monto_detraccion, moneda_origen, tipo_cambio, estado, periodo, fecha_deposito, numero_constancia, cuenta_detraccion, fecha_pago_proveedor, origen, observaciones').eq('tenant_id', t).in('comprobante_id', ids)
        const m = agrupar(data, 'comprobante_id'); for (const f of filas) f.detracciones = m.get(f.id) ?? []
      }
      if (inc.has('pagos')) {
        const { data } = await admin.from('transacciones').select(COLS_PAGO).eq('tenant_id', t).in('comprobante_id', ids).neq('estado', 'anulada').order('fecha_pago')
        const m = agrupar(data, 'comprobante_id'); for (const f of filas) f.pagos = m.get(f.id) ?? []
      }
      if (inc.has('compromiso')) {
        const { data } = await admin.from('flujo_compromisos').select(COLS_COMPROMISO).eq('tenant_id', t).in('comprobante_id', ids)
        const m = agrupar(data, 'comprobante_id'); for (const f of filas) f.compromiso = (m.get(f.id) ?? [])[0] ?? null
      }
    }
  }
  if (inc.has('archivos')) {
    // Las rutas internas no salen; se firma una URL de 10 minutos por archivo (solo las facturas con PDF/XML cargado).
    const { data } = await admin.from('comprobantes_pago').select('id, pdf_path, xml_path').eq('tenant_id', t).in('id', ids)
    const rutas = new Map((data ?? []).map(x => [x.id, x]))
    const firmar = async (p: string | null) => {
      if (!p) return null
      const { data: s } = await admin.storage.from('facturas-proveedores').createSignedUrl(p, 600)
      return s?.signedUrl ?? null
    }
    for (const f of filas) { const x = rutas.get(f.id); f.pdf_url = await firmar(x?.pdf_path ?? null); f.xml_url = await firmar(x?.xml_path ?? null) }
  }
}

const EXPANSORES: Record<string, (admin: Admin, clave: Clave, filas: Record<string, any>[], inc: Set<string>) => Promise<void>> = {
  'ordenes-compra': expandirOrdenes,
  facturas: expandirFacturas,
}

async function listar(admin: Admin, clave: Clave, r: Recurso, url: URL) {
  const pagina = Math.max(1, parseInt(url.searchParams.get('pagina') ?? '1') || 1)
  const porPagina = Math.min(MAX_POR_PAGINA, Math.max(1, parseInt(url.searchParams.get('por_pagina') ?? '50') || 50))
  let q = admin.from(r.tabla).select(r.columnas.join(','), { count: 'exact' }).eq('tenant_id', clave.tenant_id)
  for (const f of r.filtros) {
    const v = url.searchParams.get(f.param)
    if (v == null || v === '') continue
    if (f.op === 'eq') q = q.eq(f.columna, v)
    else if (f.op === 'gte') q = q.gte(f.columna, v)
    else if (f.op === 'lte') q = q.lte(f.columna, v)
    else if (f.op === 'ilike') q = q.ilike(f.columna, `%${v.replace(/[%_]/g, '')}%`)
    else if (f.op === 'bool') {
      const b = ['true', '1', 'si', 'sí'].includes(v.toLowerCase())
      if (f.columna.endsWith('_id')) q = b ? q.not(f.columna, 'is', null) : q.is(f.columna, null)
      else q = q.eq(f.columna, b)
    } else if (f.op === 'or' && f.columnas) {
      const s = v.replace(/[%_,()]/g, '')
      q = q.or(f.columnas.map(c => `${c}.ilike.%${s}%`).join(','))
    }
  }
  const ordenParam = url.searchParams.get('orden')
  if (ordenParam) {
    const desc = ordenParam.startsWith('-'); const col = ordenParam.replace(/^-/, '')
    if (r.columnas.includes(col)) q = q.order(col, { ascending: !desc, nullsFirst: false })
  } else for (const o of r.orden) q = q.order(o.columna, { ascending: o.asc !== false, nullsFirst: false })
  const { data, error: e, count } = await q.range((pagina - 1) * porPagina, pagina * porPagina - 1)
  if (e) throw new Error(e.message)
  const filas = (data ?? []) as Record<string, any>[]
  const inc = incluirDe(url, r, false)
  if (EXPANSORES[r.ruta] && inc.size) await EXPANSORES[r.ruta](admin, clave, filas, inc)
  return { data: filas, paginacion: { pagina, por_pagina: porPagina, total: count ?? 0 }, ...(inc.size ? { incluido: [...inc] } : {}) }
}

function openapi(base: string) {
  const paths: Record<string, unknown> = {}
  const pag = [
    { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
    { name: 'por_pagina', in: 'query', schema: { type: 'integer', default: 50, maximum: MAX_POR_PAGINA } },
    { name: 'orden', in: 'query', description: 'columna; con "-" delante ordena descendente', schema: { type: 'string' } },
  ]
  for (const r of RECURSOS) {
    const incluir = r.incluye?.length ? [{ name: 'incluir', in: 'query', description: `Datos relacionados, separados por coma, o \`todo\`: ${r.incluye.join(', ')}. En el detalle por id vienen todos por defecto. Pagos, compromisos y detracciones exigen además finanzas:leer.`, schema: { type: 'string' } }] : []
    paths[`/v1/${r.ruta}`] = { get: { tags: [r.modulo], summary: r.titulo, description: `Alcance requerido: \`${r.modulo}:leer\`. Columnas: ${r.columnas.join(', ')}.${r.incluye?.length ? ` Relacionados (\`incluir\`): ${r.incluye.join(', ')}.` : ''}`,
      parameters: [...pag, ...incluir, ...r.filtros.map(f => ({ name: f.param, in: 'query', description: f.descripcion, schema: { type: 'string' } }))],
      responses: { 200: { description: 'Lista paginada', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object' } }, paginacion: { type: 'object', properties: { pagina: { type: 'integer' }, por_pagina: { type: 'integer' }, total: { type: 'integer' } } } } } } } }, 401: { description: 'Clave inválida' }, 403: { description: 'Sin alcance' }, 429: { description: 'Tope por minuto' } } } }
    if (['proyectos', 'ordenes-compra', 'facturas', 'proveedores', 'viajes', 'correspondencia', 'flota/vehiculos'].includes(r.ruta)) {
      paths[`/v1/${r.ruta}/{id}`] = { get: { tags: [r.modulo], summary: `${r.titulo}: uno por id${r.incluye?.length ? ' (con todo lo relacionado)' : ''}`, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, ...incluir], responses: { 200: { description: 'Objeto' }, 404: { description: 'No existe' } } } }
    }
  }
  paths['/v1/proyectos/{id}/financiero'] = { get: { tags: ['proyectos'], summary: 'Cifras financieras del proyecto (presupuesto, gasto, utilidad, margen, cadena)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Objeto con financiero y cadena' } } } }
  paths['/v1/indicadores/resumen'] = { get: { tags: ['finanzas'], summary: 'Resumen ejecutivo: proyectos, OC del mes, CxP pendiente y vencida, pagos del mes, cajas, cartas pendientes', responses: { 200: { description: 'Objeto' } } } }
  paths['/v1/correspondencia'] = { ...(paths['/v1/correspondencia'] as object), post: { tags: ['proyectos'], summary: 'Registrar un documento de correspondencia (alcance proyectos:escribir)',
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['proyecto_id', 'asunto'], properties: { proyecto_id: { type: 'string', format: 'uuid' }, hilo_id: { type: 'string', format: 'uuid' }, numero_doc: { type: 'string' }, tipo: { type: 'string' }, sentido: { type: 'string' }, emisor: { type: 'string' }, receptor: { type: 'string' }, asunto: { type: 'string' }, fecha_documento: { type: 'string', format: 'date' }, fecha_recepcion: { type: 'string', format: 'date' }, requiere_respuesta: { type: 'boolean' }, plazo_dias: { type: 'integer' }, fecha_limite: { type: 'string', format: 'date' }, responde_a: { type: 'string', format: 'uuid' }, archivo_url: { type: 'string' }, observaciones: { type: 'string' } } } } } },
    responses: { 201: { description: 'Creado: { id }' }, 422: { description: 'Datos inválidos' } } } }
  paths['/v1/yo'] = { get: { tags: ['sistema'], summary: 'Quién soy: nombre de la integración y alcances de la clave', responses: { 200: { description: 'Objeto' } } } }
  paths['/v1/salud'] = { get: { tags: ['sistema'], summary: 'Estado del servicio (sin clave)', security: [], responses: { 200: { description: 'ok' } } } }
  return {
    openapi: '3.0.3',
    info: { title: 'Memphis ERP · API', version: VERSION, description: 'API de lectura (y escritura puntual) del ERP de Memphis Maquinarias. Autenticación por clave `x-api-key` creada en Administración › API e integraciones. Listas paginadas: `{ data, paginacion }`. Tope: 120 llamadas por minuto por clave.' },
    servers: [{ url: base }],
    components: { securitySchemes: { apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' } } },
    security: [{ apiKey: [] }],
    tags: [...MODULOS.map(m => ({ name: m })), { name: 'sistema' }],
    paths,
  }
}

const DOCS_HTML = (base: string) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Memphis ERP · API</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><script id="api-reference" data-url="${base}/v1/openapi.json" data-configuration='{"theme":"kepler","darkMode":true,"hideDownloadButton":false,"metaData":{"title":"Memphis ERP · API"}}'></script>
<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.25.60"></script></body></html>`

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    const admin = ctx.supabaseAdmin
    const app = new Hono<{ Variables: { clave: Clave } }>().basePath('/api')
    app.use('*', cors({ origin: '*', allowHeaders: ['x-api-key', 'authorization', 'content-type'], allowMethods: ['GET', 'POST', 'OPTIONS'] }))

    // ── sin clave ──
    app.get('/v1/salud', c => c.json({ ok: true, version: VERSION, hora: new Date().toISOString() }))
    app.get('/v1/openapi.json', c => c.json(openapi(new URL(c.req.url).origin + '/functions/v1/api')))
    app.get('/v1/docs', c => c.html(DOCS_HTML(new URL(c.req.url).origin + '/functions/v1/api')))

    // ── autenticación por clave + tope + bitácora ──
    app.use('/v1/*', async (c, next) => {
      const p = new URL(c.req.url).pathname
      if (/\/v1\/(salud|openapi\.json|docs)$/.test(p)) return next()
      const inicio = Date.now()
      const bruta = c.req.header('x-api-key') ?? (c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '')
      if (!bruta.startsWith('mm_live_')) return c.json({ error: 'Falta la clave de la API (cabecera x-api-key)', codigo: 'sin_clave' }, 401)
      const { data: clave } = await admin.from('api_claves').select('id, tenant_id, nombre, alcances, activa, expira_en').eq('clave_hash', await sha256(bruta)).maybeSingle()
      if (!clave || !clave.activa || (clave.expira_en && new Date(clave.expira_en) < new Date())) return c.json({ error: 'Clave inválida, revocada o vencida', codigo: 'clave_invalida' }, 401)
      const desde = new Date(Date.now() - 60_000).toISOString()
      const { count } = await admin.from('api_accesos').select('id', { count: 'exact', head: true }).eq('clave_id', clave.id).gte('creado_en', desde)
      if ((count ?? 0) >= TOPE_POR_MINUTO) return c.json({ error: `Tope de ${TOPE_POR_MINUTO} llamadas por minuto`, codigo: 'tope' }, 429)
      c.set('clave', clave as Clave)
      await next()
      const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null
      await admin.from('api_accesos').insert({ tenant_id: clave.tenant_id, clave_id: clave.id, metodo: c.req.method, ruta: p + (new URL(c.req.url).search || ''), estado: c.res.status, ip, duracion_ms: Date.now() - inicio })
      await admin.rpc('api_clave_tocar', { p_id: clave.id })
    })

    app.get('/v1/yo', c => { const k = c.get('clave') as Clave; return c.json({ integracion: k.nombre, alcances: k.alcances, expira_en: k.expira_en, version: VERSION }) })

    // ── listas y detalle por id ──
    for (const r of RECURSOS) {
      app.get(`/v1/${r.ruta}`, async c => {
        const k = c.get('clave') as Clave
        if (!tieneAlcance(k, r.modulo, 'leer')) return c.json({ error: `La clave no tiene el alcance ${r.modulo}:leer`, codigo: 'sin_alcance' }, 403)
        try { return c.json(await listar(admin, k, r, new URL(c.req.url))) } catch (e) { return c.json({ error: (e as Error).message, codigo: 'consulta' }, 500) }
      })
      app.get(`/v1/${r.ruta}/:id`, async c => {
        const k = c.get('clave') as Clave
        if (!tieneAlcance(k, r.modulo, 'leer')) return c.json({ error: `La clave no tiene el alcance ${r.modulo}:leer`, codigo: 'sin_alcance' }, 403)
        const { data, error: e } = await admin.from(r.tabla).select(r.columnas.join(',')).eq('tenant_id', k.tenant_id).eq('id', c.req.param('id')).maybeSingle()
        if (e) return c.json({ error: e.message, codigo: 'consulta' }, 500)
        if (!data) return c.json({ error: 'No existe', codigo: 'no_existe' }, 404)
        // El detalle por id trae TODO lo relacionado salvo que se pida `?incluir=` concreto.
        const inc = incluirDe(new URL(c.req.url), r, true)
        if (EXPANSORES[r.ruta] && inc.size) { try { await EXPANSORES[r.ruta](admin, k, [data as Record<string, any>], inc) } catch (e2) { return c.json({ error: (e2 as Error).message, codigo: 'consulta' }, 500) } }
        return c.json({ data, ...(inc.size ? { incluido: [...inc] } : {}) })
      })
    }

    // ── proyecto: cifras financieras y cadena ──
    app.get('/v1/proyectos/:id/financiero', async c => {
      const k = c.get('clave') as Clave
      if (!tieneAlcance(k, 'proyectos', 'leer')) return c.json({ error: 'La clave no tiene el alcance proyectos:leer', codigo: 'sin_alcance' }, 403)
      const id = c.req.param('id')
      const { data: p } = await admin.from('proyectos').select('id, codigo, nombre, estado, moneda, presupuesto, costo_real, monto_contrato').eq('tenant_id', k.tenant_id).eq('id', id).maybeSingle()
      if (!p) return c.json({ error: 'No existe', codigo: 'no_existe' }, 404)
      const [fin, cad] = await Promise.all([admin.rpc('proyecto_financiero', { p_proyecto: id }), admin.rpc('proyecto_cadena', { p_proyecto: id })])
      return c.json({ data: { proyecto: p, financiero: fin.error ? null : (Array.isArray(fin.data) ? fin.data[0] ?? null : fin.data), cadena: cad.error ? null : (Array.isArray(cad.data) ? cad.data[0] ?? null : cad.data) } })
    })

    // ── resumen ejecutivo ──
    app.get('/v1/indicadores/resumen', async c => {
      const k = c.get('clave') as Clave
      if (!tieneAlcance(k, 'finanzas', 'leer')) return c.json({ error: 'La clave no tiene el alcance finanzas:leer', codigo: 'sin_alcance' }, 403)
      const t = k.tenant_id; const hoy = new Date(); const mes = hoy.toISOString().slice(0, 7) + '-01'
      const [proy, oc, cxp, pagos, cajas, cartas] = await Promise.all([
        admin.from('proyectos').select('estado').eq('tenant_id', t),
        admin.from('ordenes_compra').select('total, moneda, tipo_cambio, estado').eq('tenant_id', t).gte('fecha_emision', mes).in('estado', ['aprobada', 'en_ejecucion', 'completada', 'recibida']),
        todo(d => admin.from('v_cxp').select('monto_pendiente, vencido, moneda, tc_aplicado').eq('tenant_id', t).neq('estado_pago', 'PAGADO').range(d, d + 999)),
        todo(d => admin.from('transacciones').select('monto_soles, monto, moneda, tipo_cambio, tipo').eq('tenant_id', t).eq('estado', 'pagada').gte('fecha_pago', mes).range(d, d + 999)),
        admin.from('cajas_chicas').select('nombre, monto_disponible, moneda').eq('tenant_id', t).eq('estado', 'activo'),
        admin.from('v_correspondencia').select('estado, vencida').eq('tenant_id', t).eq('estado', 'pendiente'),
      ])
      const soles = (m: number, mon: string | null, tc: number | null) => mon === 'USD' ? m * (tc ?? 1) : m
      const porEstado: Record<string, number> = {}
      for (const p of proy.data ?? []) porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1
      const ocMes = (oc.data ?? []).reduce((s, o) => s + soles(Number(o.total ?? 0), o.moneda, Number(o.tipo_cambio ?? 1)), 0)
      const cxpPend = (cxp.data ?? []).reduce((s, x) => s + soles(Number(x.monto_pendiente ?? 0), x.moneda, Number(x.tc_aplicado ?? 1)), 0)
      const cxpVenc = (cxp.data ?? []).filter(x => x.vencido).reduce((s, x) => s + soles(Number(x.monto_pendiente ?? 0), x.moneda, Number(x.tc_aplicado ?? 1)), 0)
      const pagosMes = (pagos.data ?? []).filter(x => x.tipo === 'egreso').reduce((s, x) => s + Number(x.monto_soles ?? soles(Number(x.monto ?? 0), x.moneda, Number(x.tipo_cambio ?? 1))), 0)
      const cobrosMes = (pagos.data ?? []).filter(x => x.tipo === 'ingreso').reduce((s, x) => s + Number(x.monto_soles ?? soles(Number(x.monto ?? 0), x.moneda, Number(x.tipo_cambio ?? 1))), 0)
      return c.json({ data: {
        fecha: hoy.toISOString().slice(0, 10), moneda: 'PEN',
        proyectos: { total: proy.data?.length ?? 0, por_estado: porEstado },
        ordenes_compra_mes: { cantidad: oc.data?.length ?? 0, total_soles: Math.round(ocMes * 100) / 100 },
        cuentas_por_pagar: { pendiente_soles: Math.round(cxpPend * 100) / 100, vencida_soles: Math.round(cxpVenc * 100) / 100, compromisos: cxp.data?.length ?? 0 },
        tesoreria_mes: { pagos_soles: Math.round(pagosMes * 100) / 100, cobros_soles: Math.round(cobrosMes * 100) / 100 },
        cajas_chicas: (cajas.data ?? []).map(x => ({ nombre: x.nombre, disponible: Number(x.monto_disponible ?? 0), moneda: x.moneda })),
        correspondencia: { pendientes: cartas.data?.length ?? 0, vencidas: (cartas.data ?? []).filter(x => x.vencida).length },
      } })
    })

    // ── escritura: registrar correspondencia ──
    app.post('/v1/correspondencia', async c => {
      const k = c.get('clave') as Clave
      if (!tieneAlcance(k, 'proyectos', 'escribir')) return c.json({ error: 'La clave no tiene el alcance proyectos:escribir', codigo: 'sin_alcance' }, 403)
      let b: Record<string, unknown>
      try { b = await c.req.json() } catch { return c.json({ error: 'JSON inválido', codigo: 'json' }, 400) }
      const permitidos = ['proyecto_id','hilo_id','etapa','numero_doc','tipo','sentido','emisor','receptor','asunto','fecha_documento','fecha_recepcion','requiere_respuesta','plazo_dias','fecha_limite','responde_a','archivo_url','archivo_nombre','observaciones']
      const fila: Record<string, unknown> = { tenant_id: k.tenant_id, origen_datos: `api:${k.nombre}` }
      for (const p of permitidos) if (b[p] !== undefined) fila[p] = b[p]
      if (!fila.proyecto_id || !String(fila.asunto ?? '').trim()) return c.json({ error: 'proyecto_id y asunto son obligatorios', codigo: 'validacion' }, 422)
      const { data: p } = await admin.from('proyectos').select('id').eq('tenant_id', k.tenant_id).eq('id', String(fila.proyecto_id)).maybeSingle()
      if (!p) return c.json({ error: 'El proyecto no existe en esta empresa', codigo: 'validacion' }, 422)
      const { data, error: e } = await admin.from('correspondencia').insert(fila).select('id, numero_doc, estado, fecha_limite').single()
      if (e) return c.json({ error: e.message, codigo: 'validacion' }, 422)
      return c.json({ data }, 201)
    })

    app.notFound(c => c.json({ error: 'Ruta no encontrada. Vea /v1/docs', codigo: 'no_existe' }, 404))
    return app.fetch(req)
  }),
}

/**
 * LOTE DE PAGO — el detalle, donde pasa todo el circuito.
 *
 *   Compras (lotes_armar): agrega líneas desde Cuentas por pagar o líneas
 *     libres (adelantos, letras), ajusta importes, envía a revisión y luego a
 *     tesorería.
 *   Contabilidad (lotes_validar): revisa el cálculo de detracción y retención
 *     línea por línea, corrige con motivo (única que puede, decisión de Kevin
 *     2026-10-07) y valida.
 *   Tesorería (lotes_pagar): exporta el Excel para el banco, paga en BBVA y
 *     marca cada línea pagada con fecha, cuenta, n.º de operación y voucher.
 *
 * El cálculo nunca se hace aquí: lo hace `lote_pago_recalcular` en la base.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Loader2, Plus, Send, CheckCircle2, Undo2, Banknote, FileSpreadsheet, AlertTriangle, Trash2,
  Pencil, FileText, XCircle, History, Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../ui/dialog';
import { PageNav } from '../../shared/PageNav';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';
import { usePermissions } from '@/lib/rbac/usePermissions';
import {
  cargarLote, cargarItems, cargarCuentas, cargarCodigosDetraccion, cargarBitacora,
  agregarCompromisos, agregarLineaLibre, fijarMonto, quitarLinea, ajustarLinea, deshacerAjuste,
  cambiarEstado, marcarPagada, excluirLinea, subirVoucher, fijarVoucher, urlVoucher, exportarParaBanco,
  ESTADO_LOTE, TIPO_LINEA, RETENCION, dinero, monto2,
  type Lote, type LoteItem, type CuentaBancaria, type CodigoDetraccion, type Bitacora, type RetencionTipo, type TipoLinea,
} from '@/lib/finanzas/lotes-pago';

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as any;
const hoyISO = () => new Date().toISOString().slice(0, 10);
const fechaHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const pct = (t: number | null) => (t == null ? '' : `${(t * 100).toLocaleString('es-PE', { maximumFractionDigits: 2 })} %`);

interface Props { loteId: string; onNavigate?: (r: string) => void }

export function LotePagoDetalle({ loteId, onNavigate }: Props) {
  const { can } = usePermissions();
  const { tenantId } = useAuth();
  const puedeArmar = can('finanzas', 'lotes_armar');
  const puedeValidar = can('finanzas', 'lotes_validar');
  const puedePagar = can('finanzas', 'lotes_pagar');

  const [lote, setLote] = useState<Lote | null>(null);
  const [items, setItems] = useState<LoteItem[]>([]);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [codigos, setCodigos] = useState<CodigoDetraccion[]>([]);
  const [bitacora, setBitacora] = useState<Bitacora[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [montoEdit, setMontoEdit] = useState<Record<string, string>>({});

  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const [libreAbierto, setLibreAbierto] = useState(false);
  const [ajustar, setAjustar] = useState<LoteItem | null>(null);
  const [pagar, setPagar] = useState<LoteItem | null>(null);
  const [motivo, setMotivo] = useState<{ accion: 'devolver' | 'anular' | 'excluir'; item?: LoteItem } | null>(null);
  const [verBitacora, setVerBitacora] = useState(false);

  const recargar = async () => {
    try {
      const [l, i, b] = await Promise.all([cargarLote(loteId), cargarItems(loteId), cargarBitacora(loteId)]);
      setLote(l); setItems(i); setBitacora(b);
    } catch (e) { toast.error((e as Error).message); }
    finally { setCargando(false); }
  };
  useEffect(() => { void recargar(); }, [loteId]);
  useEffect(() => {
    cargarCuentas().then(setCuentas).catch(() => undefined);
    cargarCodigosDetraccion().then(setCodigos).catch(() => undefined);
  }, []);

  const correr = async (fn: () => Promise<unknown>, ok?: string) => {
    setOcupado(true);
    try { await fn(); if (ok) toast.success(ok); await recargar(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  };

  const estado = lote?.estado;
  const enBorrador = estado === 'borrador';
  const enRevision = estado === 'en_revision';
  const vivo = estado && !['pagado', 'conciliado', 'anulado'].includes(estado);
  const totales = useMemo(() => {
    const v = items.filter(i => i.estado !== 'excluida');
    const suma = (m: 'PEN' | 'USD', k: keyof LoteItem) => v.filter(i => i.moneda === m).reduce((s, i) => s + Number(i[k] ?? 0), 0);
    return {
      brutoPen: suma('PEN', 'monto'), brutoUsd: suma('USD', 'monto'),
      detPen: suma('PEN', 'detraccionMonto'), detUsd: suma('USD', 'detraccionMonto'),
      retPen: suma('PEN', 'retencionMonto'), retUsd: suma('USD', 'retencionMonto'),
      netoPen: suma('PEN', 'neto'), netoUsd: suma('USD', 'neto'),
      detSoles: v.reduce((s, i) => s + i.detraccionSoles, 0),
      alertas: v.filter(i => i.alertas.length > 0).length,
    };
  }, [items]);

  const abrirVoucher = async (path: string) => {
    try { const u = await urlVoucher(path); if (u) window.open(u, '_blank'); }
    catch (e) { toast.error((e as Error).message); }
  };

  const subirVoucherDespues = async (item: LoteItem, archivo: File | null) => {
    if (!archivo || !tenantId || !lote) return;
    await correr(async () => {
      const path = await subirVoucher(tenantId, lote.numero, item.id, archivo);
      await fijarVoucher(item.id, path);
    }, 'Voucher adjuntado');
  };

  if (cargando) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin inline" /></div>;
  if (!lote) {
    return (
      <div className="space-y-4">
        <PageNav />
        <p className="text-muted-foreground">Lote no encontrado o sin permiso para verlo.</p>
        <Button variant="outline" onClick={() => onNavigate?.('/finanzas/lotes-pago')}><ArrowLeft className="size-4" /> Volver</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageNav />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => onNavigate?.('/finanzas/lotes-pago')}><ArrowLeft className="size-4" /> Lotes de pago</Button>
          <h2 className="text-2xl font-semibold flex items-center gap-3">
            <Banknote className="size-6" /> {lote.numero}
            <Badge className={ESTADO_LOTE[lote.estado].clase} variant="outline" title={ESTADO_LOTE[lote.estado].ayuda}>{ESTADO_LOTE[lote.estado].label}</Badge>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {lote.fechaPrevistaPago ? `Pago previsto ${new Date(lote.fechaPrevistaPago).toLocaleDateString('es-PE', { timeZone: 'UTC' })}` : 'Sin fecha prevista'}
            {lote.notas ? ` · ${lote.notas}` : ''}
            {lote.estado === 'anulado' && lote.motivoAnulacion ? ` · Anulado: ${lote.motivoAnulacion}` : ''}
          </p>
        </div>

        {/* Acciones según estado y permiso */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setVerBitacora(true)}><History className="size-4" /> Bitácora</Button>
          {items.some(i => i.estado !== 'excluida') && ['validado', 'por_pagar', 'pagado', 'conciliado'].includes(lote.estado) && (
            <Button variant="outline" size="sm" onClick={() => exportarParaBanco(lote, items).catch(e => toast.error((e as Error).message))}>
              <FileSpreadsheet className="size-4" /> Exportar para el banco
            </Button>
          )}
          {enBorrador && puedeArmar && (
            <>
              <Button variant="outline" size="sm" onClick={() => setAgregarAbierto(true)}><Plus className="size-4" /> Desde cuentas por pagar</Button>
              <Button variant="outline" size="sm" onClick={() => setLibreAbierto(true)}><Plus className="size-4" /> Línea libre</Button>
              <Button size="sm" disabled={ocupado || items.length === 0} onClick={() => correr(() => cambiarEstado(lote.id, 'en_revision'), 'Enviado a Contabilidad para validar')}>
                <Send className="size-4" /> Enviar a revisión
              </Button>
            </>
          )}
          {enRevision && puedeValidar && (
            <>
              <Button variant="outline" size="sm" disabled={ocupado} onClick={() => setMotivo({ accion: 'devolver' })}><Undo2 className="size-4" /> Devolver a borrador</Button>
              <Button size="sm" disabled={ocupado} onClick={() => correr(() => cambiarEstado(lote.id, 'validado'), 'Lote validado')}>
                <CheckCircle2 className="size-4" /> Validar
              </Button>
            </>
          )}
          {lote.estado === 'validado' && (puedeArmar || puedeValidar) && (
            <>
              <Button variant="outline" size="sm" disabled={ocupado} onClick={() => setMotivo({ accion: 'devolver' })}><Undo2 className="size-4" /> Devolver</Button>
              <Button size="sm" disabled={ocupado} onClick={() => correr(() => cambiarEstado(lote.id, 'por_pagar'), 'Enviado a Tesorería')}>
                <Send className="size-4" /> Enviar a tesorería
              </Button>
            </>
          )}
          {vivo && (puedeArmar || puedeValidar) && lote.estado !== 'por_pagar' && (
            <Button variant="ghost" size="sm" className="text-red-600" disabled={ocupado} onClick={() => setMotivo({ accion: 'anular' })}><XCircle className="size-4" /> Anular</Button>
          )}
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Resumen titulo="Importe bruto" pen={totales.brutoPen} usd={totales.brutoUsd} />
        <Resumen titulo="Detracción (sobre el total de la factura)" pen={totales.detPen} usd={totales.detUsd} nota={totales.detSoles ? `Depósito BN: ${dinero(totales.detSoles, 'PEN')}` : undefined} />
        <Resumen titulo="Retención" pen={totales.retPen} usd={totales.retUsd} />
        <Resumen titulo="NETO A TRANSFERIR" pen={totales.netoPen} usd={totales.netoUsd} destacado />
        <Card className={totales.alertas ? 'border-amber-300/70' : ''}><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Líneas con alertas</p>
          <p className={`text-xl font-bold ${totales.alertas ? 'text-amber-700 dark:text-amber-300' : ''}`}>{totales.alertas} <span className="text-sm font-normal text-muted-foreground">de {items.filter(i => i.estado !== 'excluida').length}</span></p>
          <p className="text-xs text-muted-foreground">Las alertas no bloquean; avisan.</p>
        </CardContent></Card>
      </div>

      {/* Quién hizo qué */}
      <Card><CardContent className="p-3 text-xs text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
        <span>Creado {fechaHora(lote.creadoEn)}{lote.creadoPorEmail ? ` · ${lote.creadoPorEmail}` : ''}</span>
        {lote.enviadoRevisionEn && <span>A revisión {fechaHora(lote.enviadoRevisionEn)}</span>}
        {lote.validadoEn && <span>Validado {fechaHora(lote.validadoEn)}{lote.validadoPorEmail ? ` · ${lote.validadoPorEmail}` : ''}</span>}
        {lote.enviadoTesoreriaEn && <span>A tesorería {fechaHora(lote.enviadoTesoreriaEn)}</span>}
        {lote.pagadoEn && <span>Pagado {fechaHora(lote.pagadoEn)}</span>}
        {lote.anuladoEn && <span>Anulado {fechaHora(lote.anuladoEn)}</span>}
      </CardContent></Card>

      {/* Líneas */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Líneas ({items.length})</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b bg-muted/30">
              <tr>
                <th className="text-left font-medium px-3 py-2">#</th>
                <th className="text-left font-medium px-3 py-2">Proveedor</th>
                <th className="text-left font-medium px-3 py-2">Concepto / documento</th>
                <th className="text-left font-medium px-3 py-2">Proyecto</th>
                <th className="text-left font-medium px-3 py-2">Cuenta destino</th>
                <th className="text-right font-medium px-3 py-2">Importe</th>
                <th className="text-right font-medium px-3 py-2">Detracción</th>
                <th className="text-right font-medium px-3 py-2">Retención</th>
                <th className="text-right font-medium px-3 py-2">Neto</th>
                <th className="text-left font-medium px-3 py-2">Pago</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(i => {
                const excluida = i.estado === 'excluida';
                const editMonto = montoEdit[i.id];
                return (
                  <FilaConAlertas key={i.id} alertas={excluida ? [] : i.alertas} ajuste={i.ajustado ? `Corregido por ${i.ajustadoPorEmail ?? 'Contabilidad'}: ${i.ajusteMotivo ?? ''}` : null} exclusion={excluida ? i.motivoExclusion : null}>
                    <td className={`px-3 py-2 tabular-nums ${excluida ? 'text-muted-foreground line-through' : ''}`}>{i.orden}</td>
                    <td className="px-3 py-2 max-w-[220px]">
                      <div className={`truncate font-medium ${excluida ? 'line-through text-muted-foreground' : ''}`} title={i.proveedor ?? ''}>{i.proveedor ?? <span className="text-amber-700">Sin proveedor</span>}</div>
                      <div className="text-xs text-muted-foreground">{i.ruc ?? ''} <Badge variant="outline" className="ml-1 text-[10px]">{TIPO_LINEA[i.tipoLinea]}</Badge></div>
                    </td>
                    <td className="px-3 py-2 max-w-[260px]">
                      <div className="truncate" title={i.concepto ?? ''}>{i.concepto ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{i.comprobanteNumero ?? i.referenciaDoc ?? 'sin documento'}{i.comprobanteTotal != null ? ` · total ${dinero(i.comprobanteTotal, i.moneda)}` : ''}</div>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{i.proyectoCodigo ?? ''}{i.cdc ? <div className="text-muted-foreground">{i.cdc}</div> : null}</td>
                    <td className="px-3 py-2 text-xs">
                      {i.cuenta ? (
                        <>
                          <div>{i.banco ?? ''} <span className="text-muted-foreground">({i.monedaCuenta ?? '?'})</span></div>
                          <div className="tabular-nums">{i.cuenta}</div>
                          {i.cci && <div className="tabular-nums text-muted-foreground">CCI {i.cci}</div>}
                        </>
                      ) : <span className="text-amber-700">Sin cuenta</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {enBorrador && puedeArmar && !excluida ? (
                        editMonto != null ? (
                          <span className="inline-flex gap-1">
                            <Input className="h-8 w-[120px] text-right" value={editMonto} onChange={e => setMontoEdit(p => ({ ...p, [i.id]: e.target.value }))} />
                            <Button size="sm" onClick={() => correr(() => fijarMonto(i.id, Number(editMonto.replace(/,/g, ''))), 'Importe actualizado').then(() => setMontoEdit(p => { const n = { ...p }; delete n[i.id]; return n; }))}>OK</Button>
                          </span>
                        ) : (
                          <button className="hover:underline" title="Cambiar importe (pago parcial)" onClick={() => setMontoEdit(p => ({ ...p, [i.id]: String(i.monto) }))}>{dinero(i.monto, i.moneda)} <Pencil className="size-3 inline" /></button>
                        )
                      ) : dinero(i.monto, i.moneda)}
                      {i.moneda === 'USD' && <div className="text-[11px] text-muted-foreground">TC {i.tc}</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {i.detraccionAplica ? (
                        <>
                          <div>{dinero(i.detraccionMonto, i.moneda)}</div>
                          <div className="text-[11px] text-muted-foreground" title={i.detraccionDescripcion ?? ''}>{i.detraccionCodigo} · {pct(i.detraccionTasa)}{i.moneda === 'USD' ? ` · S/ ${monto2(i.detraccionSoles)}` : ''}</div>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {i.retencionTipo !== 'ninguna' ? (
                        <>
                          <div>{dinero(i.retencionMonto, i.moneda)}</div>
                          <div className="text-[11px] text-muted-foreground">{RETENCION[i.retencionTipo]}</div>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap font-semibold ${excluida ? 'line-through text-muted-foreground' : ''}`}>{dinero(i.neto, i.moneda)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {i.estado === 'pagada' ? (
                        <>
                          <div className="text-green-700 dark:text-green-300 font-medium">Pagada {i.fechaPago ? new Date(i.fechaPago).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : ''}</div>
                          <div className="text-muted-foreground">{i.cuentaOrigenNombre ?? ''} · op. {i.numeroOperacion ?? '—'}</div>
                          {i.voucherPath ? (
                            <button className="underline text-primary inline-flex items-center gap-1" onClick={() => abrirVoucher(i.voucherPath!)}><FileText className="size-3" /> Voucher</button>
                          ) : puedePagar ? (
                            <label className="underline cursor-pointer inline-flex items-center gap-1"><Paperclip className="size-3" /> Adjuntar voucher
                              <input type="file" className="hidden" accept=".pdf,image/*" onChange={e => subirVoucherDespues(i, e.target.files?.[0] ?? null)} />
                            </label>
                          ) : null}
                        </>
                      ) : excluida ? <span className="text-muted-foreground">Excluida</span> : <span className="text-muted-foreground">Pendiente</span>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {enBorrador && puedeArmar && (
                        <Button size="icon" variant="ghost" title="Quitar del lote" disabled={ocupado} onClick={() => correr(() => quitarLinea(i.id), 'Línea quitada')}><Trash2 className="size-4" /></Button>
                      )}
                      {(enBorrador || enRevision) && puedeValidar && !excluida && (
                        <>
                          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => setAjustar(i)}>Corregir</Button>
                          {i.ajustado && <Button size="sm" variant="ghost" title="Volver al cálculo automático" disabled={ocupado} onClick={() => correr(() => deshacerAjuste(i.id), 'Corrección deshecha')}><Undo2 className="size-4" /></Button>}
                        </>
                      )}
                      {lote.estado === 'por_pagar' && puedePagar && i.estado === 'pendiente' && (
                        <>
                          <Button size="sm" disabled={ocupado} onClick={() => setPagar(i)}>Marcar pagada</Button>
                          <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setMotivo({ accion: 'excluir', item: i })}>Excluir</Button>
                        </>
                      )}
                      {lote.estado === 'validado' && (puedeArmar || puedePagar) && i.estado === 'pendiente' && (
                        <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setMotivo({ accion: 'excluir', item: i })}>Excluir</Button>
                      )}
                    </td>
                  </FilaConAlertas>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                  Sin líneas. {enBorrador && puedeArmar ? 'Agrega facturas o compromisos desde Cuentas por pagar, o una línea libre.' : ''}
                </td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {agregarAbierto && <AgregarDesdeCxP loteId={lote.id} yaEnLote={new Set(items.map(i => i.compromisoId).filter(Boolean) as string[])} onClose={() => setAgregarAbierto(false)} onAgregado={recargar} />}
      {libreAbierto && <LineaLibre loteId={lote.id} onClose={() => setLibreAbierto(false)} onAgregado={recargar} />}
      {ajustar && <AjustarLinea item={ajustar} codigos={codigos} onClose={() => setAjustar(null)} onHecho={recargar} />}
      {pagar && tenantId && <PagarLinea item={pagar} lote={lote} tenantId={tenantId} cuentas={cuentas} onClose={() => setPagar(null)} onHecho={recargar} />}
      {motivo && (
        <MotivoDialog
          titulo={motivo.accion === 'anular' ? 'Anular el lote' : motivo.accion === 'devolver' ? 'Devolver a borrador' : `Excluir línea ${motivo.item?.orden ?? ''}`}
          descripcion={motivo.accion === 'anular' ? 'El lote queda anulado y sus líneas vuelven a estar disponibles en Cuentas por pagar.' : motivo.accion === 'devolver' ? 'Compras recibirá el aviso con tu motivo.' : 'La línea no se paga en este lote; vuelve a Cuentas por pagar.'}
          onClose={() => setMotivo(null)}
          onConfirmar={async (texto) => {
            const m = motivo; setMotivo(null);
            if (m.accion === 'anular') await correr(() => cambiarEstado(lote.id, 'anulado', texto), 'Lote anulado');
            else if (m.accion === 'devolver') await correr(() => cambiarEstado(lote.id, 'borrador', texto), 'Devuelto a borrador');
            else if (m.item) await correr(() => excluirLinea(m.item!.id, texto), 'Línea excluida');
          }}
        />
      )}
      {verBitacora && (
        <Dialog open onOpenChange={(o: boolean) => { if (!o) setVerBitacora(false); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Bitácora de {lote.numero}</DialogTitle></DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto divide-y text-sm">
              {bitacora.map(b => (
                <div key={b.id} className="py-2">
                  <div className="flex justify-between gap-2"><span className="font-medium">{b.accion}</span><span className="text-xs text-muted-foreground">{fechaHora(b.creadoEn)}</span></div>
                  {b.detalle && <div className="text-xs text-muted-foreground break-words">{resumenDetalle(b.detalle)}</div>}
                </div>
              ))}
              {bitacora.length === 0 && <p className="text-muted-foreground py-4">Sin movimientos.</p>}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function resumenDetalle(d: Record<string, unknown>): string {
  return Object.entries(d).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ');
}

function Resumen({ titulo, pen, usd, nota, destacado }: { titulo: string; pen: number; usd: number; nota?: string; destacado?: boolean }) {
  return (
    <Card className={destacado ? 'border-primary/60' : ''}><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`font-bold tabular-nums ${destacado ? 'text-xl' : 'text-lg'}`}>{dinero(pen, 'PEN')}</p>
      <p className={`font-semibold tabular-nums ${destacado ? 'text-lg' : 'text-base'} text-muted-foreground`}>{dinero(usd, 'USD')}</p>
      {nota && <p className="text-xs text-muted-foreground mt-1">{nota}</p>}
    </CardContent></Card>
  );
}

/** Fila de la tabla más, debajo, sus alertas, su corrección o su exclusión. */
function FilaConAlertas({ children, alertas, ajuste, exclusion }: { children: React.ReactNode; alertas: string[]; ajuste: string | null; exclusion: string | null }) {
  const hay = alertas.length > 0 || ajuste || exclusion;
  return (
    <>
      <tr className={hay ? 'border-b-0' : ''}>{children}</tr>
      {hay && (
        <tr className="bg-muted/20">
          <td></td>
          <td colSpan={10} className="px-3 pb-2 pt-0 text-xs space-y-0.5">
            {alertas.map((a, k) => <div key={k} className="text-amber-700 dark:text-amber-300 flex items-start gap-1"><AlertTriangle className="size-3 mt-0.5 shrink-0" /> {a}</div>)}
            {ajuste && <div className="text-blue-700 dark:text-blue-300 flex items-start gap-1"><Pencil className="size-3 mt-0.5 shrink-0" /> {ajuste}</div>}
            {exclusion && <div className="text-muted-foreground">Excluida: {exclusion}</div>}
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Agregar desde Cuentas por pagar ─────────────────────────────────────── */
interface CxpFila { id: string; proveedor: string; concepto: string; referencia: string; moneda: string; pendiente: number; vence: string | null; origen: string; proyectoId: string | null; area: string; vencido: boolean }

function AgregarDesdeCxP({ loteId, yaEnLote, onClose, onAgregado }: { loteId: string; yaEnLote: Set<string>; onClose: () => void; onAgregado: () => Promise<void> }) {
  const [filas, setFilas] = useState<CxpFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [origenes, setOrigenes] = useState<Set<string>>(new Set(['real', 'comprometido']));
  const [venceHasta, setVenceHasta] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await db.from('v_cxp')
        .select('id, proveedor, concepto, referencia_doc, moneda, monto_pendiente, vence, origen, proyecto_id, area, vencido')
        .eq('pagado', false).gt('monto_pendiente', 0)
        .order('vence', { ascending: true, nullsFirst: false }).limit(2000);
      if (error) toast.error(error.message);
      setFilas(((data ?? []) as Record<string, any>[]).filter(r => !yaEnLote.has(r.id)).map(r => ({
        id: r.id, proveedor: r.proveedor ?? '', concepto: r.concepto ?? '', referencia: r.referencia_doc ?? '', moneda: r.moneda ?? 'PEN',
        pendiente: Number(r.monto_pendiente ?? 0), vence: r.vence ?? null, origen: r.origen ?? 'proyectado', proyectoId: r.proyecto_id ?? null, area: r.area ?? '', vencido: Boolean(r.vencido),
      })));
      setCargando(false);
    })();
  }, [yaEnLote]);

  const visibles = useMemo(() => filas.filter(f => {
    if (!origenes.has(f.origen)) return false;
    if (venceHasta && f.vence && f.vence > venceHasta) return false;
    if (busqueda.trim()) {
      const t = busqueda.trim().toLowerCase();
      if (!`${f.proveedor} ${f.concepto} ${f.referencia} ${f.area}`.toLowerCase().includes(t)) return false;
    }
    return true;
  }).slice(0, 400), [filas, origenes, venceHasta, busqueda]);

  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const agregar = async () => {
    setOcupado(true);
    try {
      const n = await agregarCompromisos(loteId, Array.from(sel));
      toast.success(`${n} línea(s) agregada(s)`);
      await onAgregado(); onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  };
  const totalSel = useMemo(() => {
    const t = { PEN: 0, USD: 0 } as Record<string, number>;
    for (const f of filas) if (sel.has(f.id)) t[f.moneda === 'USD' ? 'USD' : 'PEN'] += f.pendiente;
    return t;
  }, [filas, sel]);

  return (
    <Dialog open onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Agregar desde Cuentas por pagar</DialogTitle>
          <DialogDescription>Marca lo que entra en este lote. El importe es el saldo pendiente; luego puedes bajarlo para un pago parcial.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 items-center">
          {[['real', 'Con factura'], ['comprometido', 'Con OC'], ['proyectado', 'Proyectado (Excel)']].map(([k, l]) => (
            <Button key={k} size="sm" variant={origenes.has(k) ? 'default' : 'outline'} onClick={() => setOrigenes(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; })}>{l}</Button>
          ))}
          <label className="text-sm flex items-center gap-1">Vence hasta <Input type="date" className="h-8 w-[150px]" value={venceHasta} onChange={e => setVenceHasta(e.target.value)} /></label>
          <Input className="h-8 flex-1 min-w-[200px]" placeholder="Buscar proveedor, concepto, factura, OC…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <div className="max-h-[50vh] overflow-y-auto border rounded-md">
          {cargando ? <div className="p-6 text-center"><Loader2 className="size-5 animate-spin inline" /></div> : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/30 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5"><input type="checkbox" checked={visibles.length > 0 && visibles.every(v => sel.has(v.id))} onChange={e => setSel(e.target.checked ? new Set([...sel, ...visibles.map(v => v.id)]) : new Set([...sel].filter(id => !visibles.some(v => v.id === id))))} /></th>
                  <th className="text-left font-medium px-2 py-1.5">Vence</th>
                  <th className="text-left font-medium px-2 py-1.5">Proveedor</th>
                  <th className="text-left font-medium px-2 py-1.5">Concepto</th>
                  <th className="text-left font-medium px-2 py-1.5">Doc.</th>
                  <th className="text-left font-medium px-2 py-1.5">Origen</th>
                  <th className="text-right font-medium px-2 py-1.5">Pendiente</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibles.map(f => (
                  <tr key={f.id} className={`cursor-pointer hover:bg-muted/30 ${sel.has(f.id) ? 'bg-primary/5' : ''}`} onClick={() => toggle(f.id)}>
                    <td className="px-2 py-1.5"><input type="checkbox" checked={sel.has(f.id)} onChange={() => toggle(f.id)} onClick={e => e.stopPropagation()} /></td>
                    <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{f.vence ?? '—'}{f.vencido && <Badge variant="destructive" className="ml-1 text-[10px]">vencido</Badge>}</td>
                    <td className="px-2 py-1.5 max-w-[200px] truncate" title={f.proveedor}>{f.proveedor || '—'}</td>
                    <td className="px-2 py-1.5 max-w-[260px] truncate" title={f.concepto}>{f.concepto}</td>
                    <td className="px-2 py-1.5 text-xs whitespace-nowrap">{f.referencia}</td>
                    <td className="px-2 py-1.5"><Badge variant={f.origen === 'real' ? 'default' : f.origen === 'comprometido' ? 'secondary' : 'outline'} className="text-[10px]">{f.origen === 'real' ? 'Factura' : f.origen === 'comprometido' ? 'OC' : 'Proy.'}</Badge></td>
                    <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{dinero(f.pendiente, f.moneda)}</td>
                  </tr>
                ))}
                {visibles.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nada pendiente con estos filtros.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        <DialogFooter className="items-center">
          <span className="text-sm text-muted-foreground mr-auto">{sel.size} seleccionada(s) · {dinero(totalSel.PEN, 'PEN')} · {dinero(totalSel.USD, 'USD')}</span>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={sel.size === 0 || ocupado} onClick={agregar}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : `Agregar ${sel.size}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Línea libre (adelanto, letra, sin comprobante) ──────────────────────── */
function LineaLibre({ loteId, onClose, onAgregado }: { loteId: string; onClose: () => void; onAgregado: () => Promise<void> }) {
  const [proveedores, setProveedores] = useState<{ id: string; nombre: string; codigo: string; ruc: string }[]>([]);
  const [proyectos, setProyectos] = useState<{ id: string; codigo: string }[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [concepto, setConcepto] = useState('');
  const [tipo, setTipo] = useState<TipoLinea>('adelanto');
  const [referencia, setReferencia] = useState('');
  const [proyectoId, setProyectoId] = useState('');
  const [ocNumero, setOcNumero] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    supabase.from('proveedores').select('id, razon_social, codigo, ruc').order('razon_social').limit(1000)
      .then(({ data }) => setProveedores(((data ?? []) as Record<string, any>[]).map(p => ({ id: p.id, nombre: p.razon_social, codigo: p.codigo, ruc: p.ruc ?? '' }))));
    supabase.from('proyectos').select('id, codigo').order('codigo').then(({ data }) => setProyectos((data ?? []) as { id: string; codigo: string }[]));
  }, []);
  const candidatos = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return (t ? proveedores.filter(p => `${p.nombre} ${p.codigo} ${p.ruc}`.toLowerCase().includes(t)) : proveedores).slice(0, 50);
  }, [proveedores, busqueda]);

  const agregar = async () => {
    const m = Number(monto.replace(/,/g, ''));
    if (!proveedorId) { toast.error('Elige el proveedor'); return; }
    if (!Number.isFinite(m) || m <= 0) { toast.error('Importe inválido'); return; }
    if (!concepto.trim()) { toast.error('Escribe el concepto'); return; }
    setOcupado(true);
    try {
      let ocId: string | null = null;
      if (ocNumero.trim()) {
        const { data } = await supabase.from('ordenes_compra').select('id').eq('numero', ocNumero.trim()).maybeSingle();
        if (!data) { toast.error(`No existe la OC ${ocNumero.trim()}`); setOcupado(false); return; }
        ocId = (data as { id: string }).id;
      }
      await agregarLineaLibre({ loteId, proveedorId, monto: m, moneda, concepto: concepto.trim(), tipoLinea: tipo, ordenCompraId: ocId, proyectoId: proyectoId || null, referencia: referencia.trim() || null });
      toast.success('Línea agregada');
      await onAgregado(); onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  };

  return (
    <Dialog open onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Línea libre</DialogTitle>
          <DialogDescription>Para adelantos, letras o pagos sin comprobante. Queda marcada como pago a cuenta hasta que Contabilidad la cierre contra la factura.</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-sm">Proveedor</label>
            <Input className="mt-1" placeholder="Buscar por nombre, código o RUC" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={proveedorId} onChange={e => setProveedorId(e.target.value)} size={Math.min(6, Math.max(2, candidatos.length))}>
              {candidatos.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}{p.ruc ? ` · ${p.ruc}` : ''}</option>)}
            </select>
          </div>
          <label className="text-sm">Tipo
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={tipo} onChange={e => setTipo(e.target.value as TipoLinea)}>
              <option value="adelanto">Adelanto</option><option value="letra">Letra</option><option value="sin_comprobante">Sin comprobante</option>
            </select>
          </label>
          <label className="text-sm">Moneda
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={moneda} onChange={e => setMoneda(e.target.value as 'PEN' | 'USD')}>
              <option value="PEN">Soles</option><option value="USD">Dólares</option>
            </select>
          </label>
          <label className="text-sm">Importe<Input className="mt-1" inputMode="decimal" value={monto} onChange={e => setMonto(e.target.value)} /></label>
          <label className="text-sm">Referencia (letra, contrato…)<Input className="mt-1" value={referencia} onChange={e => setReferencia(e.target.value)} /></label>
          <label className="text-sm sm:col-span-2">Concepto<Input className="mt-1" value={concepto} onChange={e => setConcepto(e.target.value)} /></label>
          <label className="text-sm">Proyecto
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={proyectoId} onChange={e => setProyectoId(e.target.value)}>
              <option value="">(el de la OC, si hay)</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo}</option>)}
            </select>
          </label>
          <label className="text-sm">N.º de OC (opcional)<Input className="mt-1" placeholder="MM-000123" value={ocNumero} onChange={e => setOcNumero(e.target.value)} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={ocupado} onClick={agregar}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : 'Agregar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Corrección de Contabilidad ──────────────────────────────────────────── */
function AjustarLinea({ item, codigos, onClose, onHecho }: { item: LoteItem; codigos: CodigoDetraccion[]; onClose: () => void; onHecho: () => Promise<void> }) {
  const [aplica, setAplica] = useState(item.detraccionAplica);
  const [codigo, setCodigo] = useState(item.detraccionCodigo ?? '037');
  const [tasa, setTasa] = useState(item.detraccionTasa != null ? String(item.detraccionTasa * 100) : '');
  const [retencion, setRetencion] = useState<RetencionTipo>(item.retencionTipo);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { const c = codigos.find(x => x.codigo === codigo); if (c && aplica) setTasa(String(c.tasa * 100)); }, [codigo, codigos, aplica]);

  const guardar = async () => {
    if (motivo.trim().length < 10) { toast.error('Escribe el motivo (mínimo 10 caracteres)'); return; }
    const t = tasa ? Number(tasa.replace(',', '.')) / 100 : null;
    setOcupado(true);
    try {
      await ajustarLinea({ itemId: item.id, detraccionAplica: aplica, detraccionCodigo: aplica ? codigo : null, detraccionTasa: aplica ? t : null, retencionTipo: retencion, motivo: motivo.trim() });
      toast.success('Línea corregida'); await onHecho(); onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  };

  return (
    <Dialog open onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corregir línea {item.orden} · {item.proveedor}</DialogTitle>
          <DialogDescription>Solo Contabilidad corrige. El cambio queda en la bitácora con tu motivo y el cálculo automático deja de aplicarse a esta línea.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={aplica} onChange={e => setAplica(e.target.checked)} /> Aplica detracción</label>
          {aplica && (
            <div className="grid grid-cols-3 gap-2">
              <label className="text-sm col-span-2">Código SUNAT
                <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={codigo} onChange={e => setCodigo(e.target.value)}>
                  {codigos.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.descripcion} ({(c.tasa * 100).toLocaleString('es-PE')} %)</option>)}
                </select>
              </label>
              <label className="text-sm">Tasa %<Input className="mt-1" value={tasa} onChange={e => setTasa(e.target.value)} /></label>
            </div>
          )}
          <label className="text-sm block">Retención
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={retencion} onChange={e => setRetencion(e.target.value as RetencionTipo)} disabled={aplica}>
              <option value="ninguna">Sin retención</option><option value="igv">IGV 3 % (agente de retención)</option><option value="cuarta">4ta categoría 8 % (recibo por honorarios)</option>
            </select>
            {aplica && <span className="text-xs text-muted-foreground">Con detracción no hay retención del IGV.</span>}
          </label>
          <label className="text-sm block">Motivo<Textarea className="mt-1" rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. la factura es por servicio de mantenimiento (020), no 037" /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={ocupado} onClick={guardar}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : 'Guardar corrección'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Tesorería: marcar pagada ────────────────────────────────────────────── */
function PagarLinea({ item, lote, tenantId, cuentas, onClose, onHecho }: { item: LoteItem; lote: Lote; tenantId: string; cuentas: CuentaBancaria[]; onClose: () => void; onHecho: () => Promise<void> }) {
  const opciones = cuentas.filter(c => c.activa && c.tipo !== 'detracciones' && c.moneda === item.moneda);
  const [fecha, setFecha] = useState(hoyISO());
  const [cuentaId, setCuentaId] = useState(opciones[0]?.id ?? '');
  const [operacion, setOperacion] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [notas, setNotas] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const confirmar = async () => {
    if (!cuentaId) { toast.error('Elige la cuenta de origen'); return; }
    if (!operacion.trim()) { toast.error('Escribe el número de operación del banco'); return; }
    setOcupado(true);
    try {
      const path = archivo ? await subirVoucher(tenantId, lote.numero, item.id, archivo) : null;
      await marcarPagada({ itemId: item.id, fecha, cuentaId, numeroOperacion: operacion.trim(), voucherPath: path, notas: notas.trim() || null });
      toast.success('Pago registrado'); await onHecho(); onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setOcupado(false); }
  };

  return (
    <Dialog open onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar pagada · línea {item.orden}</DialogTitle>
          <DialogDescription>
            {item.proveedor} · transferir <b>{dinero(item.neto, item.moneda)}</b> a {item.banco ?? ''} {item.cuenta ?? ''}{item.cci ? ` (CCI ${item.cci})` : ''}.
            {item.detraccionAplica && ` Además, depósito de detracción de S/ ${monto2(item.detraccionSoles)} al Banco de la Nación${item.cuentaDetraccion ? ` (cta. ${item.cuentaDetraccion})` : ''}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Fecha del pago<Input type="date" className="mt-1" value={fecha} onChange={e => setFecha(e.target.value)} /></label>
          <label className="text-sm">Cuenta de origen
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={cuentaId} onChange={e => setCuentaId(e.target.value)}>
              {opciones.length === 0 && <option value="">Sin cuenta en {item.moneda}</option>}
              {opciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm col-span-2">N.º de operación del banco<Input className="mt-1" value={operacion} onChange={e => setOperacion(e.target.value)} placeholder="Tal como aparece en el voucher" /></label>
          <label className="text-sm col-span-2">Voucher (PDF o imagen)<Input type="file" className="mt-1" accept=".pdf,image/*" onChange={e => setArchivo(e.target.files?.[0] ?? null)} /></label>
          <label className="text-sm col-span-2">Notas<Input className="mt-1" value={notas} onChange={e => setNotas(e.target.value)} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={ocupado} onClick={confirmar}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : 'Registrar pago'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MotivoDialog({ titulo, descripcion, onClose, onConfirmar }: { titulo: string; descripcion: string; onClose: () => void; onConfirmar: (motivo: string) => Promise<void> }) {
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  return (
    <Dialog open onOpenChange={(o: boolean) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{titulo}</DialogTitle><DialogDescription>{descripcion}</DialogDescription></DialogHeader>
        <Textarea rows={3} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Motivo" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={ocupado || texto.trim().length < 5} onClick={async () => { setOcupado(true); await onConfirmar(texto.trim()); setOcupado(false); }}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

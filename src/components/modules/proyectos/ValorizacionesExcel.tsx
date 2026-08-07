/**
 * ValorizacionesExcel — Valorizaciones que vienen del Excel RESUMEN PROYECTOS (N27 punto 9).
 *
 * Solo LECTURA: es el espejo del bloque VALORIZACIONES de la hoja del proyecto.
 * No se mezcla con las valorizaciones propias del ERP (que tienen estados y
 * flujo de conformidad) para no pisar información de ninguna de las dos fuentes.
 * El enlace hoja↔proyecto es por CIU (codigo_inversion).
 */
import { useEffect, useState } from 'react';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../ui/table';
import { supabase } from '../../../lib/supabase/client';

interface Props {
  /** CIU del proyecto (proyectos.codigo_inversion) */
  codigoInversion?: string;
  moneda?: string;
}

interface ValoExcel {
  numero: string;
  fecha: string | null;
  fecha_texto: string | null;
  importe: number | null;
}

const fmt = (n: number, moneda = 'PEN') =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda, minimumFractionDigits: 2 }).format(n);

const fmtFecha = (iso: string) => {
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('es-PE', { month: 'short', year: 'numeric' }); }
  catch { return iso; }
};

export function ValorizacionesExcel({ codigoInversion, moneda = 'PEN' }: Props) {
  const [valos, setValos] = useState<ValoExcel[]>([]);
  const [hoja, setHoja] = useState<string | null>(null);
  const [sincronizado, setSincronizado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    if (!codigoInversion) { setCargando(false); return; }
    (async () => {
      const { data } = await supabase
        .from('proyectos_excel_sync')
        .select('hoja, datos_raw, sincronizado_en')
        .eq('ciu', String(codigoInversion).trim())
        .like('hoja', '#%')          // solo las hojas de detalle oficiales
        .limit(1)
        .maybeSingle();
      if (!vivo) return;
      const lista = ((data as any)?.datos_raw?.valorizaciones ?? []) as ValoExcel[];
      setValos(lista);
      setHoja((data as any)?.hoja ?? null);
      setSincronizado((data as any)?.sincronizado_en ?? null);
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [codigoInversion]);

  // Sin CIU o sin datos: no ocupar espacio con una tarjeta vacía
  if (!codigoInversion || (!cargando && valos.length === 0)) return null;

  const total = valos.reduce((s, v) => s + (v.importe ?? 0), 0);
  const conImporte = valos.filter(v => (v.importe ?? 0) > 0).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="size-4" /> Valorizaciones del Excel
              <Badge variant="outline" className="font-normal">solo lectura</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Del archivo RESUMEN PROYECTOS{hoja ? ` · hoja ${hoja}` : ''}. Se actualiza al
              pulsar "Sincronizar ahora" en el Espejo Excel.
            </p>
          </div>
          {sincronizado && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="size-3" />
              {new Date(sincronizado).toLocaleString('es-PE')}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {cargando ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Cargando…</p>
        ) : (
          <>
            <div className="flex gap-6 mb-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Acumulado</p>
                <p className="font-semibold">{fmt(total, moneda)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valorizaciones</p>
                <p className="font-semibold">{conImporte} de {valos.length} con importe</p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Valorización</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {valos.map((v, i) => (
                    <TableRow key={`${v.numero}-${i}`}>
                      <TableCell className="font-medium">{v.numero}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {v.fecha ? fmtFecha(v.fecha) : (v.fecha_texto ?? '—')}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {v.importe != null && v.importe > 0 ? fmt(v.importe, moneda) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Mis pendientes de aprobación (órdenes de compra / servicio).
 *
 * "Pendientes" no es "todas las órdenes enviadas a aprobación": es lo que a
 * ESTA persona le toca firmar, como en el sistema anterior. Una orden le toca
 * a alguien cuando la etapa EN TURNO (la primera que su monto exige y aún no
 * tiene firma: comprador → operaciones → gerencia) la puede firmar uno de sus
 * roles. Gerencia, por ejemplo, no ve una orden hasta que Compras y
 * Operaciones firmaron (pedido de William, 2026-10-07). Es la misma regla que
 * usa el detalle de la orden para mostrar "Te toca firmar como …".
 *
 * Las firmas de las órdenes pendientes se leen de `orden_aprobaciones` en una
 * sola consulta (son pocas: solo las enviadas a aprobación).
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import { usePermissions } from '../rbac/usePermissions';
import { useRoles } from '../rbac/roles-store';
import { useFlujoAprobacion } from './flujo-aprobacion-store';
import { etapasRequeridas, puedeFirmarEtapa, etapaEnTurno, type EtapaAprobacion } from './approval-flow';
import type { Orden } from './ordenes-store';

export interface MisPendientesOC {
  /** Todas las órdenes en aprobación (de todos). */
  pendientes: Orden[];
  /** Solo las que me toca firmar. */
  misPendientes: Orden[];
  /** ids (número) de las órdenes que me toca firmar, para filtrar listas. */
  meTocaFirmar: Set<string>;
  /** Para cada orden que me toca, la etapa que firmo (la que está en turno). */
  etapaMia: Map<string, EtapaAprobacion>;
  /** Firmas ya puestas por orden (uuid → etapas firmadas). */
  firmasPorOrden: Map<string, Set<string>>;
  /** Órdenes con solicitud de edición pendiente que me toca resolver (compras.aprobar). */
  edicionesPendientes: Orden[];
}

export function useMisPendientesOC(ordenes: Orden[]): MisPendientesOC {
  const { user } = useAuth();
  const { isAdmin, can } = usePermissions();
  const { usuarios } = useRoles();
  const { config } = useFlujoAprobacion();

  const pendientes = useMemo(
    () => ordenes.filter(o => o.estado === 'pendiente_aprobacion'),
    [ordenes],
  );

  // Clave estable: solo se vuelve a consultar cuando cambia el conjunto de pendientes.
  const claveIds = useMemo(
    () => pendientes.map(o => o._dbId).filter((x): x is string => !!x).sort().join(','),
    [pendientes],
  );

  const [firmasPorOrden, setFirmasPorOrden] = useState<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    if (!claveIds) { setFirmasPorOrden(new Map()); return; }
    let vivo = true;
    (async () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const { data } = await (supabase.from('orden_aprobaciones') as any)
        .select('orden_id, etapa')
        .in('orden_id', claveIds.split(',')) as { data: { orden_id: string; etapa: string }[] | null };
      /* eslint-enable @typescript-eslint/no-explicit-any */
      if (!vivo) return;
      const m = new Map<string, Set<string>>();
      (data ?? []).forEach(f => {
        const set = m.get(f.orden_id) ?? new Set<string>();
        set.add(f.etapa);
        m.set(f.orden_id, set);
      });
      setFirmasPorOrden(m);
    })();
    return () => { vivo = false; };
  }, [claveIds]);

  const misRoles = useMemo(
    () => usuarios.find(u => u.userId === user?.id)?.roles.map(r => r.nombre) ?? [],
    [usuarios, user?.id],
  );

  const etapaMia = useMemo(() => {
    const m = new Map<string, EtapaAprobacion>();
    if (!user) return m;
    pendientes.forEach(o => {
      const etapas = etapasRequeridas(o.total, o.moneda as 'PEN' | 'USD', config);
      const firmadas = firmasPorOrden.get(o._dbId ?? '') ?? new Set<string>();
      const turno = etapaEnTurno(etapas, firmadas);
      if (turno && (isAdmin || puedeFirmarEtapa(misRoles, turno, config))) m.set(o.id, turno);
    });
    return m;
  }, [pendientes, firmasPorOrden, misRoles, isAdmin, config, user]);
  const meTocaFirmar = useMemo(() => new Set(etapaMia.keys()), [etapaMia]);

  const misPendientes = useMemo(
    () => pendientes.filter(o => meTocaFirmar.has(o.id)),
    [pendientes, meTocaFirmar],
  );

  const edicionesPendientes = useMemo(
    () => (isAdmin || can('compras', 'aprobar'))
      ? ordenes.filter(o => o.solicitudEdicion?.estado === 'pendiente')
      : [],
    [ordenes, isAdmin, can],
  );

  return { pendientes, misPendientes, meTocaFirmar, etapaMia, firmasPorOrden, edicionesPendientes };
}

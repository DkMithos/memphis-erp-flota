/**
 * Mis pendientes de aprobación (órdenes de compra / servicio).
 *
 * "Pendientes" no es "todas las órdenes enviadas a aprobación": es lo que a
 * ESTA persona le toca firmar, como en el sistema anterior. Una orden le toca
 * a alguien cuando alguna de las etapas que su monto exige (comprador →
 * operaciones → gerencia) sigue sin firma y uno de sus roles puede firmarla.
 * Es la misma regla que usa el detalle de la orden para mostrar "Te toca
 * firmar como …".
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
import { etapasRequeridas, puedeFirmarEtapa } from './approval-flow';
import type { Orden } from './ordenes-store';

export interface MisPendientesOC {
  /** Todas las órdenes en aprobación (de todos). */
  pendientes: Orden[];
  /** Solo las que me toca firmar. */
  misPendientes: Orden[];
  /** ids (número) de las órdenes que me toca firmar, para filtrar listas. */
  meTocaFirmar: Set<string>;
  /** Firmas ya puestas por orden (uuid → etapas firmadas). */
  firmasPorOrden: Map<string, Set<string>>;
}

export function useMisPendientesOC(ordenes: Orden[]): MisPendientesOC {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
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

  const meTocaFirmar = useMemo(() => {
    const set = new Set<string>();
    if (!user) return set;
    pendientes.forEach(o => {
      const etapas = etapasRequeridas(o.total, o.moneda as 'PEN' | 'USD', config);
      const firmadas = firmasPorOrden.get(o._dbId ?? '') ?? new Set<string>();
      const meToca = etapas.some(e => !firmadas.has(e) && (isAdmin || puedeFirmarEtapa(misRoles, e, config)));
      if (meToca) set.add(o.id);
    });
    return set;
  }, [pendientes, firmasPorOrden, misRoles, isAdmin, config, user]);

  const misPendientes = useMemo(
    () => pendientes.filter(o => meTocaFirmar.has(o.id)),
    [pendientes, meTocaFirmar],
  );

  return { pendientes, misPendientes, meTocaFirmar, firmasPorOrden };
}

import React from 'react';
import { usePermissions } from '../../lib/rbac/usePermissions';
import type { Modulo, Accion } from '../../lib/rbac/usePermissions';

interface Props {
  modulo: Modulo;
  accion: Accion;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({ modulo, accion, fallback = null, children }: Props) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  if (!can(modulo, accion)) return <>{fallback}</>;
  return <>{children}</>;
}

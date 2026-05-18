import React, { useMemo, useState, useEffect } from 'react';
import { useRoles } from '../../../lib/rbac/roles-store';
import type { Rol, UsuarioTenant } from '../../../lib/rbac/roles-store';
import { usePermissions } from '../../../lib/rbac/usePermissions';

import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { toast } from 'sonner';
import { useConfirmAction } from '@/components/shared/ConfirmDialogProvider';
import { Shield, Users, Plus, Pencil, Trash2, UserCog, Layers, ClipboardList, UserPlus, GitBranch, List } from 'lucide-react';
import { usePagination } from '../../../lib/shared/usePagination';
import { supabase } from '../../../lib/supabase/client';
import { useAuth } from '../../../auth/AuthProvider';
import { GestionModulos } from './GestionModulos';
import { AuditLogs } from './AuditLogs';
import { GestionFlujoAprobacion } from './GestionFlujoAprobacion';
import { GestionCatalogos } from './GestionCatalogos';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const MODULOS_ORDEN = [
  'flota',
  'biomedico',
  'compras',
  'proveedores',
  'inventario',
  'finanzas',
  'crm',
  'proyectos',
  'admin',
];

const ACCIONES_ORDEN = [
  'ver',
  'crear',
  'editar',
  'eliminar',
  'aprobar',
  'exportar',
  'gestionar_usuarios',
  'gestionar_roles',
];

// ─────────────────────────────────────────────────────────────
// Estado badge helpers
// ─────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: UsuarioTenant['estado'] }) {
  if (estado === 'activo') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">Activo</Badge>;
  if (estado === 'suspendido') return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100">Suspendido</Badge>;
  return <Badge variant="secondary">Inactivo</Badge>;
}

// ─────────────────────────────────────────────────────────────
// Avatar initials
// ─────────────────────────────────────────────────────────────

function Initials({ nombre }: { nombre: string }) {
  const parts = nombre.trim().split(' ');
  const letters = parts
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
      {letters}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Dialog: Gestionar roles de usuario
// ─────────────────────────────────────────────────────────────

interface GestionarRolesDialogProps {
  usuario: UsuarioTenant | null;
  onClose: () => void;
}

function GestionarRolesDialog({ usuario, onClose }: GestionarRolesDialogProps) {
  const { roles, asignarRol, quitarRol } = useRoles();
  const [saving, setSaving] = useState(false);

  if (!usuario) return null;

  const assignedIds = new Set(usuario.roles.map(r => r._dbId));

  const handleToggle = async (rolDbId: string, checked: boolean) => {
    setSaving(true);
    try {
      if (checked) {
        const result = await asignarRol(usuario.userId, rolDbId);
        if (!result.exito) toast.error('Error al asignar rol');
        else toast.success('Rol asignado');
      } else {
        const result = await quitarRol(usuario.userId, rolDbId);
        if (!result.exito) toast.error('Error al quitar rol');
        else toast.success('Rol removido');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-5" />
            Roles de {usuario.nombre}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {roles.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay roles definidos.</p>
          )}
          {roles.map(rol => (
            <div key={rol._dbId} className="flex items-start gap-3">
              <Checkbox
                id={`rol-${rol._dbId}`}
                checked={assignedIds.has(rol._dbId)}
                disabled={saving}
                onCheckedChange={(checked) => handleToggle(rol._dbId, Boolean(checked))}
              />
              <div>
                <label
                  htmlFor={`rol-${rol._dbId}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {rol.nombre}
                  {rol.esSistema && (
                    <Badge variant="outline" className="ml-2 text-xs">Sistema</Badge>
                  )}
                </label>
                {rol.descripcion && (
                  <p className="text-xs text-muted-foreground">{rol.descripcion}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Dialog: Crear / Editar rol
// ─────────────────────────────────────────────────────────────

interface RolDialogProps {
  rol: Rol | null;  // null = nuevo
  onClose: () => void;
}

function RolDialog({ rol, onClose }: RolDialogProps) {
  const { permisos, crearRol, actualizarRol } = useRoles();

  const [nombre, setNombre] = useState(rol?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? '');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(
    new Set(rol?.permisoIds ?? []),
  );
  const [saving, setSaving] = useState(false);

  // Group permisos by modulo
  const permisosPorModulo = useMemo(() => {
    const map = new Map<string, typeof permisos>();
    for (const p of permisos) {
      if (!map.has(p.modulo)) map.set(p.modulo, []);
      map.get(p.modulo)!.push(p);
    }
    return map;
  }, [permisos]);

  // Sorted modulos that actually have permisos
  const modulosConPermisos = MODULOS_ORDEN.filter(m => permisosPorModulo.has(m));

  const togglePermiso = (id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      toast.error('El nombre del rol es obligatorio');
      return;
    }
    setSaving(true);
    try {
      if (rol) {
        const result = await actualizarRol(rol._dbId, nombre.trim(), descripcion, [...seleccionados]);
        if (result.exito) {
          toast.success('Rol actualizado');
          onClose();
        } else {
          toast.error('Error al actualizar rol');
        }
      } else {
        await crearRol(nombre.trim(), descripcion, [...seleccionados]);
        toast.success('Rol creado');
        onClose();
      }
    } catch {
      toast.error('Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const esSistema = rol?.esSistema ?? false;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            {rol ? (esSistema ? `Permisos: ${rol.nombre}` : 'Editar Rol') : 'Nuevo Rol'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {esSistema && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Este es un rol de sistema. Solo puedes modificar sus permisos asignados, no su nombre ni descripción.
            </div>
          )}

          {/* Nombre */}
          <div className="space-y-1">
            <Label htmlFor="rol-nombre">Nombre *</Label>
            <Input
              id="rol-nombre"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Supervisor de Flota"
              disabled={esSistema}
            />
          </div>

          {/* Descripción */}
          <div className="space-y-1">
            <Label htmlFor="rol-desc">Descripción</Label>
            <Textarea
              id="rol-desc"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Descripción del rol y sus responsabilidades"
              disabled={esSistema}
            />
          </div>

          {/* Permisos por módulo */}
          <div className="space-y-2">
            <Label>Permisos</Label>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Módulo</TableHead>
                    {ACCIONES_ORDEN.map(a => (
                      <TableHead key={a} className="text-center text-xs capitalize px-2">
                        {a.replace('_', ' ')}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modulosConPermisos.map(modulo => {
                    const mPermisos = permisosPorModulo.get(modulo) ?? [];
                    return (
                      <TableRow key={modulo}>
                        <TableCell className="font-medium capitalize text-sm">
                          {modulo}
                        </TableCell>
                        {ACCIONES_ORDEN.map(accion => {
                          const permiso = mPermisos.find(p => p.accion === accion);
                          if (!permiso) {
                            return <TableCell key={accion} className="text-center px-2" />;
                          }
                          return (
                            <TableCell key={accion} className="text-center px-2">
                              <Checkbox
                                checked={seleccionados.has(permiso.id)}
                                onCheckedChange={() => togglePermiso(permiso.id)}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              {seleccionados.size} permiso(s) seleccionado(s)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : rol ? 'Guardar cambios' : 'Crear rol'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Dialog: Nuevo Usuario
// ─────────────────────────────────────────────────────────────

interface NuevoUsuarioDialogProps {
  tenantId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function NuevoUsuarioDialog({ tenantId, onClose, onSuccess }: NuevoUsuarioDialogProps) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [cargo, setCargo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!tenantId || !email || !nombre || !password) {
      setError('Email, nombre y contraseña son obligatorios.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      const userId = data.user?.id;
      if (!userId) throw new Error('No se pudo obtener el ID del nuevo usuario.');
      // Insertar perfil en usuarios_tenant
      const { error: profileError } = await supabase.from('usuarios_tenant').insert({
        tenant_id: tenantId,
        user_id: userId,
        nombre,
        email,
        cargo: cargo || null,
        estado: 'activo',
      });
      if (profileError) throw profileError;
      toast.success('Usuario creado', { description: `Se envió un email de confirmación a ${email}` });
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? 'Error al crear el usuario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Nuevo Usuario
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="nu-nombre">Nombre completo *</Label>
            <Input id="nu-nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan Pérez" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nu-email">Email *</Label>
            <Input id="nu-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nu-password">Contraseña temporal *</Label>
            <Input id="nu-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nu-cargo">Cargo</Label>
            <Input id="nu-cargo" value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ej: Técnico, Supervisor..." />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? 'Creando...' : 'Crear Usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab: Usuarios
// ─────────────────────────────────────────────────────────────

function TabUsuarios() {
  const { usuarios, cambiarEstadoUsuario, reload } = useRoles();
  const { tenantId } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [usuarioGestionando, setUsuarioGestionando] = useState<UsuarioTenant | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [showNuevoUsuario, setShowNuevoUsuario] = useState(false);

  const filtrados = useMemo(() => {
    return usuarios.filter(u => {
      const matchBusqueda =
        busqueda === '' ||
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.email.toLowerCase().includes(busqueda.toLowerCase());
      const matchEstado = filtroEstado === 'todos' || u.estado === filtroEstado;
      return matchBusqueda && matchEstado;
    });
  }, [usuarios, busqueda, filtroEstado]);

  const { paged: usuariosPaged, page, totalPages, setPage } = usePagination(filtrados);
  useEffect(() => { setPage(1); }, [busqueda, filtroEstado]); // eslint-disable-line react-hooks/exhaustive-deps

  const activos = usuarios.filter(u => u.estado === 'activo').length;
  const inactivos = usuarios.filter(u => u.estado === 'inactivo').length;
  const suspendidos = usuarios.filter(u => u.estado === 'suspendido').length;

  const handleCambiarEstado = async (u: UsuarioTenant, nuevoEstado: UsuarioTenant['estado']) => {
    setSaving(u._dbId);
    const result = await cambiarEstadoUsuario(u._dbId, nuevoEstado);
    setSaving(null);
    if (result.exito) toast.success(`Usuario ${nuevoEstado}`);
    else toast.error('Error al cambiar estado');
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{activos}</div>
          <div className="text-sm text-muted-foreground">Activos</div>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-muted-foreground">{inactivos}</div>
          <div className="text-sm text-muted-foreground">Inactivos</div>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{suspendidos}</div>
          <div className="text-sm text-muted-foreground">Suspendidos</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Buscar por nombre o email..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="max-w-xs"
          />
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
              <SelectItem value="suspendido">Suspendido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowNuevoUsuario(true)}>
          <UserPlus className="size-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Tabla */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Cargo / Dpto.</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="w-32">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No se encontraron usuarios
                </TableCell>
              </TableRow>
            )}
            {usuariosPaged.map(u => (
              <TableRow key={u._dbId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Initials nombre={u.nombre} />
                    <div>
                      <div className="font-medium text-sm">{u.nombre}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {u.cargo && <div>{u.cargo}</div>}
                  {u.departamento && (
                    <div className="text-muted-foreground text-xs">{u.departamento}</div>
                  )}
                </TableCell>
                <TableCell>
                  <EstadoBadge estado={u.estado} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map(r => (
                      <Badge key={r._dbId} variant="outline" className="text-xs">
                        {r.nombre}
                      </Badge>
                    ))}
                    {u.roles.length === 0 && (
                      <span className="text-xs text-muted-foreground">Sin rol</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUsuarioGestionando(u)}
                    >
                      <UserCog className="size-3.5" />
                      Roles
                    </Button>
                    {u.estado === 'activo' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={saving === u._dbId}
                        onClick={() => handleCambiarEstado(u, 'inactivo')}
                      >
                        Desactivar
                      </Button>
                    )}
                    {u.estado === 'inactivo' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={saving === u._dbId}
                        onClick={() => handleCambiarEstado(u, 'activo')}
                      >
                        Activar
                      </Button>
                    )}
                    {u.estado !== 'suspendido' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        disabled={saving === u._dbId}
                        onClick={() => handleCambiarEstado(u, 'suspendido')}
                      >
                        Suspender
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog gestión de roles */}
      {usuarioGestionando && (
        <GestionarRolesDialog
          usuario={usuarioGestionando}
          onClose={() => setUsuarioGestionando(null)}
        />
      )}

      {/* Dialog nuevo usuario */}
      {showNuevoUsuario && (
        <NuevoUsuarioDialog
          tenantId={tenantId}
          onClose={() => setShowNuevoUsuario(false)}
          onSuccess={() => { setShowNuevoUsuario(false); reload?.(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab: Roles
// ─────────────────────────────────────────────────────────────

function TabRoles() {
  const { roles, permisos, eliminarRol } = useRoles();
  const confirmAction = useConfirmAction();
  const [dialogRol, setDialogRol] = useState<Rol | null | 'nuevo'>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const handleEliminar = async (rol: Rol) => {
    const ok = await confirmAction({ title: 'Confirmar eliminación', description: `¿Eliminar el rol "${rol.nombre}"? Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', variant: 'destructive' });
    if (!ok) return;
    setEliminando(rol._dbId);
    const result = await eliminarRol(rol._dbId);
    setEliminando(null);
    if (result.exito) toast.success('Rol eliminado');
    else toast.error('Error al eliminar rol');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Gestiona los roles del sistema. Los roles de sistema pueden tener sus permisos ajustados, pero no pueden eliminarse.
        </p>
        <Button onClick={() => setDialogRol('nuevo')}>
          <Plus className="size-4" />
          Nuevo Rol
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Permisos</TableHead>
              <TableHead className="w-32">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No hay roles definidos
                </TableCell>
              </TableRow>
            )}
            {roles.map(rol => (
              <TableRow key={rol._dbId}>
                <TableCell className="font-medium">{rol.nombre}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {rol.descripcion ?? '—'}
                </TableCell>
                <TableCell>
                  {rol.esSistema ? (
                    <Badge variant="secondary">Sistema</Badge>
                  ) : (
                    <Badge variant="outline">Personalizado</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium">{rol.permisoIds.length}</span>
                  <span className="text-xs text-muted-foreground"> / {permisos.length}</span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDialogRol(rol)}
                    >
                      <Pencil className="size-3.5" />
                      Permisos
                    </Button>
                    {!rol.esSistema && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        disabled={eliminando === rol._dbId}
                        onClick={() => handleEliminar(rol)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      {dialogRol === 'nuevo' && (
        <RolDialog rol={null} onClose={() => setDialogRol(null)} />
      )}
      {dialogRol && dialogRol !== 'nuevo' && (
        <RolDialog rol={dialogRol as Rol} onClose={() => setDialogRol(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

export function GestionUsuarios() {
  const { can, loading: permLoading } = usePermissions();
  const { loading } = useRoles();

  if (permLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Verificando permisos...
      </div>
    );
  }

  if (!can('admin', 'gestionar_usuarios')) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="size-12 text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">
          No tienes permiso para acceder a esta sección.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Usuarios y Roles</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los usuarios del tenant y sus permisos de acceso
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <Users className="size-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="size-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="modulos" className="flex items-center gap-2">
            <Layers className="size-4" />
            Módulos
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="flex items-center gap-2">
            <ClipboardList className="size-4" />
            Auditoría
          </TabsTrigger>
          <TabsTrigger value="flujo" className="flex items-center gap-2">
            <GitBranch className="size-4" />
            Flujo Aprobación
          </TabsTrigger>
          <TabsTrigger value="catalogos" className="flex items-center gap-2">
            <List className="size-4" />
            Catálogos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="pt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Cargando usuarios...</div>
          ) : (
            <TabUsuarios />
          )}
        </TabsContent>

        <TabsContent value="roles" className="pt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Cargando roles...</div>
          ) : (
            <TabRoles />
          )}
        </TabsContent>

        <TabsContent value="modulos" className="pt-4">
          <GestionModulos />
        </TabsContent>

        <TabsContent value="auditoria" className="pt-4">
          <AuditLogs />
        </TabsContent>
        <TabsContent value="flujo" className="pt-4">
          <GestionFlujoAprobacion />
        </TabsContent>
        <TabsContent value="catalogos" className="pt-4">
          <GestionCatalogos />
        </TabsContent>
      </Tabs>
    </div>
  );
}

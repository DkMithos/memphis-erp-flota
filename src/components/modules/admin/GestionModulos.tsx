/**
 * Gestión de Módulos — habilitar/deshabilitar por tenant
 * Persiste en Supabase (tenants.modules_config) con fallback a localStorage.
 */
import { useState, useEffect } from 'react';
import { Switch } from '../../ui/switch';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { toast } from 'sonner';
import {
  loadModulesConfigFromDB,
  saveModulesConfigToDB,
  saveModulesConfig,
  MODULES_DEFAULT,
  type ModuleConfig,
} from '../../../lib/config/modules-config';
import { useAuth } from '../../../auth/AuthProvider';

export function GestionModulos() {
  const { tenantId, loading: authLoading } = useAuth();
  const [modules, setModules] = useState<ModuleConfig[]>(MODULES_DEFAULT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    loadModulesConfigFromDB(tenantId).then(setModules);
  }, [tenantId]);

  const toggle = (id: string) => {
    if (id === 'dashboard' || id === 'admin') return;
    setModules(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  };

  const handleSave = async () => {
    setSaving(true);
    const dispatchUpdate = () => window.dispatchEvent(new Event('memphis-modules-updated'));

    if (!tenantId) {
      saveModulesConfig(modules);
      dispatchUpdate();
      setSaving(false);
      toast.warning('Guardado localmente', {
        description: 'No se detectó tenant activo. Los cambios aplican solo en este navegador.',
      });
      return;
    }

    const result = await saveModulesConfigToDB(tenantId, modules);
    dispatchUpdate();
    setSaving(false);

    if (result.dbSaved) {
      toast.success('Configuración guardada', {
        description: 'Los módulos del menú se actualizaron para todos los usuarios.',
      });
    } else {
      toast.warning('Guardado solo localmente (sin sincronización)', {
        description: 'Los cambios aplican en este navegador. Error DB: ' + (result.error ?? 'desconocido'),
      });
    }
  };

  const handleReset = () => {
    setModules([...MODULES_DEFAULT]);
  };

  if (authLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Cargando configuración...</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Activa o desactiva módulos del sistema. Los cambios afectan la navegación lateral para todos los usuarios del tenant.
        <strong> Dashboard y Administración</strong> siempre están visibles.
      </p>

      <div className="border rounded-lg divide-y">
        {modules.map(m => {
          const locked = m.id === 'dashboard' || m.id === 'admin';
          return (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={m.enabled}
                  disabled={locked}
                  onCheckedChange={() => toggle(m.id)}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    {locked && <Badge variant="secondary" className="text-xs">Fijo</Badge>}
                    {!locked && m.enabled && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 text-xs">Activo</Badge>}
                    {!locked && !m.enabled && <Badge variant="outline" className="text-xs text-muted-foreground">Inactivo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{m.descripcion}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={handleReset} className="hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">Restablecer</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}

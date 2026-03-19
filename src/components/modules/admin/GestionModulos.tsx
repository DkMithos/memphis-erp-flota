/**
 * Gestión de Módulos — habilitar/deshabilitar por tenant
 * Persiste en localStorage. Sin DB (config simple por demo).
 */
import { useState } from 'react';
import { Switch } from '../../ui/switch';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { toast } from 'sonner';
import { loadModulesConfig, saveModulesConfig, MODULES_DEFAULT, type ModuleConfig } from '../../../lib/config/modules-config';

export function GestionModulos() {
  const [modules, setModules] = useState<ModuleConfig[]>(loadModulesConfig);

  const toggle = (id: string) => {
    if (id === 'dashboard' || id === 'admin') return; // inamovibles
    setModules(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  };

  const handleSave = () => {
    saveModulesConfig(modules);
    toast.success('Configuración guardada', {
      description: 'Recarga la página para ver los cambios en el menú.',
    });
  };

  const handleReset = () => {
    setModules([...MODULES_DEFAULT]);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Activa o desactiva módulos del sistema. Los cambios afectan la navegación lateral para todos los usuarios.
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
                    {!locked && m.enabled && <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Activo</Badge>}
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
        <Button variant="outline" onClick={handleReset}>Restablecer</Button>
        <Button onClick={handleSave}>Guardar cambios</Button>
      </div>
    </div>
  );
}

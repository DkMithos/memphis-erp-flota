import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { useProveedorStore, type CategoriaConfig } from '../../../lib/proveedores/proveedores-store';
import { toast } from 'sonner';
import { useConfirmAction } from '@/components/shared/ConfirmDialogProvider';
import { PageNav } from '../../shared/PageNav';

export function GestionCategorias() {
  const { categorias, crearCategoria, actualizarCategoria, eliminarCategoria } = useProveedorStore();
  const confirmAction = useConfirmAction();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editKey, setEditKey] = useState('');
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');

  const toKey = (label: string) =>
    label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const handleStartEdit = (cat: CategoriaConfig) => {
    setEditingId(cat.key);
    setEditLabel(cat.label);
    setEditKey(cat.key);
  };

  const handleSaveEdit = async () => {
    if (!editLabel.trim()) { toast.error('El nombre es obligatorio'); return; }
    try {
      await actualizarCategoria(editingId!, { label: editLabel.trim() });
      toast.success('Categoría actualizada');
      setEditingId(null);
    } catch {
      toast.error('Error al actualizar la categoría');
    }
  };

  const handleToggleActivo = async (cat: CategoriaConfig) => {
    try {
      await actualizarCategoria(cat.key, { activo: !cat.activo });
      toast.success(cat.activo ? 'Categoría desactivada' : 'Categoría activada');
    } catch {
      toast.error('Error al cambiar estado');
    }
  };

  const handleDelete = async (cat: CategoriaConfig) => {
    const ok = await confirmAction({ title: 'Confirmar eliminación', description: `¿Eliminar la categoría "${cat.label}"? Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', variant: 'destructive' });
    if (!ok) return;
    try {
      await eliminarCategoria(cat.key);
      toast.success('Categoría eliminada');
    } catch {
      toast.error('Error al eliminar la categoría');
    }
  };

  const handleAdd = async () => {
    if (!newLabel.trim()) { toast.error('El nombre es obligatorio'); return; }
    const key = newKey.trim() || toKey(newLabel);
    if (!key) { toast.error('La clave no es válida'); return; }
    const exists = categorias.some(c => c.key === key);
    if (exists) { toast.error('Ya existe una categoría con esa clave'); return; }
    try {
      await crearCategoria({ key, label: newLabel.trim(), activo: true, orden: categorias.length + 1 });
      toast.success('Categoría creada');
      setAdding(false);
      setNewLabel('');
      setNewKey('');
    } catch {
      toast.error('Error al crear la categoría');
    }
  };

  return (
    <div className="space-y-6">
      <PageNav />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Categorías de Proveedor</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona las categorías disponibles al registrar proveedores
          </p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="size-4" />
          Nueva categoría
        </Button>
      </div>

      {adding && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Nueva Categoría</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Nombre visible</label>
                <Input
                  value={newLabel}
                  onChange={(e) => {
                    setNewLabel(e.target.value);
                    if (!newKey) setNewKey(toKey(e.target.value));
                  }}
                  placeholder="Ej: Servicios de Limpieza"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Clave interna (auto)</label>
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="Ej: servicios_limpieza"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" className="hover:!bg-black hover:!text-white hover:!border-black" onClick={() => { setAdding(false); setNewLabel(''); setNewKey(''); }}>
                <X className="size-4" />Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleAdd}>
                <Check className="size-4" />Crear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {categorias.length === 0 ? (
            <div className="py-12 text-center">
              <Tag className="size-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No hay categorías configuradas.</p>
            </div>
          ) : (
            <div className="divide-y">
              {categorias.map((cat) => (
                <div key={cat.key} className="flex items-center gap-3 px-4 py-3">
                  {editingId === cat.key ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      />
                      <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600" onClick={handleSaveEdit}>
                        <Check className="size-4" />
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingId(null)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{cat.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground font-mono">{cat.key}</span>
                      </div>
                      <Badge
                        variant={cat.activo ? 'default' : 'outline'}
                        className={cat.activo
                          ? 'bg-green-600 text-white hover:bg-green-600 border-green-600'
                          : 'border-slate-400 text-slate-600 dark:text-muted-foreground'}
                      >
                        {cat.activo ? 'Activa' : 'Inactiva'}
                      </Badge>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 hover:!bg-black hover:!text-white" onClick={() => handleStartEdit(cat)} title="Editar">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button" size="sm" variant="ghost"
                          className={`h-8 px-2 text-xs ${cat.activo
                            ? 'text-muted-foreground hover:!bg-orange-500 hover:!text-white'
                            : 'text-primary hover:!bg-green-600 hover:!text-white'}`}
                          onClick={() => handleToggleActivo(cat)}
                          title={cat.activo ? 'Desactivar' : 'Activar'}
                        >
                          {cat.activo ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:!bg-red-600 hover:!text-white" onClick={() => handleDelete(cat)} title="Eliminar">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

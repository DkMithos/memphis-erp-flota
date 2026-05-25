/**
 * GESTIÓN DE CATÁLOGOS — Panel Admin Memphis ERP
 * CRUD de listas desplegables configurables (unidades, condiciones de pago, etc.)
 */

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, List, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import {
  useCatalogos,
  TIPO_CATALOGO_LABELS,
  type TipoCatalogo,
  type ItemCatalogo,
} from '../../../lib/shared/catalogos-store';
import { toast } from 'sonner';
import { useConfirmAction } from '@/components/shared/ConfirmDialogProvider';

const TIPOS: TipoCatalogo[] = [
  'unidad_medida', 'condicion_pago', 'forma_pago',
  'tipo_comprobante', 'zona_igv', 'banco', 'moneda',
  'tipo_vehiculo', 'tipo_flota', 'tipo_contrato_flota',
  'tipo_doc_vehiculo', 'categoria_proveedor', 'categoria_equipo_bio',
  'modalidad_proyecto',
];

interface ItemRowProps {
  item: ItemCatalogo;
  onUpdate: (changes: Partial<Pick<ItemCatalogo, 'label' | 'descripcion' | 'activo'>>) => Promise<void>;
  onDelete: () => Promise<void>;
}

function ItemRow({ item, onUpdate, onDelete }: ItemRowProps) {
  const confirmAction = useConfirmAction();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [descripcion, setDescripcion] = useState(item.descripcion ?? '');

  const handleSave = async () => {
    if (!label.trim()) { toast.error('El nombre es obligatorio'); return; }
    await onUpdate({ label: label.trim(), descripcion: descripcion.trim() || undefined });
    setEditing(false);
    toast.success('Item actualizado');
  };

  const handleDelete = async () => {
    if (item.esSistema) { toast.error('Este item es del sistema y no puede eliminarse'); return; }
    const ok = await confirmAction({ title: 'Confirmar eliminación', description: `¿Eliminar "${item.label}"?`, confirmLabel: 'Eliminar', variant: 'destructive' });
    if (!ok) return;
    await onDelete();
    toast.success('Item eliminado');
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-muted/30 group">
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-1.5">
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditing(false); setLabel(item.label); } }}
            />
            <Input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              className="h-6 text-xs text-muted-foreground"
              placeholder="Descripción opcional"
            />
          </div>
        ) : (
          <div>
            <span className={`text-sm font-medium ${!item.activo ? 'line-through text-muted-foreground' : ''}`}>
              {item.label}
            </span>
            <span className="ml-2 text-xs font-mono text-muted-foreground">{item.key}</span>
            {item.descripcion && (
              <p className="text-xs text-muted-foreground mt-0.5">{item.descripcion}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {item.esSistema && (
          <Badge variant="outline" className="text-xs py-0 h-5">Sistema</Badge>
        )}
        <Badge variant={item.activo ? 'secondary' : 'outline'} className={`text-xs py-0 h-5 ${item.activo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'text-muted-foreground'}`}>
          {item.activo ? 'Activo' : 'Inactivo'}
        </Badge>

        {editing ? (
          <>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={handleSave}>
              <Check className="size-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditing(false); setLabel(item.label); }}>
              <X className="size-3.5" />
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="sm" variant="ghost"
              className={`h-7 px-2 text-xs opacity-0 group-hover:opacity-100 ${item.activo ? 'text-muted-foreground' : 'text-primary'}`}
              onClick={() => onUpdate({ activo: !item.activo }).then(() => toast.success(item.activo ? 'Desactivado' : 'Activado'))}
              title={item.activo ? 'Desactivar' : 'Activar'}
            >
              {item.activo ? <ToggleLeft className="size-4" /> : <ToggleRight className="size-4" />}
            </Button>
            {!item.esSistema && (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100" onClick={handleDelete}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface NuevoItemFormProps {
  tipo: TipoCatalogo;
  ordenInicial: number;
  onCrear: (item: Omit<ItemCatalogo, 'id'>) => Promise<void>;
}

function NuevoItemForm({ tipo, ordenInicial, onCrear }: NuevoItemFormProps) {
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [show, setShow] = useState(false);

  const toKey = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const handleCrear = async () => {
    if (!label.trim()) { toast.error('El nombre es obligatorio'); return; }
    const k = key.trim() || toKey(label);
    if (!k) { toast.error('La clave no es válida'); return; }
    await onCrear({ tipo, key: k, label: label.trim(), descripcion: descripcion.trim() || undefined, activo: true, orden: ordenInicial, esSistema: false });
    toast.success('Item creado');
    setLabel(''); setKey(''); setDescripcion(''); setShow(false);
  };

  if (!show) {
    return (
      <div className="px-4 py-3 border-t">
        <Button type="button" variant="outline" size="sm" onClick={() => setShow(true)}>
          <Plus className="size-4" />
          Agregar item
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-t bg-primary/5 space-y-3">
      <p className="text-xs font-medium text-primary">Nuevo item</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nombre visible</Label>
          <Input
            value={label}
            onChange={e => { setLabel(e.target.value); if (!key) setKey(toKey(e.target.value)); }}
            placeholder="Ej: 45 días"
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Clave interna (auto)</Label>
          <Input
            value={key}
            onChange={e => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="Ej: 45d"
            className="h-8 text-sm font-mono"
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Descripción (opcional)</Label>
          <Input
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Información adicional..."
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleCrear}>
          <Check className="size-4" />Crear
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setShow(false); setLabel(''); setKey(''); }}>
          <X className="size-4" />Cancelar
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function GestionCatalogos() {
  const { items, getByTipo, crearItem, actualizarItem, eliminarItem } = useCatalogos();
  const [tipoActivo, setTipoActivo] = useState<TipoCatalogo>('unidad_medida');

  const itemsDelTipo = getByTipo(tipoActivo, false); // incluir inactivos en admin

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <List className="size-5 text-primary" />
          Catálogos Configurables
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona las listas desplegables usadas en formularios del sistema (unidades, condiciones de pago, bancos, etc.)
        </p>
      </div>

      {/* Selector de tipo — mobile friendly */}
      <div className="md:hidden">
        <Select value={tipoActivo} onValueChange={v => setTipoActivo(v as TipoCatalogo)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS.map(t => (
              <SelectItem key={t} value={t}>{TIPO_CATALOGO_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs — desktop */}
      <Tabs value={tipoActivo} onValueChange={v => setTipoActivo(v as TipoCatalogo)} className="hidden md:block">
        <TabsList className="flex-wrap h-auto gap-1">
          {TIPOS.map(t => {
            const count = items.filter(i => i.tipo === t && i.activo).length;
            return (
              <TabsTrigger key={t} value={t} className="text-xs">
                {TIPO_CATALOGO_LABELS[t]}
                <Badge variant="secondary" className="ml-1.5 text-xs py-0 h-4 min-w-4">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Lista de items */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/30">
            <div>
              <p className="text-sm font-medium">{TIPO_CATALOGO_LABELS[tipoActivo]}</p>
              <p className="text-xs text-muted-foreground">
                {itemsDelTipo.filter(i => i.activo).length} activos · {itemsDelTipo.filter(i => !i.activo).length} inactivos
              </p>
            </div>
          </div>

          {itemsDelTipo.length === 0 ? (
            <div className="py-12 text-center">
              <List className="size-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Sin items en este catálogo.</p>
            </div>
          ) : (
            <div>
              {itemsDelTipo.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onUpdate={changes => actualizarItem(item.id, changes)}
                  onDelete={() => eliminarItem(item.id)}
                />
              ))}
            </div>
          )}

          <NuevoItemForm
            tipo={tipoActivo}
            ordenInicial={itemsDelTipo.length + 1}
            onCrear={crearItem}
          />
        </CardContent>
      </Card>
    </div>
  );
}

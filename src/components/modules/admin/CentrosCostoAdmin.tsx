/**
 * Administración de Centros de Costo
 * CRUD simple: lista, crear, editar, activar/inactivar
 */

import { useState } from 'react';
import { Plus, Pencil, ToggleLeft, ToggleRight, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { PageNav } from '../../shared/PageNav';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { useCentrosCosto, type NuevoCentroCostoInput } from '../../../lib/centros-costo/centros-costo-store';

interface FormState {
  codigo: string;
  nombre: string;
  descripcion: string;
}

const INITIAL_FORM: FormState = { codigo: '', nombre: '', descripcion: '' };

export function CentrosCostoAdmin() {
  const { t } = useTranslation();
  const { centrosCosto, loading, crearCentroCosto, actualizarCentroCosto, toggleActivo } = useCentrosCosto();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditId(null);
    setForm(INITIAL_FORM);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (cc: { _dbId: string; codigo: string; nombre: string; descripcion: string | null }) => {
    setEditId(cc._dbId);
    setForm({ codigo: cc.codigo, nombre: cc.nombre, descripcion: cc.descripcion ?? '' });
    setError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) {
      setError('Código y nombre son requeridos');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (editId) {
        const res = await actualizarCentroCosto(editId, {
          nombre: form.nombre,
          descripcion: form.descripcion || undefined,
        });
        if (!res.exito) {
          setError(res.errores?.[0] ?? 'Error al actualizar');
          return;
        }
      } else {
        const input: NuevoCentroCostoInput = {
          codigo: form.codigo,
          nombre: form.nombre,
          descripcion: form.descripcion || undefined,
        };
        const res = await crearCentroCosto(input);
        if (!res.exito) {
          setError(res.errores?.[0] ?? 'Error al crear');
          return;
        }
      }
      setDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string) => {
    await toggleActivo(id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageNav />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 dark:bg-primary/10 rounded-lg flex items-center justify-center">
            <Building2 className="size-6 text-black dark:text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{t('admin.cost_centers', 'Centros de Costo')}</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {t('admin.cost_centers_desc', 'Gestiona los centros de costo internos de la empresa')}
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          {t('common.create', 'Crear')}
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">{t('common.code', 'Código')}</TableHead>
              <TableHead>{t('common.name', 'Nombre')}</TableHead>
              <TableHead>{t('common.description', 'Descripción')}</TableHead>
              <TableHead className="w-[100px]">{t('common.status', 'Estado')}</TableHead>
              <TableHead className="w-[120px] text-right">{t('common.actions', 'Acciones')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {centrosCosto.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {t('admin.no_cost_centers', 'No hay centros de costo registrados')}
                </TableCell>
              </TableRow>
            ) : (
              centrosCosto.map(cc => (
                <TableRow key={cc._dbId}>
                  <TableCell className="font-mono font-medium">{cc.codigo}</TableCell>
                  <TableCell className="font-medium">{cc.nombre}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{cc.descripcion ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={cc.activo ? 'default' : 'secondary'}>
                      {cc.activo ? t('common.active', 'Activo') : t('common.inactive', 'Inactivo')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(cc)} title={t('common.edit', 'Editar')} className="hover:!bg-black hover:!text-white dark:hover:!bg-accent dark:hover:!text-accent-foreground">
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:!bg-black hover:!text-white dark:hover:!bg-accent dark:hover:!text-accent-foreground"
                        onClick={() => handleToggle(cc._dbId)}
                        title={cc.activo ? t('common.deactivate', 'Inactivar') : t('common.activate', 'Activar')}
                      >
                        {cc.activo ? <ToggleRight className="size-4 text-green-600" /> : <ToggleLeft className="size-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editId ? t('admin.edit_cost_center', 'Editar Centro de Costo') : t('admin.create_cost_center', 'Crear Centro de Costo')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('common.code', 'Código')} *</label>
              <Input
                value={form.codigo}
                onChange={e => setForm(prev => ({ ...prev, codigo: e.target.value }))}
                placeholder="ADM"
                disabled={!!editId}
                className="mt-1"
                maxLength={10}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('common.name', 'Nombre')} *</label>
              <Input
                value={form.nombre}
                onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Administración"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('common.description', 'Descripción')}</label>
              <Input
                value={form.descripcion}
                onChange={e => setForm(prev => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Área administrativa de la empresa"
                className="mt-1"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="!border-slate-400 hover:!bg-black hover:!text-white hover:!border-black dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:!border-input">
              {t('common.cancel', 'Cancelar')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? t('common.saving', 'Guardando...') : editId ? t('common.save', 'Guardar') : t('common.create', 'Crear')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

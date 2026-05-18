/**
 * TAB ADICIONALES - MANTENIMIENTO DETALLE
 * Gestión de extras (piezas/servicios adicionales) en OT
 */

import React, { useState } from 'react';
import { Plus, Trash2, Package, Wrench, DollarSign, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '../../ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Alert, AlertDescription } from '../../ui/alert';
import {
  summarizeExtrasByType,
  createExtraItem,
  validarExtra,
  calcExtraTotal,
  CATEGORIAS_PIEZAS,
  isActionAllowed,
  type TipoExtraOT,
  type OTExtraItem,
  type EstadoOT
} from '../../../lib/flota/ot-config';
import { toast } from 'sonner';

interface AdicionalesTabProps {
  extras: OTExtraItem[];
  numeroOT: string;
  estadoOT: EstadoOT;
  onAgregarExtra: (numeroOT: string, extra: OTExtraItem) => void;
  onEliminarExtra: (numeroOT: string, extraId: string, motivo: string) => void;
}

export function AdicionalesTab({
  extras,
  numeroOT,
  estadoOT,
  onAgregarExtra,
  onEliminarExtra
}: AdicionalesTabProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; extraId: string | null }>({
    open: false,
    extraId: null
  });
  
  // Form state
  const [tipo, setTipo] = useState<TipoExtraOT>('pieza');
  const [categoria, setCategoria] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [motivo, setMotivo] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [costoUnitario, setCostoUnitario] = useState(0);
  const [motivoEliminacion, setMotivoEliminacion] = useState('');
  const [errores, setErrores] = useState<string[]>([]);

  // Resumen
  const resumen = summarizeExtrasByType(extras);
  const puedeAgregarExtras = isActionAllowed(estadoOT, 'agregar_extras');
  
  // Filtrar solo los no eliminados por defecto
  const extrasActivos = extras.filter(e => !e.eliminado);

  const resetForm = () => {
    setTipo('pieza');
    setCategoria('');
    setDescripcion('');
    setMotivo('');
    setCantidad(1);
    setCostoUnitario(0);
    setErrores([]);
  };

  const handleAgregar = () => {
    // Validar
    const validacion = validarExtra(tipo, descripcion, cantidad, costoUnitario, categoria);
    
    if (!validacion.valido) {
      setErrores(validacion.errores);
      toast.error('Corrige los errores del formulario');
      return;
    }

    // Validar motivo >= 5 caracteres
    if (!motivo || motivo.trim().length < 5) {
      setErrores(['El motivo debe tener al menos 5 caracteres']);
      toast.error('El motivo es requerido (mínimo 5 caracteres)');
      return;
    }

    // Crear extra
    const nuevoExtra = createExtraItem(
      tipo,
      descripcion.trim(),
      motivo.trim(),
      cantidad,
      costoUnitario,
      'admin@kesa.com', // Mock - en producción viene del auth
      tipo === 'pieza' ? categoria : undefined
    );

    // Agregar al store
    onAgregarExtra(numeroOT, nuevoExtra);
    
    toast.success(`${tipo === 'pieza' ? 'Pieza' : 'Servicio'} agregado correctamente`);
    setSheetOpen(false);
    resetForm();
  };

  const handleEliminar = () => {
    if (!deleteDialog.extraId) return;

    // Validar motivo >= 30 caracteres
    if (!motivoEliminacion || motivoEliminacion.trim().length < 30) {
      toast.error('El motivo de eliminación debe tener al menos 30 caracteres');
      return;
    }

    onEliminarExtra(numeroOT, deleteDialog.extraId, motivoEliminacion.trim());
    
    toast.success('Adicional eliminado correctamente');
    setDeleteDialog({ open: false, extraId: null });
    setMotivoEliminacion('');
  };

  return (
    <div className="space-y-6">
      {/* Cards resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Package className="size-4" />
              Piezas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{resumen.piezas.count}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Total: ${resumen.piezas.total.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Wrench className="size-4" />
              Servicios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{resumen.servicios.count}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Total: ${resumen.servicios.total.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="size-4" />
              Total Adicionales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">
              ${resumen.total.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {resumen.piezas.count + resumen.servicios.count} items
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Botón agregar */}
      {puedeAgregarExtras ? (
        <div className="flex justify-end">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Agregar Adicional
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Agregar Pieza o Servicio Adicional</SheetTitle>
                <SheetDescription>
                  Registra piezas o servicios no planificados encontrados durante la ejecución.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 py-4">
                {/* Errores */}
                {errores.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1">
                        {errores.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Tipo */}
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as TipoExtraOT)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pieza">Pieza / Repuesto</SelectItem>
                      <SelectItem value="servicio">Servicio Adicional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Categoría (solo si es pieza) */}
                {tipo === 'pieza' && (
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoría *</Label>
                    <Select value={categoria} onValueChange={setCategoria}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS_PIEZAS.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Descripción */}
                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripción * (mín. 5 caracteres)</Label>
                  <Textarea
                    id="descripcion"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Ej: Pastillas de freno delanteras marca XYZ"
                    rows={3}
                  />
                </div>

                {/* Motivo */}
                <div className="space-y-2">
                  <Label htmlFor="motivo">Motivo/Justificación * (mín. 5 caracteres)</Label>
                  <Textarea
                    id="motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej: Desgaste detectado durante la inspección"
                    rows={2}
                  />
                </div>

                {/* Cantidad y Costo */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cantidad">Cantidad *</Label>
                    <Input
                      id="cantidad"
                      type="number"
                      min="1"
                      value={cantidad}
                      onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="costoUnitario">Costo Unitario ($) *</Label>
                    <Input
                      id="costoUnitario"
                      type="number"
                      min="0"
                      step="0.01"
                      value={costoUnitario}
                      onChange={(e) => setCostoUnitario(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Total calculado */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Costo Total:</span>
                    <span className="text-lg font-semibold text-primary">
                      ${calcExtraTotal(cantidad, costoUnitario).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <SheetFooter>
                <Button variant="outline" onClick={() => setSheetOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAgregar}>
                  Agregar
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      ) : (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            Solo se pueden agregar adicionales cuando la OT está en ejecución.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabla de extras */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Adicionales ({extrasActivos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {extrasActivos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="size-12 mx-auto mb-3 opacity-50" />
              <p>No hay piezas ni servicios adicionales registrados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Costo Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extrasActivos.map((extra) => (
                  <TableRow key={extra.id}>
                    <TableCell>
                      <Badge variant={extra.tipo === 'pieza' ? 'default' : 'secondary'}>
                        {extra.tipo === 'pieza' ? (
                          <><Package className="size-3" /> Pieza</>
                        ) : (
                          <><Wrench className="size-3" /> Servicio</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {extra.categoria ? (
                        <Badge variant="outline">{extra.categoria}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{extra.descripcion}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {extra.motivo}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{extra.cantidad}</TableCell>
                    <TableCell className="text-right">
                      ${extra.costoUnitario.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${extra.costoTotal.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{extra.registradoPor.split('@')[0]}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {new Date(extra.fechaRegistro).toLocaleDateString('es-ES')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(extra.fechaRegistro).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      {puedeAgregarExtras && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, extraId: extra.id })}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de eliminación */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, extraId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              Esta acción marcará el adicional como eliminado. Debes proporcionar un motivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="motivoEliminacion">
                Motivo de Eliminación * (mínimo 30 caracteres)
              </Label>
              <Textarea
                id="motivoEliminacion"
                value={motivoEliminacion}
                onChange={(e) => setMotivoEliminacion(e.target.value)}
                placeholder="Explica por qué se elimina este adicional..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {motivoEliminacion.length}/30 caracteres
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialog({ open: false, extraId: null });
                setMotivoEliminacion('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleEliminar}
              disabled={motivoEliminacion.length < 30}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

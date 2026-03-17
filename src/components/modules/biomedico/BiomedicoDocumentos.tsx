/**
 * DOCUMENTOS BIOMÉDICOS
 * Vista de tarjetas con filtros, creación y eliminación
 */

import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  FileText,
  Award,
  BookOpen,
  Shield,
  FileCheck,
  File,
  Download,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { useDocumentosBioStore, type DocumentoBio, type NuevoDocumentoBioInput } from '../../../lib/biomedico/documentos-bio-store';
import { useEquiposStore } from '../../../lib/biomedico/equipos-store';
import { toast } from 'sonner';

// ── Config de tipo ────────────────────────────────────────────────────────────

type TipoDoc = DocumentoBio['tipo'];

interface TipoConfig {
  label: string;
  icon: React.ReactNode;
  className: string;
}

const TIPO_CONFIG: Record<TipoDoc, TipoConfig> = {
  manual: {
    label: 'Manual',
    icon: <BookOpen className="size-5" />,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  },
  certificado: {
    label: 'Certificado',
    icon: <Award className="size-5" />,
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
  },
  protocolo: {
    label: 'Protocolo',
    icon: <FileCheck className="size-5" />,
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
  },
  garantia: {
    label: 'Garantía',
    icon: <Shield className="size-5" />,
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
  },
  ficha_tecnica: {
    label: 'Ficha Técnica',
    icon: <FileText className="size-5" />,
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
  },
  otro: {
    label: 'Otro',
    icon: <File className="size-5" />,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  onNavigate?: (route: string) => void;
}

export function BiomedicoDocumentos({ onNavigate }: Props) {
  const { documentos, loading, agregarDocumento, eliminarDocumento } = useDocumentosBioStore();
  const { equipos } = useEquiposStore();

  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoDoc | 'todos'>('todos');
  const [filtroEquipo, setFiltroEquipo] = useState<string>('todos');

  // Dialog agregar
  const [dialogAgregar, setDialogAgregar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formData, setFormData] = useState<{
    equipoDbId: string;
    equipoId: string;
    nombre: string;
    tipo: TipoDoc;
    descripcion: string;
    vigencia: string;
  }>({
    equipoDbId: '',
    equipoId: '',
    nombre: '',
    tipo: 'manual',
    descripcion: '',
    vigencia: '',
  });

  const equiposConDocumentos = useMemo(() => {
    const ids = new Set(documentos.map(d => d.equipoId));
    return equipos.filter(e => ids.has(e.codigo));
  }, [documentos, equipos]);

  const filtered = useMemo(() => {
    return documentos.filter(d => {
      const matchSearch =
        !search ||
        d.nombre.toLowerCase().includes(search.toLowerCase()) ||
        d.equipoId.toLowerCase().includes(search.toLowerCase()) ||
        d.equipoNombre.toLowerCase().includes(search.toLowerCase());
      const matchTipo = filtroTipo === 'todos' || d.tipo === filtroTipo;
      const matchEquipo = filtroEquipo === 'todos' || d.equipoId === filtroEquipo;
      return matchSearch && matchTipo && matchEquipo;
    });
  }, [documentos, search, filtroTipo, filtroEquipo]);

  const handleEquipoChange = (dbId: string) => {
    const equipo = equipos.find(e => e._dbId === dbId);
    setFormData(prev => ({ ...prev, equipoDbId: dbId, equipoId: equipo?.codigo ?? '' }));
  };

  const handleAgregar = async () => {
    if (!formData.equipoDbId || !formData.nombre) {
      toast.error('Equipo y nombre son requeridos');
      return;
    }
    setGuardando(true);
    try {
      const input: NuevoDocumentoBioInput = {
        equipoId: formData.equipoId,
        equipoDbId: formData.equipoDbId,
        nombre: formData.nombre,
        tipo: formData.tipo,
        descripcion: formData.descripcion || undefined,
        vigencia: formData.vigencia || undefined,
      };
      await agregarDocumento(input);
      toast.success('Documento agregado');
      setDialogAgregar(false);
      setFormData({ equipoDbId: '', equipoId: '', nombre: '', tipo: 'manual', descripcion: '', vigencia: '' });
    } catch {
      toast.error('Error al agregar documento');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (doc: DocumentoBio) => {
    if (!confirm(`¿Eliminar el documento "${doc.nombre}"?`)) return;
    const result = await eliminarDocumento(doc._dbId);
    if (result.exito) {
      toast.success('Documento eliminado');
    } else {
      toast.error(result.errores?.[0] ?? 'Error al eliminar');
    }
  };

  // Equipo IDs únicos para el filtro
  const equipoIdsUnicos = useMemo(() => {
    const seen = new Map<string, string>();
    documentos.forEach(d => { if (!seen.has(d.equipoId)) seen.set(d.equipoId, d.equipoNombre); });
    return Array.from(seen.entries());
  }, [documentos]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="size-6 text-primary" />
            Documentos y Certificados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión documental de certificaciones, manuales y protocolos
          </p>
        </div>
        <Button onClick={() => setDialogAgregar(true)}>
          <Plus className="size-4 mr-2" />
          Agregar Documento
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, equipo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtroTipo} onValueChange={v => setFiltroTipo(v as TipoDoc | 'todos')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo de documento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {(Object.keys(TIPO_CONFIG) as TipoDoc[]).map(t => (
                  <SelectItem key={t} value={t}>{TIPO_CONFIG[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroEquipo} onValueChange={setFiltroEquipo}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Equipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los equipos</SelectItem>
                {equipoIdsUnicos.map(([id, nombre]) => (
                  <SelectItem key={id} value={id}>{id}{nombre ? ` — ${nombre}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grid de tarjetas */}
      {loading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            No se encontraron documentos.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {filtered.length} documento{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(doc => {
              const tipoConf = TIPO_CONFIG[doc.tipo];
              return (
                <Card key={doc._dbId} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`p-2 rounded-lg ${tipoConf.className} shrink-0`}>
                        {tipoConf.icon}
                      </div>
                      <Badge variant="outline" className={`text-xs ${tipoConf.className}`}>
                        {tipoConf.label}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm leading-tight mt-2">{doc.nombre}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Equipo: </span>
                      <span className="font-medium">{doc.equipoId}</span>
                      {doc.equipoNombre && <span className="text-muted-foreground"> — {doc.equipoNombre}</span>}
                    </div>
                    {doc.descripcion && (
                      <p className="text-muted-foreground line-clamp-2">{doc.descripcion}</p>
                    )}
                    {doc.vigencia && (
                      <div>
                        <span className="text-muted-foreground">Vigencia: </span>
                        <span>{doc.vigencia}</span>
                      </div>
                    )}
                    {doc.tamanoBytes && (
                      <div>
                        <span className="text-muted-foreground">Tamaño: </span>
                        <span>{formatBytes(doc.tamanoBytes)}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Subido: </span>
                      <span>{new Date(doc.creadoEn).toLocaleDateString('es-PE')}</span>
                    </div>
                  </CardContent>
                  <div className="p-3 pt-0 flex gap-2">
                    {doc.urlStorage ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(doc.urlStorage, '_blank')}
                      >
                        <Download className="size-3 mr-1" />
                        Descargar
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="flex-1" disabled>
                        Sin archivo
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleEliminar(doc)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ── Dialog: Agregar Documento ── */}
      <Dialog open={dialogAgregar} onOpenChange={setDialogAgregar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Equipo *</Label>
              <Select value={formData.equipoDbId} onValueChange={handleEquipoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar equipo" />
                </SelectTrigger>
                <SelectContent>
                  {equipos.map(eq => (
                    <SelectItem key={eq._dbId} value={eq._dbId}>
                      {eq.codigo} — {eq.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nombre del documento *</Label>
              <Input
                placeholder="Ej: Manual de usuario v2.1"
                value={formData.nombre}
                onChange={e => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={v => setFormData(prev => ({ ...prev, tipo: v as TipoDoc }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_CONFIG) as TipoDoc[]).map(t => (
                    <SelectItem key={t} value={t}>{TIPO_CONFIG[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea
                rows={2}
                placeholder="Descripción breve del documento..."
                value={formData.descripcion}
                onChange={e => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Vigencia</Label>
              <Input
                type="date"
                value={formData.vigencia}
                onChange={e => setFormData(prev => ({ ...prev, vigencia: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground bg-muted rounded p-2">
              El archivo se puede subir posteriormente desde el sistema de almacenamiento.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAgregar(false)}>Cancelar</Button>
            <Button onClick={handleAgregar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Agregar Documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

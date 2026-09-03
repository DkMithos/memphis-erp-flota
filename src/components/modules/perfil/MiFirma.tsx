/**
 * MiFirma — cada persona registra su propia firma, una sola vez.
 *
 * Reglas que sostienen esto:
 *   - Nadie sube la firma de otro. La política RLS de `firmas_usuario` solo
 *     deja ver y escribir la fila cuyo `user_id` es el del propio usuario.
 *   - Al aprobar una orden se guarda una COPIA de esta imagen en esa
 *     aprobación. Cambiar la firma aquí NO altera los documentos ya aprobados:
 *     un documento financiero debe seguir mostrando lo que se firmó ese día.
 */
import { useEffect, useRef, useState } from 'react';
import { PenLine, Upload, Trash2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { useAuth } from '../../../auth/AuthProvider';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';

/** Tope de la imagen guardada. Una rúbrica no necesita más y así la fila viaja ligera. */
const MAX_BYTES = 300 * 1024;
const ANCHO_MAX = 600;
const ALTO_MAX = 200;

/** Reescala a un tamaño razonable y devuelve un PNG como data URI. */
function normalizar(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida'));
      img.onload = () => {
        const escala = Math.min(ANCHO_MAX / img.width, ALTO_MAX / img.height, 1);
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        const ctx = lienzo.getContext('2d');
        if (!ctx) return reject(new Error('No se pudo procesar la imagen'));
        ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        resolve(lienzo.toDataURL('image/png'));
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(archivo);
  });
}

export function MiFirma() {
  const { user, tenantId, profile } = useAuth();
  const [imagen, setImagen] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    if (!user?.id) { setCargando(false); return; }
    (supabase.from('firmas_usuario') as any)
      .select('imagen, nombre')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: { data: { imagen: string; nombre: string | null } | null }) => {
        if (!vivo) return;
        setImagen(data?.imagen ?? null);
        setNombre(data?.nombre ?? [profile?.nombre, profile?.apellido].filter(Boolean).join(' '));
        setCargando(false);
      });
    return () => { vivo = false; };
  }, [user?.id, profile?.nombre, profile?.apellido]);

  const elegirArchivo = async (archivo?: File) => {
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      toast.error('Sube una imagen (PNG o JPG). Un PNG con fondo transparente se ve mejor.');
      return;
    }
    try {
      const dataUri = await normalizar(archivo);
      if (dataUri.length > MAX_BYTES) {
        toast.error('La imagen sigue siendo muy pesada. Recórtala a solo la rúbrica.');
        return;
      }
      setImagen(dataUri);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo procesar la imagen');
    }
  };

  const guardar = async () => {
    if (!user?.id || !tenantId) return;
    if (!imagen) { toast.error('Primero sube tu firma'); return; }
    setGuardando(true);
    const { error } = await (supabase.from('firmas_usuario') as any).upsert({
      user_id: user.id,
      tenant_id: tenantId,
      imagen,
      nombre: nombre.trim() || null,
      actualizado_en: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setGuardando(false);
    if (error) { toast.error('No se pudo guardar: ' + error.message); return; }
    toast.success('Firma registrada. Se usará en las órdenes que apruebes de ahora en adelante.');
  };

  const quitar = async () => {
    if (!user?.id) return;
    const { error } = await (supabase.from('firmas_usuario') as any)
      .delete().eq('user_id', user.id);
    if (error) { toast.error('No se pudo quitar: ' + error.message); return; }
    setImagen(null);
    toast.success('Firma eliminada. Las órdenes ya aprobadas conservan la que llevaban.');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PenLine className="size-4" />
          Mi firma
        </CardTitle>
        <CardDescription>
          Se estampa en las órdenes que apruebes. Solo tú puedes verla y cambiarla.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
              <div className="w-56 h-28 border rounded-md flex items-center justify-center bg-white shrink-0">
                {imagen
                  ? <img src={imagen} alt="Tu firma" className="max-h-24 max-w-full object-contain" />
                  : <span className="text-xs text-muted-foreground px-3 text-center">
                      Aún no registras tu firma
                    </span>}
              </div>

              <div className="space-y-3 flex-1">
                <div>
                  <Label htmlFor="firma-nombre">Nombre como debe aparecer</Label>
                  <Input
                    id="firma-nombre"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Ej: Guillermo Macher"
                    className="mt-1 max-w-sm"
                  />
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={e => { void elegirArchivo(e.target.files?.[0]); e.target.value = ''; }}
                />

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => inputRef.current?.click()}>
                    <Upload className="size-4" />
                    {imagen ? 'Cambiar imagen' : 'Subir imagen'}
                  </Button>
                  <Button onClick={guardar} disabled={guardando || !imagen}>
                    <Save className="size-4" />
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </Button>
                  {imagen && (
                    <Button variant="ghost" onClick={quitar} className="text-destructive">
                      <Trash2 className="size-4" />
                      Quitar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Escanea o fotografía tu firma sobre papel blanco y recórtala. Un PNG con fondo
              transparente queda mejor sobre el documento. Cambiarla aquí no modifica las órdenes
              que ya aprobaste: cada aprobación conserva la firma con la que se hizo.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

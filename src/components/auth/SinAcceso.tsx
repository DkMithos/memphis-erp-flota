/**
 * SIN ACCESO — pantalla que ve un usuario con sesión válida que intenta abrir
 * una pantalla para la que su rol no tiene permiso (típicamente tecleando la URL).
 *
 * No es un error: es el RBAC haciendo su trabajo. Por eso el tono es informativo
 * y ofrece volver, en vez de parecer una caída del sistema.
 */
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface Props {
  ruta: string;
  onVolver: () => void;
}

export function SinAcceso({ ruta, onVolver }: Props) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
            <ShieldAlert className="size-6 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle>No tienes acceso a esta sección</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Tu rol no incluye permiso para <code className="rounded bg-muted px-1.5 py-0.5">{ruta}</code>.
            Si necesitas entrar, pídeselo al administrador del sistema.
          </p>
          <Button onClick={onVolver}>
            <ArrowLeft className="size-4" /> Volver al inicio
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

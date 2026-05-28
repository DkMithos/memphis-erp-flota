/**
 * Memphis ERP — Pantalla de cuenta pendiente de rol
 *
 * Se muestra cuando un usuario se autenticó correctamente (SSO Microsoft u
 * otro) pero NO tiene ningún rol RBAC asignado todavía. El administrador debe
 * asignarle un rol desde Administración → Usuarios antes de que pueda acceder.
 */
import { ShieldAlert, LogOut, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { MemphisIconSVG, PLATFORM } from '../../lib/config/branding';

interface PendingAccessProps {
  email?: string | null;
  nombre?: string | null;
  onSignOut: () => void;
}

export function PendingAccess({ email, nombre, onSignOut }: PendingAccessProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <Card className="w-full max-w-md shadow-xl border-border/60">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex justify-center pt-2">
            <div className="flex items-center gap-3">
              <div className="size-12 flex items-center justify-center">
                <MemphisIconSVG className="size-12" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{PLATFORM.name}</h1>
                <p className="text-xs text-muted-foreground">{PLATFORM.tagline}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <div className="size-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <ShieldAlert className="size-8 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          <div className="text-center">
            <CardTitle className="text-lg">Cuenta pendiente de aprobación</CardTitle>
            <CardDescription className="mt-2 text-sm">
              Tu inicio de sesión fue exitoso, pero tu cuenta aún no tiene un rol asignado.
              Un administrador debe habilitarte el acceso.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {(nombre || email) && (
            <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
              {nombre && <p className="font-medium text-foreground">{nombre}</p>}
              {email && (
                <p className="text-muted-foreground flex items-center gap-1.5">
                  <Mail className="size-3.5" /> {email}
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Comparte tu correo con el administrador del sistema para que te asigne el rol
            correspondiente. Luego vuelve a iniciar sesión.
          </p>

          <Button variant="outline" className="w-full" onClick={onSignOut}>
            <LogOut className="size-4 mr-2" /> Cerrar sesión
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground/60">
        <MemphisIconSVG className="size-4 opacity-50" />
        <span>Powered by <strong className="font-medium text-muted-foreground/80">{PLATFORM.company}</strong></span>
      </div>
    </div>
  );
}

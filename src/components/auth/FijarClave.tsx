/**
 * FIJAR CONTRASEÑA — pantalla que ve quien llega por el enlace de alta.
 *
 * El alta de usuarios (Edge Function `usuarios-alta`) nunca define la contraseña:
 * crea la cuenta y devuelve un enlace de un solo uso. Al abrirlo, Supabase emite
 * el evento PASSWORD_RECOVERY y AuthProvider levanta `recuperandoClave`, que trae
 * a la persona hasta aquí antes de dejarla entrar al sistema.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';

const MIN = 8;

export function FijarClave() {
  const { user, fijarClave } = useAuth();
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validar = (): string | null => {
    if (clave.length < MIN) return `La contraseña debe tener al menos ${MIN} caracteres.`;
    if (!/[a-z]/.test(clave) || !/[A-Z]/.test(clave)) return 'Debe combinar mayúsculas y minúsculas.';
    if (!/\d/.test(clave)) return 'Debe incluir al menos un número.';
    if (clave !== repetida) return 'Las contraseñas no coinciden.';
    return null;
  };

  const handleGuardar = async () => {
    const problema = validar();
    if (problema) { setError(problema); return; }
    setGuardando(true);
    setError(null);
    try {
      await fijarClave(clave);
      toast.success('Contraseña definida', { description: 'Ya puedes usar el sistema.' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la contraseña.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <img src="/logo-memphis.svg" alt="Memphis Maquinarias" className="mx-auto h-10" />
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <KeyRound className="size-5" /> Define tu contraseña
          </CardTitle>
          {user?.email && (
            <p className="text-sm text-muted-foreground">
              Cuenta: <strong>{user.email}</strong>
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Es la primera vez que ingresas. Elige una contraseña propia; nadie más la conoce.
          </p>

          <div className="space-y-2">
            <Label htmlFor="clave">Nueva contraseña</Label>
            <div className="relative">
              <Input
                id="clave"
                type={verClave ? 'text' : 'password'}
                value={clave}
                onChange={e => { setClave(e.target.value); setError(null); }}
                autoComplete="new-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setVerClave(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {verClave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo {MIN} caracteres, con mayúsculas, minúsculas y al menos un número.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="repetida">Repite la contraseña</Label>
            <Input
              id="repetida"
              type={verClave ? 'text' : 'password'}
              value={repetida}
              onChange={e => { setRepetida(e.target.value); setError(null); }}
              onKeyDown={e => { if (e.key === 'Enter') void handleGuardar(); }}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button className="w-full" onClick={handleGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar y entrar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

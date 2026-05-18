/**
 * Memphis ERP — Login
 * Branding de plataforma: Memphis ERP (Memphis Maquinarias S.A.C.)
 * El header muestra el ícono dorado de Memphis + nombre de la plataforma.
 */
import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '../../auth/AuthProvider';
import { MemphisIconSVG, PLATFORM } from '../../lib/config/branding';

interface LoginProps {
  onLogin?: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const { signInWithPassword } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      onLogin?.();
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'No se pudo iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">

      {/* Card principal */}
      <Card className="w-full max-w-md shadow-xl border-border/60">
        <CardHeader className="space-y-4 pb-4">

          {/* Logo de plataforma — Memphis ERP */}
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

          <div className="text-center">
            <CardTitle className="text-lg">Iniciar Sesión</CardTitle>
            <CardDescription className="mt-1 text-sm">
              Ingresa tus credenciales para acceder al sistema
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-md border border-red-200 dark:border-red-800">
                {errorMsg}
              </div>
            )}

            {/* Recordar + Olvidé contraseña */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer select-none">
                  Recordarme
                </label>
              </div>
              <Button variant="link" className="px-0 text-xs" type="button" disabled>
                ¿Olvidaste tu contraseña?
              </Button>
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Ingresando...' : 'Iniciar Sesión'}
            </Button>

            {/* Divisor SSO */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">O continuar con</span>
              </div>
            </div>

            {/* SSO (próximamente) */}
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" type="button" disabled>Microsoft</Button>
              <Button variant="outline" type="button" disabled>Google</Button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>¿No tienes una cuenta?</p>
            <Button variant="link" className="px-0 mt-1 text-xs" type="button" disabled>
              Contacta con soporte
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Footer de plataforma — SIEMPRE Memphis Maquinarias */}
      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground/60">
        <MemphisIconSVG className="size-4 opacity-50" />
        <span>Powered by <strong className="font-medium text-muted-foreground/80">{PLATFORM.company}</strong></span>
        <span>·</span>
        <span>v{PLATFORM.version}</span>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { User, Mail, Building2, Shield, Key, Save, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Avatar, AvatarFallback } from '../../ui/avatar';
import { Separator } from '../../ui/separator';
import { useAuth } from '../../../auth/AuthProvider';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';

export function UserProfile() {
  const { user, profile, tenantName } = useAuth();

  const [changingPassword, setChangingPassword] = useState(false);
  const [pwData, setPwData] = useState({ nueva: '', confirmar: '' });
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const nombre = profile?.nombre ?? user?.email ?? 'Usuario';
  const initials = nombre.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const rol = user?.app_metadata?.role ?? profile?.rol ?? 'usuario';

  const handleChangePassword = async () => {
    if (!pwData.nueva || pwData.nueva.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (pwData.nueva !== pwData.confirmar) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwData.nueva });
      if (error) throw error;
      toast.success('Contraseña actualizada correctamente');
      setPwData({ nueva: '', confirmar: '' });
      setChangingPassword(false);
    } catch (err: any) {
      toast.error('Error al cambiar contraseña', { description: err.message });
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">Información de tu cuenta en el sistema</p>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información de la Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar + Nombre */}
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{nombre}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="mt-1 capitalize">{rol}</Badge>
            </div>
          </div>

          <Separator />

          {/* Datos */}
          <div className="grid gap-4">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Building2 className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Empresa / Tenant</p>
                <p className="font-medium">{tenantName ?? '—'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Shield className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Rol en el sistema</p>
                <p className="font-medium capitalize">{rol}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <User className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">ID de Usuario</p>
                <p className="font-mono text-xs text-muted-foreground">{user?.id}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cambiar Contraseña */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="size-4" />
            Seguridad
          </CardTitle>
          <CardDescription>Actualiza tu contraseña de acceso</CardDescription>
        </CardHeader>
        <CardContent>
          {!changingPassword ? (
            <Button variant="outline" onClick={() => setChangingPassword(true)}>
              Cambiar Contraseña
            </Button>
          ) : (
            <div className="space-y-4 max-w-sm">
              <div className="space-y-1.5">
                <Label htmlFor="pw-nueva">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="pw-nueva"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={pwData.nueva}
                    onChange={e => setPwData(p => ({ ...p, nueva: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPw(v => !v)}
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pw-confirmar">Confirmar contraseña</Label>
                <Input
                  id="pw-confirmar"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Repite la contraseña"
                  value={pwData.confirmar}
                  onChange={e => setPwData(p => ({ ...p, confirmar: e.target.value }))}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleChangePassword} disabled={savingPw} size="sm">
                  <Save className="size-3.5 mr-1.5" />
                  {savingPw ? 'Guardando...' : 'Guardar contraseña'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setChangingPassword(false); setPwData({ nueva: '', confirmar: '' }); }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

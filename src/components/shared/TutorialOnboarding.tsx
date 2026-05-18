/**
 * Memphis ERP — TutorialOnboarding
 * Tutorial de bienvenida en el primer login.
 * Se muestra cuando profiles.onboarding_completado = false.
 * Al completar, actualiza el flag en Supabase.
 */
import { useState } from 'react';
import {
  Home, Truck, ShoppingCart, Users, Package,
  Stethoscope, BarChart3, Settings, ChevronRight, ChevronLeft,
  CheckCircle2, X, Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../lib/supabase/client';
import { MemphisIconSVG, PLATFORM } from '../../lib/config/branding';

interface TutorialOnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    id: 'bienvenida',
    title: `Bienvenido a ${PLATFORM.name}`,
    subtitle: 'Tu sistema empresarial integrado',
    description: `${PLATFORM.name} centraliza todos los procesos de tu empresa en una sola plataforma. Flota, Biomédico, Compras, Inventario, Finanzas y más — todo conectado.`,
    icon: Sparkles,
    color: 'text-amber-500',
    tip: null,
  },
  {
    id: 'home',
    title: 'Pantalla de Inicio',
    subtitle: 'Tu punto de partida diario',
    description: 'Cada vez que inicies sesión verás esta pantalla con accesos rápidos a todos los módulos, actividad reciente y el estado del sistema.',
    icon: Home,
    color: 'text-blue-500',
    tip: '💡 Usa los accesos rápidos para navegar sin pasar por el menú lateral.',
  },
  {
    id: 'sidebar',
    title: 'Menú de Navegación',
    subtitle: 'Accede a todos los módulos',
    description: 'El menú lateral contiene todos los módulos del sistema. Haz clic en cualquier módulo para expandir sus sub-secciones. El administrador puede habilitar o deshabilitar módulos según tu plan.',
    icon: Settings,
    color: 'text-purple-500',
    tip: '💡 Los módulos se contraen automáticamente. Solo el módulo activo se expande.',
  },
  {
    id: 'modulos',
    title: 'Módulos Principales',
    subtitle: 'Una plataforma, múltiples capacidades',
    description: 'Navega entre Flota, Biomédico, Compras, Proveedores, Inventario, Finanzas, Proyectos y más. Cada módulo tiene su propio dashboard, listados y formularios.',
    icon: Truck,
    color: 'text-green-500',
    tip: '💡 Usa la barra de búsqueda en el topbar para encontrar cualquier registro rápidamente.',
    modules: [
      { icon: Truck, label: 'Flota' },
      { icon: Stethoscope, label: 'Biomédico' },
      { icon: ShoppingCart, label: 'Compras' },
      { icon: Users, label: 'Proveedores' },
      { icon: Package, label: 'Inventario' },
      { icon: BarChart3, label: 'BI & Reportes' },
    ],
  },
  {
    id: 'listo',
    title: '¡Todo listo!',
    subtitle: 'Comienza a usar el sistema',
    description: `Has completado el recorrido inicial de ${PLATFORM.name}. Si tienes dudas, puedes encontrar ayuda en el menú de usuario o contactar a soporte.`,
    icon: CheckCircle2,
    color: 'text-green-500',
    tip: null,
  },
];

export function TutorialOnboarding({ onComplete }: TutorialOnboardingProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const handleComplete = async () => {
    setSaving(true);
    try {
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({ onboarding_completado: true } as any)
          .eq('id', user.id);
      }
    } catch (e) {
      // No bloquear si falla — el usuario igual puede usar el sistema
      console.warn('[onboarding] No se pudo guardar flag:', e);
    } finally {
      setSaving(false);
      onComplete();
    }
  };

  const handleSkip = () => {
    // Saltar sin marcar completado — se mostrará en el próximo login
    onComplete();
  };

  return (
    // Overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header con progress */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MemphisIconSVG className="size-6" />
              <span className="text-xs font-medium text-muted-foreground">{PLATFORM.name}</span>
            </div>
            <button
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cerrar tutorial"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Barra de progreso */}
          <div className="flex gap-1 mb-5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Contenido del paso */}
        <div className="px-6 pb-2">
          {/* Ícono del paso */}
          <div className={`size-14 rounded-2xl bg-muted flex items-center justify-center mb-4`}>
            <current.icon className={`size-7 ${current.color}`} />
          </div>

          {/* Textos */}
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Paso {step + 1} de {STEPS.length}
          </p>
          <h2 className="text-xl font-bold text-foreground mb-1">{current.title}</h2>
          <p className="text-sm text-primary font-medium mb-3">{current.subtitle}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>

          {/* Grid de módulos (solo en paso 3) */}
          {'modules' in current && current.modules && (
            <div className="grid grid-cols-3 gap-2 mt-4">
              {current.modules.map((m) => (
                <div key={m.label} className="flex flex-col items-center gap-1.5 bg-muted/50 rounded-xl p-3">
                  <m.icon className="size-5 text-primary" />
                  <span className="text-xs font-medium text-foreground">{m.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tip */}
          {current.tip && (
            <div className="mt-4 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-xs text-foreground/80">
              {current.tip}
            </div>
          )}
        </div>

        {/* Footer con navegación */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-between gap-3 mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep(s => s - 1)}
            disabled={isFirst}
            className="gap-1"
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Button>

          <span className="text-xs text-muted-foreground">
            {step + 1} / {STEPS.length}
          </span>

          {isLast ? (
            <Button
              size="sm"
              onClick={handleComplete}
              disabled={saving}
              className="gap-1"
            >
              <CheckCircle2 className="size-4" />
              {saving ? 'Guardando...' : 'Comenzar'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setStep(s => s + 1)}
              className="gap-1"
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

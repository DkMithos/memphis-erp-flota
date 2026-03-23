import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="bg-destructive/10 p-4 rounded-full">
                <AlertTriangle className="size-10 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-foreground">
                Ocurrió un error inesperado
              </h1>
              <p className="text-sm text-muted-foreground">
                El módulo no pudo cargarse correctamente. Puedes intentar recargar la página.
              </p>
              {this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Ver detalles técnicos
                  </summary>
                  <pre className="mt-2 p-3 bg-muted rounded-md text-xs text-muted-foreground overflow-auto max-h-48 whitespace-pre-wrap break-all">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReset} variant="outline" size="sm">
                <RefreshCw className="size-4 mr-2" />
                Reintentar
              </Button>
              <Button onClick={() => window.location.reload()} size="sm">
                Recargar página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Versión funcional ligera para envolver secciones internas (no páginas completas) */
export function SectionErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center gap-3 p-4 border border-destructive/30 rounded-lg bg-destructive/5 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>Este módulo no pudo cargarse. Recarga la página si el problema persiste.</span>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

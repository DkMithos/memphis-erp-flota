/**
 * Imperative Confirm Dialog — reemplaza confirm() nativo
 * Uso: const ok = await confirmAction({ title, description });
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirmAction: ConfirmFn = useCallback((opts) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  };

  const handleCancel = () => {
    setOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirmAction}>
      {children}
      <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title}</AlertDialogTitle>
            {options.description && (
              <AlertDialogDescription>{options.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {options.cancelLabel ?? 'Cancelar'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={options.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
            >
              {options.confirmLabel ?? 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirmAction(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error('useConfirmAction debe usarse dentro de ConfirmDialogProvider');
  return fn;
}

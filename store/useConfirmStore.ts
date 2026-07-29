import { create } from 'zustand';
import { tStatic } from '@/store/useLocaleStore';

// Global, imperative replacement for window.alert/window.confirm — plain
// promise-returning functions (not hooks) so they can be called from event
// handlers and async functions, not just component bodies. State lives in
// this Zustand store (same pattern as useLoadingStore) and is rendered by
// the single <ConfirmSheetHost /> mounted once in app/providers.tsx.

interface ConfirmOptions {
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface AlertOptions {
  buttonText?: string;
}

type Dialog =
  | { kind: 'confirm'; message: string; confirmText: string; cancelText: string; danger: boolean; resolve: (value: boolean) => void }
  | { kind: 'alert'; message: string; buttonText: string; resolve: () => void };

interface ConfirmStoreState {
  dialog: Dialog | null;
}

export const useConfirmStore = create<ConfirmStoreState>(() => ({
  dialog: null,
}));

export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise(resolve => {
    useConfirmStore.setState({
      dialog: {
        kind: 'confirm',
        message,
        confirmText: options.confirmText ?? tStatic('common.ConfirmDialog.confirmDefault'),
        cancelText: options.cancelText ?? tStatic('common.ConfirmDialog.cancelDefault'),
        danger: options.danger ?? false,
        resolve,
      },
    });
  });
}

export function alertDialog(message: string, options: AlertOptions = {}): Promise<void> {
  return new Promise(resolve => {
    useConfirmStore.setState({
      dialog: {
        kind: 'alert',
        message,
        buttonText: options.buttonText ?? tStatic('common.ConfirmDialog.alertButtonDefault'),
        resolve,
      },
    });
  });
}

// Called by ConfirmSheetHost when the user picks an action or dismisses
// via the backdrop. `result` is ignored for alert dialogs (their resolve
// takes no argument) — dismissing one always just closes it.
export function resolveDialog(result: boolean) {
  const { dialog } = useConfirmStore.getState();
  if (!dialog) return;
  useConfirmStore.setState({ dialog: null });
  if (dialog.kind === 'confirm') dialog.resolve(result);
  else dialog.resolve();
}

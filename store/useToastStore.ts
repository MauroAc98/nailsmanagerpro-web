import { create } from 'zustand';

// Global, fire-and-forget success feedback — plain exported function (not a
// hook) so it's callable from async event handlers, same ergonomics as
// confirmDialog/alertDialog in useConfirmStore.ts. Unlike those, there's
// nothing to await: showToast() just queues the message and returns.
// Rendered by the single <ToastHost /> mounted once in app/providers.tsx.

const DURATION_MS = 2500;

interface ToastState {
  message: string | null;
  toastId: number;
}

let nextId = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>(() => ({
  message: null,
  toastId: 0,
}));

// A new toast replaces whatever is currently showing and restarts the timer
// (last-one-wins, no queue) — success feedback is low-stakes enough that
// dropping an overlapped one silently is preferable to stacking dialogs.
export function showToast(message: string) {
  if (hideTimer) clearTimeout(hideTimer);
  const id = ++nextId;
  useToastStore.setState({ message, toastId: id });
  hideTimer = setTimeout(() => {
    if (useToastStore.getState().toastId === id) {
      useToastStore.setState({ message: null });
    }
  }, DURATION_MS);
}

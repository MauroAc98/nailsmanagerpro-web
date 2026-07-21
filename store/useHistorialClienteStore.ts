import { create } from 'zustand';

// Imperative sheet for viewing a cliente's turno history from anywhere in
// the app (e.g. ClienteCard in the list) without navigating — rendered by
// the single <HistorialClienteSheetHost /> mounted once in app/providers.tsx.

interface HistorialClienteState {
  clienteId: number | null;
}

export const useHistorialClienteStore = create<HistorialClienteState>(() => ({
  clienteId: null,
}));

export function abrirHistorial(clienteId: number) {
  useHistorialClienteStore.setState({ clienteId });
}

export function cerrarHistorial() {
  useHistorialClienteStore.setState({ clienteId: null });
}

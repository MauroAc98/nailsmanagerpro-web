import { create } from 'zustand';

// Estado de conectividad que ve el usuario. Dos fuentes:
//  - los eventos online/offline del navegador (hay red o no), y
//  - los pedidos a la API (api.ts): un pedido que falla sin respuesta del
//    servidor (corte, timeout por señal mala) marca "sin conexión" aunque el
//    navegador crea que hay red, y el primer pedido que responde lo revierte.
interface ConexionState {
  conectado: boolean;
}

export const useConexionStore = create<ConexionState>(() => ({ conectado: true }));

export const marcarConectado = (conectado: boolean) => {
  if (useConexionStore.getState().conectado !== conectado) {
    useConexionStore.setState({ conectado });
  }
};

let escuchando = false;

// Llamar una sola vez, en cliente (mismo criterio que initTheme).
export function initConexion() {
  if (escuchando || typeof window === 'undefined') return;
  escuchando = true;
  marcarConectado(navigator.onLine);
  window.addEventListener('online', () => marcarConectado(true));
  window.addEventListener('offline', () => marcarConectado(false));
  // Lo emite el interceptor de lib/api.ts (no puede importar este store).
  window.addEventListener('app:conexion', e => marcarConectado((e as CustomEvent<{ conectado: boolean }>).detail.conectado));
}

import { useLoadingStore } from '@/store/useLoadingStore';

interface Opciones {
  // Cede un frame antes de correr `fn`, para que el loader llegue a pintarse.
  // Necesario cuando `fn` dispara un aviso nativo o resuelve casi al instante
  // (ubicación en iOS Safari): si corre en el mismo tick en que se prende el
  // loader, el usuario nunca lo ve.
  pintarAntes?: boolean;
  // Tiempo mínimo que el loader queda visible, aunque `fn` resuelva antes.
  minMs?: number;
}

// Espera a que el navegador pinte (rAF + macrotask); el timeout de respaldo
// cubre el caso en que rAF no dispare (pestaña en segundo plano).
const cederParaPintar = () =>
  new Promise<void>((resolve) => {
    let listo = false;
    const fin = () => { if (!listo) { listo = true; resolve(); } };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(fin, 0));
    setTimeout(fin, 100);
  });

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const withGlobalLoader = async <T>(fn: () => Promise<T>, opciones: Opciones = {}): Promise<T> => {
  const { pintarAntes = false, minMs = 0 } = opciones;
  const inicio = Date.now();
  useLoadingStore.getState().setLoading(true);
  try {
    if (pintarAntes) await cederParaPintar();
    return await fn();
  } finally {
    const restante = minMs - (Date.now() - inicio);
    if (restante > 0) await esperar(restante);
    useLoadingStore.getState().setLoading(false);
  }
};

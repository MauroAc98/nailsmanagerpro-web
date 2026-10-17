import { create } from 'zustand';
import { registrarResetPorNegocio } from '@/store/useProAuthStore';
import { vaciarCachesPro } from '@/lib/pro/caches';
import { esFechaValida } from '@/lib/pro/fechaHora';
import { hoyDelDispositivo } from '@/lib/pro/hoy';

// Estado de navegación de la agenda del portal (no son datos del negocio: esos
// viven en las cachés). Se reinicia al cambiar de negocio, de cuenta y al cerrar
// sesión, junto con las cachés.
export interface FiltrosAgenda {
  buscar: string;
  servicioId: number | null;
  // Rango opcional "YYYY-MM-DD"; ambos null = se consulta el día elegido.
  desde: string | null;
  hasta: string | null;
}

interface ProAgendaState {
  fecha: string; // "YYYY-MM-DD"
  mesVisto: string; // "YYYY-MM"
  filtros: FiltrosAgenda;
  setFecha: (fecha: string) => void;
  setMesVisto: (mes: string) => void;
  setFiltros: (cambios: Partial<FiltrosAgenda>) => void;
  limpiarFiltros: () => void;
  reset: () => void;
}

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

const filtrosVacios = (): FiltrosAgenda => ({ buscar: '', servicioId: null, desde: null, hasta: null });

const estadoInicial = () => {
  const hoy = hoyDelDispositivo();
  return { fecha: hoy, mesVisto: hoy.slice(0, 7), filtros: filtrosVacios() };
};

export const useProAgendaStore = create<ProAgendaState>((set) => ({
  ...estadoInicial(),
  // Una fecha inválida se ignora; elegir un día lleva el calendario a su mes.
  setFecha: (fecha) => {
    if (!esFechaValida(fecha)) return;
    set({ fecha, mesVisto: fecha.slice(0, 7) });
  },
  setMesVisto: (mes) => {
    if (MES.test(mes)) set({ mesVisto: mes });
  },
  setFiltros: (cambios) => set((s) => ({ filtros: { ...s.filtros, ...cambios } })),
  limpiarFiltros: () => set(estadoInicial()),
  reset: () => set(estadoInicial()),
}));

// Se registra una sola vez al cargar el módulo: el reset corre en cada cambio de
// negocio, de cuenta, expiración y cierre de sesión (nunca se da de baja: el
// store vive lo que vive la app).
registrarResetPorNegocio(() => {
  useProAgendaStore.getState().reset();
  vaciarCachesPro();
});

import { create } from 'zustand';
import { turnoService, Turno } from '@/services/turnoService';
import { extraerMensajeError } from '@/services/clienteService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';

interface OperacionResult {
  success: boolean;
  message?: string;
}

interface PendientesDeCobroState {
  pendientes: Turno[];
  loading: boolean;

  fetchPendientes: () => Promise<void>;
  actualizarPrecios: (
    id: number,
    servicios: { servicio_id: number; precio: number }[]
  ) => Promise<OperacionResult>;
}

export const usePendientesDeCobroStore = create<PendientesDeCobroState>((set, get) => ({
  pendientes: [],
  loading: false,

  fetchPendientes: async () => {
    set({ loading: true });
    try {
      const pendientes = await turnoService.pendientesDeCobro();
      set({ pendientes });
    } catch (e) {
      console.error('fetchPendientes:', e);
    } finally {
      set({ loading: false });
    }
  },

  actualizarPrecios: async (id, servicios) => {
    return withGlobalLoader(async () => {
      try {
        await turnoService.actualizarPrecios(id, servicios);
        set({ pendientes: get().pendientes.filter(t => t.id !== id) });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },
}));

import { create } from 'zustand';
import { turnoService, Notificaciones } from '@/services/turnoService';
import { extraerMensajeError } from '@/services/clienteService';

interface NotificacionesState {
  data: Notificaciones | null;
  loading: boolean;
  error: string | null;

  fetchNotificaciones: () => Promise<void>;
}

export const useNotificacionesStore = create<NotificacionesState>((set) => ({
  data: null,
  loading: false,
  error: null,

  fetchNotificaciones: async () => {
    set({ loading: true, error: null });
    try {
      const data = await turnoService.notificaciones();
      set({ data });
    } catch (e) {
      // No se pisa `data` acá a propósito: si ya había datos de un fetch
      // anterior exitoso, un fallo puntual no debe hacerlos desaparecer del
      // panel — mismo criterio que useRecordatoriosPendientesStore.
      set({ error: extraerMensajeError(e) });
    } finally {
      set({ loading: false });
    }
  },
}));

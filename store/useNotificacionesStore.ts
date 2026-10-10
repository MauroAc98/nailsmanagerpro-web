import { create } from 'zustand';
import { turnoService, Notificaciones } from '@/services/turnoService';
import { extraerMensajeError } from '@/services/clienteService';

interface NotificacionesState {
  data: Notificaciones | null;
  loading: boolean;
  error: string | null;

  fetchNotificaciones: () => Promise<void>;
  marcarVistas: () => Promise<void>;
  marcarReenvioManual: (mensajeId: number) => Promise<void>;
}

export const useNotificacionesStore = create<NotificacionesState>((set, get) => ({
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

  // Optimista: el badge baja a 0 apenas se abre el panel, sin esperar la
  // respuesta — un fallo puntual acá no es grave (el próximo fetch de
  // notificaciones vuelve a traer el no_vistos real del backend).
  marcarVistas: async () => {
    const { data } = get();
    if (!data || data.no_vistos === 0) return;

    set({ data: { ...data, no_vistos: 0 } });
    try {
      await turnoService.marcarNotificacionesVistas();
    } catch (e) {
      console.error('marcarNotificacionesVistas:', e);
    }
  },

  // Optimista: wa.me ya se abrió en el click, así que el mensaje se muestra
  // como enviado a mano sin esperar. Si el POST falla, el próximo fetch trae
  // el estado real ('failed') y el botón vuelve a aparecer.
  marcarReenvioManual: async (mensajeId) => {
    const { data } = get();
    if (data) {
      set({
        data: {
          ...data,
          mensajes: data.mensajes.map(m =>
            m.id === mensajeId ? { ...m, status: 'manual' as const, reenviable: false } : m),
        },
      });
    }
    try {
      await turnoService.reenvioManualMensaje(mensajeId);
    } catch (e) {
      console.error('reenvioManualMensaje:', e);
    }
  },
}));

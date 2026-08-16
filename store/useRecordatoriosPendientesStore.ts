import { create } from 'zustand';
import { turnoService, Turno } from '@/services/turnoService';
import { extraerMensajeError } from '@/services/clienteService';
import { useAuthStore } from '@/store/useAuthStore';
import { alertDialog } from '@/store/useConfirmStore';
import { tStatic } from '@/store/useLocaleStore';

interface RecordatoriosPendientesState {
  turnos: Turno[];
  loading: boolean;
  error: string | null;

  fetchRecordatoriosPendientes: () => Promise<void>;
  marcarEnviado: (turnoId: number) => Promise<void>;
}

export const useRecordatoriosPendientesStore = create<RecordatoriosPendientesState>((set, get) => ({
  turnos: [],
  loading: false,
  error: null,

  fetchRecordatoriosPendientes: async () => {
    // El 99% de las cuentas tiene el WhatsApp automático sano — no vale la
    // pena gastarles una request en cada foreground de la app solo para
    // confirmar que no hay nada que mostrar.
    if (!useAuthStore.getState().user?.whatsapp_requiere_envio_manual) {
      // Limpiar `error` también: si el flag se curó después de un fetch
      // fallido, este early-return no debe dejar el banner pegado en el
      // estado de error para siempre (cada reintento futuro vuelve a caer
      // acá sin volver a pedir nada).
      set({ turnos: [], error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      // El backend ya filtra confirmados de mañana con cliente con teléfono
      // y excluye los que ya tienen recordatorio gestionado (automático o
      // manual) — no hace falta repetir ese filtro acá.
      const turnos = await turnoService.recordatoriosPendientes();
      set({ turnos });
    } catch (e) {
      // No se pisa `turnos` acá a propósito: si ya había datos de un fetch
      // anterior exitoso, un fallo puntual no debe hacerlos desaparecer.
      // `error` es lo que le avisa al banner que el conteo puede no ser
      // confiable — ver RecordatoriosPendientesBanner.
      set({ error: extraerMensajeError(e) });
    } finally {
      set({ loading: false });
    }
  },

  marcarEnviado: async (turnoId) => {
    set({ turnos: get().turnos.filter(t => t.id !== turnoId) }); // optimista
    try {
      await turnoService.marcarRecordatorioManual(turnoId);
    } catch (e) {
      console.error('marcarRecordatorioManual:', e);
      // No revertimos el filtro optimista: si falló, el próximo fetch
      // (foreground) lo va a traer de nuevo si de verdad no quedó guardado
      // — pero eso pasa en silencio; sin este aviso la profesional cree que
      // ya lo gestionó y no se entera de que hay que reintentar.
      await alertDialog(tStatic('agenda.RecordatoriosPendientesPage.marcarEnviadoError'));
    }
  },
}));

import { create } from 'zustand';
import { turnoService, Turno } from '@/services/turnoService';
import { extraerMensajeError } from '@/services/clienteService';
import { fechaDeManana } from '@/lib/dateFormat';
import { useAuthStore } from '@/store/useAuthStore';

interface RecordatoriosPendientesState {
  turnos: Turno[];
  loading: boolean;
  error: string | null;

  fetchRecordatoriosPendientes: () => Promise<void>;
}

export const useRecordatoriosPendientesStore = create<RecordatoriosPendientesState>((set) => ({
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
      const todos = await turnoService.getAll(fechaDeManana());
      const turnos = todos.filter(
        turno => turno.estado_visual === 'confirmado' && !!turno.cliente?.telefono
      );
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
}));

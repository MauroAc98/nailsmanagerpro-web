import { create } from 'zustand';
import { turnoService, Turno } from '@/services/turnoService';
import { extraerMensajeError } from '@/services/clienteService';
import { rangoDeCobros } from '@/lib/cobros';

interface CobrosState {
  turnos: Turno[];
  loading: boolean;
  error: string | null;
  fetchCobros: () => Promise<void>;
}

// Turnos de la ventana de Cobros (ver rangoDeCobros). No pisa `turnos` si el
// fetch falla: un corte puntual no debe vaciar lo que ya se estaba viendo.
export const useCobrosStore = create<CobrosState>((set) => ({
  turnos: [],
  loading: false,
  error: null,

  fetchCobros: async () => {
    set({ loading: true, error: null });
    try {
      const { desde, hasta } = rangoDeCobros();
      const turnos = await turnoService.buscarPorRango(desde, hasta);
      set({ turnos });
    } catch (e) {
      set({ error: extraerMensajeError(e) });
    } finally {
      set({ loading: false });
    }
  },
}));

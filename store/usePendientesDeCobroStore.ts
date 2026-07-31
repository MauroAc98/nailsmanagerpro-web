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
  error: string | null;
  buscar: string;

  fetchPendientes: () => Promise<void>;
  actualizarPrecios: (
    id: number,
    servicios: { servicio_id: number; precio: number }[]
  ) => Promise<OperacionResult>;
  setBuscar: (texto: string) => void;
}

export const usePendientesDeCobroStore = create<PendientesDeCobroState>((set, get) => ({
  pendientes: [],
  loading: false,
  error: null,
  buscar: '',

  setBuscar: (texto) => set({ buscar: texto }),

  fetchPendientes: async () => {
    set({ loading: true, error: null });
    try {
      const pendientes = await turnoService.pendientesDeCobro();
      set({ pendientes });
    } catch (e) {
      // No se pisa `pendientes` acá a propósito: si ya había datos de un
      // fetch anterior exitoso, un fallo puntual no debe hacerlos
      // desaparecer. `error` es lo que le avisa al badge/banner que el
      // conteo actual puede no ser confiable — ver PendientesDeCobroBanner.
      set({ error: extraerMensajeError(e) });
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

// ─────────────────────────────────────────────
// Selector: pendientes filtrados client-side — mismo patrón que
// useClientesFiltrados. El backend ya acota la lista a 90 días
// (ver DIAS_VENTANA_PENDIENTES_DE_COBRO), así que filtrar en el cliente
// sobre lo ya cargado alcanza, sin pegarle al backend en cada tecla.
// ─────────────────────────────────────────────
export const usePendientesFiltrados = () => {
  const { pendientes, buscar } = usePendientesDeCobroStore();
  if (!buscar.trim()) return pendientes;
  const q = buscar.toLowerCase();
  return pendientes.filter(t =>
    `${t.cliente.nombre} ${t.cliente.apellido}`.toLowerCase().includes(q)
  );
};

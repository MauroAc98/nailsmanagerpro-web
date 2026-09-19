import { create } from 'zustand';
import {
  bloqueoAgendaService,
  BloqueoAgenda,
  CreateBloqueoAgendaDto,
} from '@/services/bloqueoAgendaService';
import { extraerMensajeError } from '@/services/clienteService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';

interface OperacionResult {
  success: boolean;
  message?: string;
}

interface BloqueosAgendaState {
  bloqueos: BloqueoAgenda[];
  loading: boolean;
  error: string | null;

  fetchBloqueos: () => Promise<void>;
  agregarBloqueo: (dto: CreateBloqueoAgendaDto) => Promise<OperacionResult>;
  eliminarBloqueo: (id: number) => Promise<OperacionResult>;
}

// Mismo patrón que useCategoriasServicioStore: withGlobalLoader +
// refetch-after-mutation + OperacionResult. Sin `update` — editar un
// bloqueo es borrar + recrear (el backend no expone ese endpoint, ver
// bloqueoAgendaService).
export const useBloqueosAgendaStore = create<BloqueosAgendaState>((set) => ({
  bloqueos: [],
  loading: false,
  error: null,

  fetchBloqueos: async () => {
    set({ loading: true, error: null });
    return withGlobalLoader(async () => {
      try {
        const bloqueos = await bloqueoAgendaService.getAll();
        set({ bloqueos });
      } catch (e) {
        set({ error: extraerMensajeError(e) });
      } finally {
        set({ loading: false });
      }
    });
  },

  agregarBloqueo: async (dto) => {
    return withGlobalLoader(async () => {
      try {
        await bloqueoAgendaService.create(dto);
        const bloqueos = await bloqueoAgendaService.getAll();
        set({ bloqueos });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  eliminarBloqueo: async (id) => {
    return withGlobalLoader(async () => {
      try {
        await bloqueoAgendaService.delete(id);
        const bloqueos = await bloqueoAgendaService.getAll();
        set({ bloqueos });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },
}));

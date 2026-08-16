import { create } from 'zustand';
import { slotService, Slot } from '@/services/slotService';
import { extraerMensajeError } from '@/services/clienteService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';

interface OperacionResult {
  success: boolean;
  message?: string;
}

interface SlotsState {
  slots: Slot[];
  loading: boolean;
  error: string | null;
  // Último profesionalId pedido a fetchSlots (normalizado con ?? null,
  // porque undefined = "todas" es un pedido válido y hay que poder
  // distinguirlo de "sin pedido todavía") — descarta una respuesta que
  // llega después de que se pidió otra profesional (ej. cambiar el
  // selector rápido en agenda/[id]).
  ultimoProfesionalIdSolicitado: number | null;

  fetchSlots: (profesionalId?: number) => Promise<void>;
  agregarSlot: (hora: string, profesionalId?: number) => Promise<OperacionResult>;
  toggleSlot: (id: number, activo: boolean) => Promise<void>;
  eliminarSlot: (id: number) => Promise<OperacionResult>;
}

export const useSlotsStore = create<SlotsState>((set, get) => ({
  slots: [],
  loading: false,
  error: null,
  ultimoProfesionalIdSolicitado: null,

  fetchSlots: async (profesionalId) => {
    const idPedido = profesionalId ?? null;
    set({ loading: true, error: null, ultimoProfesionalIdSolicitado: idPedido });
    return withGlobalLoader(async () => {
      try {
        const slots = await slotService.getAll(profesionalId);
        if (get().ultimoProfesionalIdSolicitado !== idPedido) return;
        set({ slots });
      } catch (e) {
        if (get().ultimoProfesionalIdSolicitado !== idPedido) return;
        set({ error: extraerMensajeError(e) });
      } finally {
        if (get().ultimoProfesionalIdSolicitado === idPedido) set({ loading: false });
      }
    });
  },

  agregarSlot: async (hora, profesionalId) => {
    return withGlobalLoader(async () => {
      try {
        await slotService.create(hora, profesionalId);
        const slots = await slotService.getAll(profesionalId);
        set({ slots });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  toggleSlot: async (id, activo) => {
    set(state => ({
      slots: state.slots.map(s => s.id === id ? { ...s, activo } : s),
    }));
    return withGlobalLoader(async () => {
      try {
        await slotService.toggleActivo(id, activo);
      } catch {
        set(state => ({
          slots: state.slots.map(s => s.id === id ? { ...s, activo: !activo } : s),
        }));
      }
    });
  },

  eliminarSlot: async (id) => {
    return withGlobalLoader(async () => {
      try {
        await slotService.delete(id);
        set(state => ({ slots: state.slots.filter(s => s.id !== id) }));
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },
}));

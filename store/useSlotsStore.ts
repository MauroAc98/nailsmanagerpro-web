import { create } from 'zustand';
import { slotService, Slot } from '@/services/slotService';
import { extraerMensajeError } from '@/services/clienteService';

interface OperacionResult {
  success: boolean;
  message?: string;
}

interface SlotsState {
  slots: Slot[];
  loading: boolean;

  fetchSlots: () => Promise<void>;
  agregarSlot: (hora: string) => Promise<OperacionResult>;
  toggleSlot: (id: number, activo: boolean) => Promise<void>;
  eliminarSlot: (id: number) => Promise<OperacionResult>;
}

export const useSlotsStore = create<SlotsState>((set) => ({
  slots: [],
  loading: false,

  fetchSlots: async () => {
    set({ loading: true });
    try {
      const slots = await slotService.getAll();
      set({ slots });
    } catch (e) {
      console.error('fetchSlots:', e);
    } finally {
      set({ loading: false });
    }
  },

  agregarSlot: async (hora) => {
    try {
      await slotService.create(hora);
      const slots = await slotService.getAll();
      set({ slots });
      return { success: true };
    } catch (e) {
      return { success: false, message: extraerMensajeError(e) };
    }
  },

  toggleSlot: async (id, activo) => {
    set(state => ({
      slots: state.slots.map(s => s.id === id ? { ...s, activo } : s),
    }));
    try {
      await slotService.toggleActivo(id, activo);
    } catch {
      set(state => ({
        slots: state.slots.map(s => s.id === id ? { ...s, activo: !activo } : s),
      }));
    }
  },

  eliminarSlot: async (id) => {
    try {
      await slotService.delete(id);
      set(state => ({ slots: state.slots.filter(s => s.id !== id) }));
      return { success: true };
    } catch (e) {
      return { success: false, message: extraerMensajeError(e) };
    }
  },
}));

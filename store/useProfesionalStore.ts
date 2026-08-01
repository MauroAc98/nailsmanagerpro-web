import { create } from 'zustand';
import {
  profesionalService,
  Profesional,
  CreateProfesionalDto,
  UpdateProfesionalDto,
  extraerMensajeError,
} from '@/services/profesionalService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';

interface OperacionResult {
  success: boolean;
  message?: string;
}

interface ProfesionalesState {
  profesionales: Profesional[];
  loading: boolean;

  fetchProfesionales: () => Promise<void>;
  agregarProfesional: (dto: CreateProfesionalDto) => Promise<OperacionResult>;
  actualizarProfesional: (id: number, dto: UpdateProfesionalDto) => Promise<OperacionResult>;
  toggleActivo: (id: number, activo: boolean) => Promise<void>;
  guardarFondoHistoria: (id: number, archivo: File) => Promise<OperacionResult>;
  borrarFondoHistoria: (id: number) => Promise<OperacionResult>;
  subirFotoHistoriaPrecios: (id: number, archivo: File) => Promise<OperacionResult>;
  borrarFotoHistoriaPrecios: (id: number, fotoId: number) => Promise<OperacionResult>;
}

export const useProfesionalStore = create<ProfesionalesState>((set) => ({
  profesionales: [],
  loading: false,

  fetchProfesionales: async () => {
    set({ loading: true });
    return withGlobalLoader(async () => {
      try {
        const profesionales = await profesionalService.getAll();
        set({ profesionales });
      } catch (e) {
        console.error('fetchProfesionales:', e);
      } finally {
        set({ loading: false });
      }
    });
  },

  agregarProfesional: async (dto) => {
    return withGlobalLoader(async () => {
      try {
        await profesionalService.create(dto);
        const profesionales = await profesionalService.getAll();
        set({ profesionales });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  actualizarProfesional: async (id, dto) => {
    return withGlobalLoader(async () => {
      try {
        await profesionalService.update(id, dto);
        const profesionales = await profesionalService.getAll();
        set({ profesionales });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  toggleActivo: async (id, activo) => {
    set(state => ({
      profesionales: state.profesionales.map(p => p.id === id ? { ...p, activo } : p),
    }));
    return withGlobalLoader(async () => {
      try {
        await profesionalService.update(id, { activo });
      } catch {
        set(state => ({
          profesionales: state.profesionales.map(p => p.id === id ? { ...p, activo: !activo } : p),
        }));
      }
    });
  },

  guardarFondoHistoria: async (id, archivo) => {
    return withGlobalLoader(async () => {
      try {
        const actualizado = await profesionalService.subirFondoHistoria(id, archivo);
        set(state => ({
          profesionales: state.profesionales.map(p => p.id === id ? actualizado : p),
        }));
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  borrarFondoHistoria: async (id) => {
    return withGlobalLoader(async () => {
      try {
        const actualizado = await profesionalService.borrarFondoHistoria(id);
        set(state => ({
          profesionales: state.profesionales.map(p => p.id === id ? actualizado : p),
        }));
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  subirFotoHistoriaPrecios: async (id, archivo) => {
    return withGlobalLoader(async () => {
      try {
        const actualizado = await profesionalService.subirFotoHistoriaPrecios(id, archivo);
        set(state => ({
          profesionales: state.profesionales.map(p => p.id === id ? actualizado : p),
        }));
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  borrarFotoHistoriaPrecios: async (id, fotoId) => {
    return withGlobalLoader(async () => {
      try {
        const actualizado = await profesionalService.borrarFotoHistoriaPrecios(id, fotoId);
        set(state => ({
          profesionales: state.profesionales.map(p => p.id === id ? actualizado : p),
        }));
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },
}));

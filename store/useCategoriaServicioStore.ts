import { create } from 'zustand';
import {
  categoriaServicioService,
  CategoriaServicio,
  CreateCategoriaServicioDto,
  UpdateCategoriaServicioDto,
} from '@/services/categoriaServicioService';
import { extraerMensajeError } from '@/services/clienteService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';

interface OperacionResult {
  success: boolean;
  message?: string;
}

interface CategoriasServicioState {
  categorias: CategoriaServicio[];
  loading: boolean;
  error: string | null;

  fetchCategorias: () => Promise<void>;
  agregarCategoria: (dto: CreateCategoriaServicioDto) => Promise<OperacionResult>;
  actualizarCategoria: (id: number, dto: UpdateCategoriaServicioDto) => Promise<OperacionResult>;
  eliminarCategoria: (id: number) => Promise<OperacionResult>;
}

// Mismo patrón que useServiciosStore/useGastosStore: withGlobalLoader +
// refetch-after-mutation + OperacionResult. Sin `refrescarProfesionales`
// acá — las categorías no viven anidadas en `Profesional` como sí pasa con
// `servicios` (ver useServicioStore.ts), así que no hay otro store que
// desincronizar.
export const useCategoriasServicioStore = create<CategoriasServicioState>((set) => ({
  categorias: [],
  loading: false,
  error: null,

  fetchCategorias: async () => {
    set({ loading: true, error: null });
    return withGlobalLoader(async () => {
      try {
        const categorias = await categoriaServicioService.getAll();
        set({ categorias });
      } catch (e) {
        set({ error: extraerMensajeError(e) });
      } finally {
        set({ loading: false });
      }
    });
  },

  agregarCategoria: async (dto) => {
    return withGlobalLoader(async () => {
      try {
        await categoriaServicioService.create(dto);
        const categorias = await categoriaServicioService.getAll();
        set({ categorias });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  actualizarCategoria: async (id, dto) => {
    return withGlobalLoader(async () => {
      try {
        await categoriaServicioService.update(id, dto);
        const categorias = await categoriaServicioService.getAll();
        set({ categorias });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  eliminarCategoria: async (id) => {
    return withGlobalLoader(async () => {
      try {
        await categoriaServicioService.delete(id);
        const categorias = await categoriaServicioService.getAll();
        set({ categorias });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },
}));

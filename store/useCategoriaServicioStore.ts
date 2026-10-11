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

// Additive: `categoria` solo se completa en el camino de éxito. Permite que
// un caller (SelectorCategoriaServicio, ver design D5) auto-seleccione la
// categoría recién creada sin tener que volver a buscarla en `categorias`
// por nombre (frágil ante duplicados/mayúsculas). El único caller previo
// (categorias/nuevo/page.tsx) solo lee `.success`/`.message`, así que el
// campo nuevo no rompe nada.
interface AgregarCategoriaResult extends OperacionResult {
  categoria?: CategoriaServicio;
}

interface CategoriasServicioState {
  categorias: CategoriaServicio[];
  loading: boolean;
  error: string | null;

  fetchCategorias: () => Promise<void>;
  agregarCategoria: (dto: CreateCategoriaServicioDto) => Promise<AgregarCategoriaResult>;
  actualizarCategoria: (id: number, dto: UpdateCategoriaServicioDto) => Promise<OperacionResult>;
  eliminarCategoria: (id: number) => Promise<OperacionResult>;
  guardarFondoHistoria: (id: number, archivo: File) => Promise<OperacionResult>;
  borrarFondoHistoria: (id: number) => Promise<OperacionResult>;
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
        const categoria = await categoriaServicioService.create(dto);
        const categorias = await categoriaServicioService.getAll();
        set({ categorias });
        return { success: true, categoria };
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

  // Fondo fijo de la historia: el backend devuelve la categoría actualizada,
  // se reemplaza en sitio (sin refetch de la lista) como hace
  // useProfesionalStore.guardarFondoHistoria.
  guardarFondoHistoria: async (id, archivo) => {
    return withGlobalLoader(async () => {
      try {
        const actualizada = await categoriaServicioService.subirFondoHistoria(id, archivo);
        set(state => ({ categorias: state.categorias.map(c => c.id === id ? actualizada : c) }));
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  borrarFondoHistoria: async (id) => {
    return withGlobalLoader(async () => {
      try {
        const actualizada = await categoriaServicioService.borrarFondoHistoria(id);
        set(state => ({ categorias: state.categorias.map(c => c.id === id ? actualizada : c) }));
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },
}));

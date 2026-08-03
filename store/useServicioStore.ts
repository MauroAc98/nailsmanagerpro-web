import { create } from 'zustand';
import {
  servicioService,
  Servicio,
  CreateServicioDto,
  UpdateServicioDto,
} from '@/services/servicioService';
import { extraerMensajeError } from '@/services/clienteService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { profesionalService } from '@/services/profesionalService';
import { alertDialog } from '@/store/useConfirmStore';
import { tStatic } from '@/store/useLocaleStore';

// Refresca Profesional.servicios (relación anidada) directo contra el
// service, sin pasar por useProfesionalStore.fetchProfesionales() — ese
// action envuelve en withGlobalLoader, y como isLoading es un booleano
// simple (no contador), anidarlo dentro del withGlobalLoader de
// agregar/eliminarServicio apagaría el spinner antes de que termine la
// operación externa.
const refrescarProfesionales = async () => {
  const profesionales = await profesionalService.getAll();
  useProfesionalStore.setState({ profesionales });
};

interface OperacionResult {
  success: boolean;
  message?: string;
}

interface ServiciosState {
  servicios: Servicio[];
  loading: boolean;
  error: string | null;
  buscar: string;

  fetchServicios: () => Promise<void>;
  agregarServicio: (dto: CreateServicioDto) => Promise<OperacionResult>;
  actualizarServicio: (id: number, dto: UpdateServicioDto) => Promise<OperacionResult>;
  eliminarServicio: (id: number) => Promise<OperacionResult>;
  toggleServicio: (id: number, activo: boolean) => Promise<void>;
  reordenarServicios: (ids: number[]) => Promise<void>;
  setBuscar: (texto: string) => void;
}

// Reordena `items` sin moverlos fuera de las posiciones que ya ocupan: se
// recorre el array en su orden actual y, en cada posición cuyo id está en
// `newOrder`, se sustituye por el siguiente id de `newOrder` (en secuencia).
// Así el resultado nunca reagrupa entre sí ids afectados y no afectados —
// necesario porque `newOrder` es solo UN grupo (regular o promo) y el resto
// de consumidores (la otra sección de esta pantalla, el filtro `modo` de
// useHistoriaPrecios) dependen únicamente del orden relativo dentro de su
// propio subconjunto, nunca de un intercalado entre grupos.
function reordenarEnSitio<T extends { id: number }>(items: T[], newOrder: number[]): T[] {
  const afectados = new Set(newOrder);
  const porId = new Map(items.map(item => [item.id, item]));
  let cursor = 0;
  return items.map(item => {
    if (!afectados.has(item.id)) return item;
    const siguienteId = newOrder[cursor++];
    return porId.get(siguienteId) ?? item;
  });
}

export const useServiciosStore = create<ServiciosState>((set, get) => ({
  servicios: [],
  loading: false,
  error: null,
  buscar: '',

  setBuscar: (texto) => set({ buscar: texto }),

  fetchServicios: async () => {
    set({ loading: true, error: null });
    return withGlobalLoader(async () => {
      try {
        const servicios = await servicioService.getAll();
        set({ servicios });
      } catch (e) {
        set({ error: extraerMensajeError(e) });
      } finally {
        set({ loading: false });
      }
    });
  },

  agregarServicio: async (dto) => {
    return withGlobalLoader(async () => {
      try {
        await servicioService.create(dto);
        const servicios = await servicioService.getAll();
        set({ servicios });
        // Profesional.servicios (relación anidada, ver profesionalService.ts)
        // gana un id nuevo con esta creación; sin refetch queda desincronizada
        // hasta un F5 — la afecta cualquier consumidor que filtre por
        // pertenencia ahí (useHistoriaPrecios, agenda/nuevo).
        await refrescarProfesionales();
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  actualizarServicio: async (id, dto) => {
    return withGlobalLoader(async () => {
      try {
        await servicioService.update(id, dto);
        const servicios = await servicioService.getAll();
        set({ servicios });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  eliminarServicio: async (id) => {
    return withGlobalLoader(async () => {
      try {
        await servicioService.delete(id);
        const servicios = await servicioService.getAll();
        set({ servicios });
        // Mismo motivo que agregarServicio: el id borrado sigue viviendo en
        // Profesional.servicios hasta refrescar ese store aparte.
        await refrescarProfesionales();
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  toggleServicio: async (id, activo) => {
    set(state => ({
      servicios: state.servicios.map(s => s.id === id ? { ...s, activo } : s),
    }));
    return withGlobalLoader(async () => {
      try {
        await servicioService.update(id, { activo });
      } catch {
        set(state => ({
          servicios: state.servicios.map(s => s.id === id ? { ...s, activo: !activo } : s),
        }));
      }
    });
  },

  reordenarServicios: async (ids) => {
    // Sin withGlobalLoader: el drag-and-drop debe sentirse instantáneo, no
    // dispara un spinner de pantalla completa igual que toggleServicio.
    const anterior = get().servicios;
    set({ servicios: reordenarEnSitio(anterior, ids) });
    try {
      await servicioService.reordenar(ids);
    } catch (e) {
      console.error('reordenarServicios:', e);
      set({ servicios: anterior });
      await alertDialog(tStatic('configuracion.ServiciosPage.reorderError'));
    }
  },
}));

export const useServiciosFiltrados = () => {
  const { servicios, buscar } = useServiciosStore();
  if (!buscar.trim()) return servicios;
  const q = buscar.toLowerCase();
  return servicios.filter(s => s.nombre.toLowerCase().includes(q));
};

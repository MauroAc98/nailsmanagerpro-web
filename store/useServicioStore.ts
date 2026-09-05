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
import { reordenarEnSitio } from '@/lib/reordenarEnSitio';

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
    // reordenarEnSitio solo reacomoda las posiciones del array — el campo
    // `orden` de cada servicio afectado hay que reasignarlo a su índice
    // dentro de `ids` (mismo contrato que PATCH /servicios/reordenar:
    // orden = index sobre el array recibido), si no el sort por `orden`
    // de agruparServiciosPorCategoria deshace el drag en el próximo render
    // (mismo bug ya resuelto para las fotos de historia de precios, ver
    // useProfesionalStore.ts).
    const anterior = get().servicios;
    const nuevoOrden = new Map(ids.map((id, index) => [id, index]));
    const reordenado = reordenarEnSitio(anterior, ids).map(s =>
      nuevoOrden.has(s.id) ? { ...s, orden: nuevoOrden.get(s.id)! } : s
    );
    set({ servicios: reordenado });
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

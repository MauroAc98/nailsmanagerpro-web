import { create } from 'zustand';
import {
  servicioService,
  Servicio,
  CreateServicioDto,
  UpdateServicioDto,
} from '@/services/servicioService';
import { extraerMensajeError } from '@/services/clienteService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';

interface OperacionResult {
  success: boolean;
  message?: string;
}

interface ServiciosState {
  servicios: Servicio[];
  loading: boolean;
  buscar: string;

  fetchServicios: () => Promise<void>;
  agregarServicio: (dto: CreateServicioDto) => Promise<OperacionResult>;
  actualizarServicio: (id: number, dto: UpdateServicioDto) => Promise<OperacionResult>;
  eliminarServicio: (id: number) => Promise<OperacionResult>;
  toggleServicio: (id: number, activo: boolean) => Promise<void>;
  setBuscar: (texto: string) => void;
}

export const useServiciosStore = create<ServiciosState>((set) => ({
  servicios: [],
  loading: false,
  buscar: '',

  setBuscar: (texto) => set({ buscar: texto }),

  fetchServicios: async () => {
    set({ loading: true });
    return withGlobalLoader(async () => {
      try {
        const servicios = await servicioService.getAll();
        set({ servicios });
      } catch (e) {
        console.error('fetchServicios:', e);
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
}));

export const useServiciosFiltrados = () => {
  const { servicios, buscar } = useServiciosStore();
  if (!buscar.trim()) return servicios;
  const q = buscar.toLowerCase();
  return servicios.filter(s => s.nombre.toLowerCase().includes(q));
};

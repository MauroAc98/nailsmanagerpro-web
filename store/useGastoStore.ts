import { create } from 'zustand';
import {
  gastoService,
  Gasto,
  CreateGastoDto,
  UpdateGastoDto,
  RangoFechas,
} from '@/services/gastoService';
import { extraerMensajeError } from '@/services/clienteService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';

interface OperacionResult {
  success: boolean;
  message?: string;
}

interface GastosState {
  gastos: Gasto[];
  loading: boolean;
  error: string | null;
  // Último rango pedido — las mutaciones (agregar/actualizar/eliminar)
  // refrescan CON ESTE MISMO rango, no con el listado completo, para no
  // "perder" el filtro de mes activo en la pantalla (ver estadisticas/
  // page.tsx: mismo problema con rangoActivo, mismo criterio de refetch).
  rangoActual: RangoFechas | undefined;

  fetchGastos: (rango?: RangoFechas) => Promise<void>;
  agregarGasto: (dto: CreateGastoDto) => Promise<OperacionResult>;
  actualizarGasto: (id: number, dto: UpdateGastoDto) => Promise<OperacionResult>;
  eliminarGasto: (id: number) => Promise<OperacionResult>;
}

export const useGastosStore = create<GastosState>((set, get) => ({
  gastos: [],
  loading: false,
  error: null,
  rangoActual: undefined,

  fetchGastos: async (rango) => {
    set({ loading: true, error: null, rangoActual: rango });
    return withGlobalLoader(async () => {
      try {
        const gastos = await gastoService.getAll(rango);
        set({ gastos });
      } catch (e) {
        set({ error: extraerMensajeError(e) });
      } finally {
        set({ loading: false });
      }
    });
  },

  agregarGasto: async (dto) => {
    return withGlobalLoader(async () => {
      try {
        await gastoService.create(dto);
        const gastos = await gastoService.getAll(get().rangoActual);
        set({ gastos });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  actualizarGasto: async (id, dto) => {
    return withGlobalLoader(async () => {
      try {
        await gastoService.update(id, dto);
        const gastos = await gastoService.getAll(get().rangoActual);
        set({ gastos });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  eliminarGasto: async (id) => {
    return withGlobalLoader(async () => {
      try {
        await gastoService.delete(id);
        const gastos = await gastoService.getAll(get().rangoActual);
        set({ gastos });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },
}));

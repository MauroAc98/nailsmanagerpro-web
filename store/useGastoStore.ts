import { create } from 'zustand';
import {
  gastoService,
  Gasto,
  CreateGastoDto,
  UpdateGastoDto,
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

  fetchGastos: () => Promise<void>;
  agregarGasto: (dto: CreateGastoDto) => Promise<OperacionResult>;
  actualizarGasto: (id: number, dto: UpdateGastoDto) => Promise<OperacionResult>;
  eliminarGasto: (id: number) => Promise<OperacionResult>;
}

export const useGastosStore = create<GastosState>((set) => ({
  gastos: [],
  loading: false,
  error: null,

  fetchGastos: async () => {
    set({ loading: true, error: null });
    return withGlobalLoader(async () => {
      try {
        const gastos = await gastoService.getAll();
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
        const gastos = await gastoService.getAll();
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
        const gastos = await gastoService.getAll();
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
        const gastos = await gastoService.getAll();
        set({ gastos });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },
}));

// `GET /gastos` no soporta filtro server-side por rango de fechas (ver
// gastoService.getAll) — a diferencia de lo que design.md asumía. El
// listado mensual (PR3b) filtra client-side sobre el array completo ya
// cargado en el store, mismo patrón que useServiciosFiltrados en
// useServicioStore.ts. `month` es 1-indexado (enero = 1), igual que el
// componente Date-picker del resto de la app.
export const useGastosDelMes = (year: number, month: number): Gasto[] => {
  const { gastos } = useGastosStore();
  return gastos.filter((g) => {
    const [y, m] = g.fecha.split('-').map(Number);
    return y === year && m === month;
  });
};

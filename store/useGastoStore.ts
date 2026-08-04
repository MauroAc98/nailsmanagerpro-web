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

// Compara por valor, no por referencia — `rango`/`rangoActual` son objetos
// literales nuevos en cada llamado (ver page.tsx: `rango` se recalcula en
// cada render), así que `===` siempre daría falso incluso para el mismo mes.
function mismoRango(a: RangoFechas | undefined, b: RangoFechas | undefined): boolean {
  return a?.desde === b?.desde && a?.hasta === b?.hasta;
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

  // Guardia anti-carrera: si el usuario navega de mes rápido, dos fetch
  // pueden quedar en vuelo a la vez y resolver fuera de orden — sin esto,
  // el que responde último "gana" aunque sea el más viejo, y el header
  // termina mostrando un mes con los datos de otro (mismo problema que
  // estadisticas/page.tsx ya resuelve con su flag `cancelled`, acá resuelto
  // a nivel store en vez de por componente para cubrir cualquier consumidor
  // futuro). Se compara `rangoActual` recién leído post-await contra el
  // `rango` que ESTE llamado pidió — si otro fetch más nuevo ya lo pisó,
  // este resultado se descarta.
  fetchGastos: async (rango) => {
    set({ loading: true, error: null, rangoActual: rango });
    return withGlobalLoader(async () => {
      try {
        const gastos = await gastoService.getAll(rango);
        if (!mismoRango(get().rangoActual, rango)) return;
        set({ gastos });
      } catch (e) {
        if (!mismoRango(get().rangoActual, rango)) return;
        set({ error: extraerMensajeError(e) });
      } finally {
        if (mismoRango(get().rangoActual, rango)) set({ loading: false });
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

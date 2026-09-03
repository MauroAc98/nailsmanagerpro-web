import { create } from 'zustand';
import {
  ingresoService,
  Ingreso,
  CreateIngresoDto,
  UpdateIngresoDto,
  RangoFechas,
} from '@/services/ingresoService';
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

interface IngresosState {
  ingresos: Ingreso[];
  loading: boolean;
  error: string | null;
  // Último rango pedido — las mutaciones (agregar/actualizar/eliminar)
  // refrescan CON ESTE MISMO rango, no con el listado completo, para no
  // "perder" el filtro de mes activo en la pantalla (mismo criterio que
  // useGastoStore).
  rangoActual: RangoFechas | undefined;

  fetchIngresos: (rango?: RangoFechas) => Promise<void>;
  agregarIngreso: (dto: CreateIngresoDto) => Promise<OperacionResult>;
  actualizarIngreso: (id: number, dto: UpdateIngresoDto) => Promise<OperacionResult>;
  eliminarIngreso: (id: number) => Promise<OperacionResult>;
}

export const useIngresosStore = create<IngresosState>((set, get) => ({
  ingresos: [],
  loading: false,
  error: null,
  rangoActual: undefined,

  // Guardia anti-carrera: si el usuario navega de mes rápido, dos fetch
  // pueden quedar en vuelo a la vez y resolver fuera de orden — sin esto,
  // el que responde último "gana" aunque sea el más viejo, y el header
  // termina mostrando un mes con los datos de otro. Se compara
  // `rangoActual` recién leído post-await contra el `rango` que ESTE
  // llamado pidió — si otro fetch más nuevo ya lo pisó, este resultado se
  // descarta. Mismo criterio que useGastoStore.
  fetchIngresos: async (rango) => {
    set({ loading: true, error: null, rangoActual: rango });
    return withGlobalLoader(async () => {
      try {
        const ingresos = await ingresoService.getAll(rango);
        if (!mismoRango(get().rangoActual, rango)) return;
        set({ ingresos });
      } catch (e) {
        if (!mismoRango(get().rangoActual, rango)) return;
        set({ error: extraerMensajeError(e) });
      } finally {
        if (mismoRango(get().rangoActual, rango)) set({ loading: false });
      }
    });
  },

  agregarIngreso: async (dto) => {
    return withGlobalLoader(async () => {
      try {
        await ingresoService.create(dto);
        const ingresos = await ingresoService.getAll(get().rangoActual);
        set({ ingresos });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  actualizarIngreso: async (id, dto) => {
    return withGlobalLoader(async () => {
      try {
        await ingresoService.update(id, dto);
        const ingresos = await ingresoService.getAll(get().rangoActual);
        set({ ingresos });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  eliminarIngreso: async (id) => {
    return withGlobalLoader(async () => {
      try {
        await ingresoService.delete(id);
        const ingresos = await ingresoService.getAll(get().rangoActual);
        set({ ingresos });
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },
}));

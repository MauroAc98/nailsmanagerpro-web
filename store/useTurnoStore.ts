import { create } from 'zustand';
import {
  turnoService,
  Turno,
  TurnoMes,
  CreateTurnoDto,
  UpdateTurnoDto,
  extraerMensajeError,
} from '@/services/turnoService';
import { withGlobalLoader } from '@/store/helpers/withGlobalLoader';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
interface OperacionResult {
  success: boolean;
  message?: string;
}

interface TurnosState {
  turnos: Turno[];
  turnosMes: TurnoMes[];
  loading: boolean;
  error: string | null;
  fechaSeleccionada: string;

  turnoActual: Turno | null;
  loadingTurno: boolean;
  errorTurno: string | null;

  // ── Búsqueda server-side (nombre/servicio/fecha arbitraria) ──
  // Espejo de RN: resultados en un array separado, con su propio flag de
  // carga (cargandoBusqueda) para no disparar el loader global mientras
  // el usuario está escribiendo.
  turnosBusqueda: Turno[];
  buscando: boolean;
  cargandoBusqueda: boolean;
  ultimaBusqueda: string;
  ultimoServicioId: number | null;
  ultimaFecha: string | null;

  fetchTurnos: (fecha: string) => Promise<void>;
  fetchTurnosMes: (mes: string) => Promise<void>;
  fetchTurno: (id: number) => Promise<void>;
  crearTurno: (dto: CreateTurnoDto) => Promise<OperacionResult>;
  actualizarTurno: (id: number, dto: UpdateTurnoDto) => Promise<OperacionResult>;
  completarTurno: (id: number) => Promise<OperacionResult>;
  cancelarTurno: (id: number) => Promise<OperacionResult>;
  setFechaSeleccionada: (fecha: string) => void;

  buscarPorNombre: (nombre: string) => Promise<void>;
  buscarPorServicio: (id: number | null) => Promise<void>;
  buscarPorFecha: (fecha: string | null) => Promise<void>;
  limpiarBusqueda: () => void;
}

// ─────────────────────────────────────────────
// refrescarAgenda — refresca día + mes juntos tras cualquier
// mutación (crear/editar/completar/cancelar), igual que RN. También
// re-ejecuta la búsqueda activa (si hay una) para que turnosBusqueda no
// quede desactualizado tras cancelar/completar un turno filtrado.
// ─────────────────────────────────────────────
const refrescarAgenda = async (
  get: () => TurnosState,
  set: (partial: Partial<TurnosState>) => void,
  fecha: string,
): Promise<void> => {
  const { ultimaBusqueda, ultimoServicioId, ultimaFecha } = get();
  const hayFiltro = ultimaBusqueda.trim().length > 0 || ultimoServicioId !== null || ultimaFecha !== null;
  const mes = fecha.slice(0, 7);

  if (hayFiltro) set({ cargandoBusqueda: true });

  try {
    const tareas: Promise<void>[] = [
      get().fetchTurnos(fecha),
      turnoService.getByMes(mes).then(turnosMes => set({ turnosMes })).catch(e => {
        console.error('fetchTurnosMes:', e);
      }),
    ];

    if (ultimaBusqueda.trim().length > 0) {
      tareas.push(turnoService.buscarPorNombre(ultimaBusqueda).then(r => set({ turnosBusqueda: r })));
    } else if (ultimoServicioId !== null) {
      tareas.push(turnoService.buscarPorServicio(ultimoServicioId).then(r => set({ turnosBusqueda: r })));
    } else if (ultimaFecha !== null) {
      tareas.push(turnoService.buscarPorFecha(ultimaFecha).then(r => set({ turnosBusqueda: r })));
    }

    await Promise.all(tareas);
  } finally {
    if (hayFiltro) set({ cargandoBusqueda: false });
  }
};

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────
export const useTurnoStore = create<TurnosState>((set, get) => ({
  turnos: [],
  turnosMes: [],
  loading: false,
  error: null,
  fechaSeleccionada: new Date().toISOString().split('T')[0],

  turnoActual: null,
  loadingTurno: false,
  errorTurno: null,

  turnosBusqueda: [],
  buscando: false,
  cargandoBusqueda: false,
  ultimaBusqueda: '',
  ultimoServicioId: null,
  ultimaFecha: null,

  setFechaSeleccionada: (fecha) => set({ fechaSeleccionada: fecha }),

  // ─────────────────────────────────────────────
  // fetchTurnos — sets fechaSeleccionada then fetches
  // ─────────────────────────────────────────────
  fetchTurnos: async (fecha) => {
    set({ loading: true, error: null, fechaSeleccionada: fecha });
    return withGlobalLoader(async () => {
      try {
        const turnos = await turnoService.getAll(fecha);
        set({ turnos });
      } catch (e) {
        set({ error: extraerMensajeError(e) });
      } finally {
        set({ loading: false });
      }
    });
  },

  // ─────────────────────────────────────────────
  // fetchTurnosMes
  // ─────────────────────────────────────────────
  fetchTurnosMes: async (mes) => {
    try {
      const turnosMes = await turnoService.getByMes(mes);
      set({ turnosMes });
    } catch (e) {
      console.error('fetchTurnosMes:', e);
    }
  },

  // ─────────────────────────────────────────────
  // fetchTurno — carga un turno individual (pantalla de edición)
  // ─────────────────────────────────────────────
  fetchTurno: async (id) => {
    set({ loadingTurno: true, errorTurno: null, turnoActual: null });
    return withGlobalLoader(async () => {
      try {
        const turno = await turnoService.getOne(id);
        set({ turnoActual: turno });
      } catch (e) {
        set({ errorTurno: extraerMensajeError(e) });
      } finally {
        set({ loadingTurno: false });
      }
    });
  },

  // ─────────────────────────────────────────────
  // crearTurno
  // ─────────────────────────────────────────────
  crearTurno: async (dto) => {
    return withGlobalLoader(async () => {
      try {
        await turnoService.create(dto);
        await refrescarAgenda(get, set, get().fechaSeleccionada);
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  // ─────────────────────────────────────────────
  // actualizarTurno
  // ─────────────────────────────────────────────
  actualizarTurno: async (id, dto) => {
    return withGlobalLoader(async () => {
      try {
        await turnoService.update(id, dto);
        await refrescarAgenda(get, set, get().fechaSeleccionada);
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  // ─────────────────────────────────────────────
  // completarTurno
  // ─────────────────────────────────────────────
  completarTurno: async (id) => {
    return withGlobalLoader(async () => {
      try {
        await turnoService.completar(id);
        await refrescarAgenda(get, set, get().fechaSeleccionada);
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  // ─────────────────────────────────────────────
  // cancelarTurno — maps to DELETE endpoint
  // ─────────────────────────────────────────────
  cancelarTurno: async (id) => {
    return withGlobalLoader(async () => {
      try {
        await turnoService.delete(id);
        await refrescarAgenda(get, set, get().fechaSeleccionada);
        return { success: true };
      } catch (e) {
        return { success: false, message: extraerMensajeError(e) };
      }
    });
  },

  // ─────────────────────────────────────────────
  // Búsquedas server-side — sin loader global (el usuario está escribiendo)
  // ─────────────────────────────────────────────
  buscarPorNombre: async (nombre) => {
    if (nombre.trim().length === 0) {
      set({
        turnosBusqueda: [], buscando: false, cargandoBusqueda: false,
        ultimaBusqueda: '', ultimoServicioId: null, ultimaFecha: null,
      });
      return;
    }
    set({ buscando: true, cargandoBusqueda: true, ultimaBusqueda: nombre, ultimoServicioId: null, ultimaFecha: null });
    try {
      const resultados = await turnoService.buscarPorNombre(nombre);
      set({ turnosBusqueda: resultados });
    } catch (e) {
      console.error('buscarPorNombre:', extraerMensajeError(e));
    } finally {
      set({ cargandoBusqueda: false });
    }
  },

  buscarPorServicio: async (id) => {
    if (id === null) {
      set({ turnosBusqueda: [], buscando: false, cargandoBusqueda: false, ultimoServicioId: null });
      return;
    }
    set({ buscando: true, cargandoBusqueda: true, ultimoServicioId: id, ultimaBusqueda: '', ultimaFecha: null });
    try {
      const resultados = await turnoService.buscarPorServicio(id);
      set({ turnosBusqueda: resultados });
    } catch (e) {
      console.error('buscarPorServicio:', extraerMensajeError(e));
    } finally {
      set({ cargandoBusqueda: false });
    }
  },

  buscarPorFecha: async (fecha) => {
    if (!fecha) {
      set({ turnosBusqueda: [], buscando: false, cargandoBusqueda: false, ultimaFecha: null });
      return;
    }
    set({ buscando: true, cargandoBusqueda: true, ultimaFecha: fecha, ultimaBusqueda: '', ultimoServicioId: null });
    try {
      const resultados = await turnoService.buscarPorFecha(fecha);
      set({ turnosBusqueda: resultados });
    } catch (e) {
      console.error('buscarPorFecha:', extraerMensajeError(e));
    } finally {
      set({ cargandoBusqueda: false });
    }
  },

  limpiarBusqueda: () => set({
    turnosBusqueda: [],
    buscando: false,
    cargandoBusqueda: false,
    ultimaBusqueda: '',
    ultimoServicioId: null,
    ultimaFecha: null,
  }),
}));

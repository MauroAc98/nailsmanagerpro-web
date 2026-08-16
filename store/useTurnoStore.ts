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
import { fechaDeHoy } from '@/lib/dateFormat';

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
  errorMes: string | null;
  // Último mes pedido a fetchTurnosMes — mismo criterio que
  // turnoIdSolicitado, descarta una respuesta que llega después de que se
  // pidió OTRO mes (ej. navegar rápido entre meses del calendario).
  mesSolicitado: string | null;
  fechaSeleccionada: string;

  turnoActual: Turno | null;
  loadingTurno: boolean;
  errorTurno: string | null;
  // Último id pedido a fetchTurno — descarta una respuesta que llega
  // después de que se pidió OTRO turno (ej. volver a la lista y abrir uno
  // distinto antes de que la primera resuelva), que si no quedaría
  // pisando turnoActual con datos de un turno que ya no es el que se está
  // editando.
  turnoIdSolicitado: number | null;

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
  completarTurno: (
    id: number,
    servicios?: { servicio_id: number; precio: number }[]
  ) => Promise<OperacionResult>;
  cancelarTurno: (id: number, motivoCancelacion: string) => Promise<OperacionResult>;
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
    // Delega a las propias acciones guardadas del store (fetchTurnos ya lo
    // hacía; fetchTurnosMes/buscarPorX no) en vez de reimplementar el
    // fetch acá — llamar directo a turnoService y hacer set() sin el guard
    // de respuesta-vieja dejaba a refrescarAgenda pisando turnosBusqueda/
    // turnosMes con una respuesta más vieja que la que ya haya resuelto la
    // búsqueda/mes "real" del usuario mientras tanto.
    const tareas: Promise<void>[] = [
      get().fetchTurnos(fecha),
      get().fetchTurnosMes(mes),
    ];

    if (ultimaBusqueda.trim().length > 0) {
      tareas.push(get().buscarPorNombre(ultimaBusqueda));
    } else if (ultimoServicioId !== null) {
      tareas.push(get().buscarPorServicio(ultimoServicioId));
    } else if (ultimaFecha !== null) {
      tareas.push(get().buscarPorFecha(ultimaFecha));
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
  errorMes: null,
  mesSolicitado: null,
  fechaSeleccionada: fechaDeHoy(),

  turnoActual: null,
  loadingTurno: false,
  errorTurno: null,
  turnoIdSolicitado: null,

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
        // Descarta si mientras tanto se pidió OTRO día (ej. click rápido
        // entre días/meses) — fechaSeleccionada ya refleja el pedido más
        // reciente porque se setea sincrónicamente arriba.
        if (get().fechaSeleccionada !== fecha) return;
        set({ turnos });
      } catch (e) {
        if (get().fechaSeleccionada !== fecha) return;
        set({ error: extraerMensajeError(e) });
      } finally {
        if (get().fechaSeleccionada === fecha) set({ loading: false });
      }
    });
  },

  // ─────────────────────────────────────────────
  // fetchTurnosMes
  // ─────────────────────────────────────────────
  fetchTurnosMes: async (mes) => {
    set({ errorMes: null, mesSolicitado: mes });
    try {
      const turnosMes = await turnoService.getByMes(mes);
      // Descarta si mientras tanto se pidió OTRO mes — ver comentario de
      // mesSolicitado arriba.
      if (get().mesSolicitado !== mes) return;
      set({ turnosMes });
    } catch (e) {
      if (get().mesSolicitado !== mes) return;
      // Antes solo console.error, sin campo de error expuesto — un fallo
      // de red era indistinguible de "no hay turnos este mes" para la UI.
      set({ errorMes: extraerMensajeError(e) });
    }
  },

  // ─────────────────────────────────────────────
  // fetchTurno — carga un turno individual (pantalla de edición)
  // ─────────────────────────────────────────────
  fetchTurno: async (id) => {
    set({ loadingTurno: true, errorTurno: null, turnoActual: null, turnoIdSolicitado: id });
    return withGlobalLoader(async () => {
      try {
        const turno = await turnoService.getOne(id);
        // Descarta si mientras tanto se pidió OTRO turno — ver comentario
        // de turnoIdSolicitado arriba.
        if (get().turnoIdSolicitado !== id) return;
        set({ turnoActual: turno });
      } catch (e) {
        if (get().turnoIdSolicitado !== id) return;
        set({ errorTurno: extraerMensajeError(e) });
      } finally {
        if (get().turnoIdSolicitado === id) set({ loadingTurno: false });
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
  completarTurno: async (id, servicios) => {
    return withGlobalLoader(async () => {
      try {
        await turnoService.completar(id, servicios);
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
  cancelarTurno: async (id, motivoCancelacion) => {
    return withGlobalLoader(async () => {
      try {
        await turnoService.delete(id, motivoCancelacion);
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
      // Descarta si mientras tanto se tipeó otra búsqueda — sin esto, una
      // respuesta vieja que llega tarde (ej. "ana" resuelve después de
      // "anabel") pisa los resultados con el término anterior.
      if (get().ultimaBusqueda !== nombre) return;
      set({ turnosBusqueda: resultados });
    } catch (e) {
      console.error('buscarPorNombre:', extraerMensajeError(e));
    } finally {
      if (get().ultimaBusqueda === nombre) set({ cargandoBusqueda: false });
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
      if (get().ultimoServicioId !== id) return;
      set({ turnosBusqueda: resultados });
    } catch (e) {
      console.error('buscarPorServicio:', extraerMensajeError(e));
    } finally {
      if (get().ultimoServicioId === id) set({ cargandoBusqueda: false });
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
      if (get().ultimaFecha !== fecha) return;
      set({ turnosBusqueda: resultados });
    } catch (e) {
      console.error('buscarPorFecha:', extraerMensajeError(e));
    } finally {
      if (get().ultimaFecha === fecha) set({ cargandoBusqueda: false });
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

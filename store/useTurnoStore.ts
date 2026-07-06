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

  fetchTurnos: (fecha: string) => Promise<void>;
  fetchTurnosMes: (mes: string) => Promise<void>;
  fetchTurno: (id: number) => Promise<void>;
  crearTurno: (dto: CreateTurnoDto) => Promise<OperacionResult>;
  actualizarTurno: (id: number, dto: UpdateTurnoDto) => Promise<OperacionResult>;
  completarTurno: (id: number) => Promise<OperacionResult>;
  cancelarTurno: (id: number) => Promise<OperacionResult>;
  setFechaSeleccionada: (fecha: string) => void;
}

// ─────────────────────────────────────────────
// refrescarAgenda — refresca día + mes juntos tras cualquier
// mutación (crear/editar/completar/cancelar), igual que RN.
// ─────────────────────────────────────────────
const refrescarAgenda = async (
  get: () => TurnosState,
  set: (partial: Partial<TurnosState>) => void,
  fecha: string,
): Promise<void> => {
  const mes = fecha.slice(0, 7);
  await Promise.all([
    get().fetchTurnos(fecha),
    turnoService.getByMes(mes).then(turnosMes => set({ turnosMes })).catch(e => {
      console.error('fetchTurnosMes:', e);
    }),
  ]);
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
}));

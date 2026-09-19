import { ReservaOnlineError, type ReservaOnlineService } from '../service';
import type {
  Availability,
  AvailabilityQuery,
  BookableService,
  Fecha,
  SalonInfo,
  ServicesQuery,
} from '../types';

// Adapter mock de la reserva online (decision D5). Reemplaza a todo el backend
// en el slice 1; los slices siguientes van sacando metodos de aca. El reloj es
// inyectable (`now`) para que los tests avancen 15 minutos sin timers, y el
// storage tambien, para no depender de localStorage global.

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function memoriaStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

export const MOCK_STORAGE_KEY = 'ro_mock_v1';

// El salon opera en hora de Argentina (UTC-3 fijo, sin DST): asi la conversion
// epoch -> fecha/hora de pared es deterministica y no depende del navegador.
const OFFSET_SALON_MS = -3 * 60 * 60 * 1000;

export function paredDelSalon(ms: number): { fecha: Fecha; minutos: number } {
  const iso = new Date(ms + OFFSET_SALON_MS).toISOString();
  const hh = Number(iso.slice(11, 13));
  const mm = Number(iso.slice(14, 16));
  return { fecha: iso.slice(0, 10), minutos: hh * 60 + mm };
}

export const hhmm = (minutos: number): string =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

export const aMinutos = (hora: string): number => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

interface MockService extends BookableService {
  profesionalIds: number[]; // quienes lo ofrecen
}

interface MockSalon {
  info: SalonInfo;
  servicios: MockService[];
}

const APERTURA_MIN = 10 * 60;
const CIERRE_MIN = 18 * 60;
const PASO_MIN = 30;
export const ANTICIPACION_DEFAULT_MIN = 120; // mismo default que config('reservas.anticipacion_minutos') del backend

const SEED: Record<string, MockSalon> = {
  demo: {
    info: {
      nombre: 'Studio Demo',
      logoUrl: null,
      direccion: 'Av. Siempreviva 742',
      profesionales: [
        { id: 1, nombre: 'Ana' },
        { id: 2, nombre: 'Lucía' },
      ],
    },
    servicios: [
      { id: 1, nombre: 'Esmaltado semipermanente', duracionMinutos: 45, precio: 12000, profesionalIds: [1, 2] },
      { id: 2, nombre: 'Retiro de esmalte', duracionMinutos: 30, precio: 8000, profesionalIds: [1, 2] },
      { id: 3, nombre: 'Kapping gel', duracionMinutos: 90, precio: 20000, profesionalIds: [1] },
    ],
  },
};

export interface MockOptions {
  now?: () => number;
  storage?: StorageLike;
}

export type MockService_ = ReservaOnlineService;

export function createMockService(opts: MockOptions = {}): ReservaOnlineService {
  const now = opts.now ?? Date.now;
  void opts.storage; // se usa en los metodos de escritura

  const salon = (slug: string): MockSalon => {
    const s = SEED[slug];
    if (!s) throw new ReservaOnlineError('not_found', `salon ${slug}`);
    return s;
  };

  const getSalon = async (slug: string): Promise<SalonInfo> => structuredClone(salon(slug).info);

  const getServices = async (slug: string, query?: ServicesQuery): Promise<BookableService[]> => {
    const s = salon(slug);
    return s.servicios
      .filter((x) => query?.profesionalId === undefined || x.profesionalIds.includes(query.profesionalId))
      .map(({ id, nombre, duracionMinutos, precio }) => ({ id, nombre, duracionMinutos, precio }));
  };

  const getAvailability = async (slug: string, q: AvailabilityQuery): Promise<Availability> => {
    const s = salon(slug);
    if (q.servicioIds.length === 0) throw new ReservaOnlineError('validation', 'servicio_ids');
    const elegidos = q.servicioIds.map((id) => s.servicios.find((x) => x.id === id));
    if (elegidos.some((x) => !x)) throw new ReservaOnlineError('validation', 'servicio_ids');
    const servicios = elegidos as MockService[];

    const hoy = paredDelSalon(now());
    if (q.fecha < hoy.fecha) throw new ReservaOnlineError('validation', 'fecha');

    const duracion = servicios.reduce((a, x) => a + x.duracionMinutos, 0);
    // Profesionales que ofrecen TODOS los servicios elegidos.
    let candidatos = s.info.profesionales
      .map((p) => p.id)
      .filter((id) => servicios.every((x) => x.profesionalIds.includes(id)));
    if (q.profesionalId !== undefined) {
      if (!candidatos.includes(q.profesionalId)) throw new ReservaOnlineError('validation', 'profesional_id');
      candidatos = [q.profesionalId];
    }

    const minInicio = q.fecha === hoy.fecha ? hoy.minutos + ANTICIPACION_DEFAULT_MIN : 0;
    const slots: Availability['slots'] = [];
    for (let m = APERTURA_MIN; m + duracion <= CIERRE_MIN; m += PASO_MIN) {
      if (m < minInicio) continue;
      const libres = candidatos.filter((id) => estaLibre(id, q.fecha, m, duracion));
      if (libres.length > 0) slots.push({ hora: hhmm(m), profesionalIds: libres });
    }
    return { fecha: q.fecha, duracionTotalMinutos: duracion, slots };
  };

  // Se completa con las reservas creadas en el grupo de escritura.
  function estaLibre(_profesionalId: number, _fecha: Fecha, _inicio: number, _duracion: number): boolean {
    return true;
  }

  const noImplementado = (): never => {
    throw new Error('mock: metodo de escritura todavia no implementado');
  };

  return {
    getSalon,
    getServices,
    getAvailability,
    getTerms: noImplementado,
    createReservation: noImplementado,
    getReservationStatus: noImplementado,
    cancelReservation: noImplementado,
    getSettings: noImplementado,
    saveSettings: noImplementado,
    getMpConnection: noImplementado,
    connectMp: noImplementado,
    disconnectMp: noImplementado,
    listOnlineBookings: noImplementado,
  };
}

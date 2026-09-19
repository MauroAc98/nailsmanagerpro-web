import { MAX_FOTOS_SERVICIO, ReservaOnlineError, type ReservaOnlineReads, type ReservaOnlineService } from '../service';
import type {
  Availability,
  AvailabilityQuery,
  DiasQuery,
  BookableService,
  CreateReservationInput,
  Fecha,
  MpConnection,
  OnlineBooking,
  ReservaOnlineSettings,
  ReservationCreated,
  ReservationStatus,
  ReservationStatusValue,
  ReservationTerms,
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

// Fotos de ejemplo: baldosas de gradiente ('placeholder:N', sin imagenes externas).
const placeholders = (n: number): string[] => Array.from({ length: n }, (_, i) => `placeholder:${i}`);

interface MockServicio extends BookableService {
  profesionalIds: number[]; // quienes lo ofrecen
}

interface MockSalon {
  info: SalonInfo;
  servicios: MockServicio[];
}

// Los horarios configurados por el salon definen un RANGO de inicios (primer y
// ultimo inicio posibles), no una lista de turnos: la disponibilidad es la
// grilla de inicios cada PASO_MIN entre ambos extremos (inclusive), menos los
// que solapan un turno ocupado, una reserva pendiente o caen antes de ahora +
// anticipacion. Espeja config('reservas.paso_minutos') del backend.
const PRIMER_INICIO_MIN = 9 * 60;
const ULTIMO_INICIO_MIN = 18 * 60;
const PASO_MIN = 30;
const MIN_MS = 60_000;

// Defaults de los ajustes. La anticipacion espeja config('reservas.anticipacion_minutos')
// del backend (riesgo de drift anotado en el diseno).
export const SETTINGS_DEFAULT: ReservaOnlineSettings = {
  habilitada: false,
  deposito: 5000,
  ventanaPagoMinutos: 15,
  anticipacionMinutos: 120,
  ventanaCancelacionHoras: 24,
};

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
      { id: 1, nombre: 'Esmaltado semipermanente', duracionMinutos: 45, precio: 12000, fotos: placeholders(4), profesionalIds: [1, 2] },
      { id: 2, nombre: 'Retiro de esmalte', duracionMinutos: 30, precio: 8000, fotos: [], profesionalIds: [1, 2] },
      { id: 3, nombre: 'Kapping gel', duracionMinutos: 90, precio: 20000, fotos: placeholders(6), profesionalIds: [1] },
    ],
  },
};

interface ReservaGuardada {
  id: string;
  slug: string;
  servicioIds: number[];
  profesionalId: number;
  fecha: Fecha;
  hora: string;
  clienteNombre: string;
  duracionTotalMinutos: number;
  deposito: number;
  nota?: string;
  createdAtMs: number;
  expiresAtMs: number;
  status: 'pending_payment' | 'confirmed' | 'cancelled';
  pagadaAtMs: number | null;
}

interface Persistido {
  seq: number;
  reservas: ReservaGuardada[];
  settings: ReservaOnlineSettings;
  mp: MpConnection;
  fotosServicio: Record<number, string[]>;
}

const ESTADO_INICIAL = (): Persistido => ({
  seq: 0,
  reservas: [],
  settings: { ...SETTINGS_DEFAULT },
  mp: { conectada: false, cuenta: null },
  fotosServicio: {},
});

export interface MockOptions {
  now?: () => number;
  storage?: StorageLike;
  // Lecturas reales (composicion): para salones que no son `demo`, las
  // escrituras mock calculan servicios y horarios libres a traves de ellas.
  lecturas?: ReservaOnlineReads;
}

// Helper solo de desarrollo/tests: simula que Mercado Pago aprobo el pago.
export type MockReservaOnlineService = ReservaOnlineService & {
  simulatePayment(id: string): Promise<void>;
};

export function createMockService(opts: MockOptions = {}): MockReservaOnlineService {
  const now = opts.now ?? Date.now;
  const storage =
    opts.storage ?? (typeof localStorage !== 'undefined' ? localStorage : memoriaStorage());

  // Se lee del storage en cada operacion: varias instancias (o una pagina
  // refrescada) sobre el mismo storage ven siempre el mismo estado.
  const cargar = (): Persistido => {
    try {
      const raw = storage.getItem(MOCK_STORAGE_KEY);
      if (raw) return { ...ESTADO_INICIAL(), ...(JSON.parse(raw) as Partial<Persistido>) };
    } catch {
      // JSON corrupto: se arranca de cero, es solo un mock
    }
    return ESTADO_INICIAL();
  };
  const guardar = (p: Persistido) => storage.setItem(MOCK_STORAGE_KEY, JSON.stringify(p));

  const salon = (slug: string): MockSalon => {
    const s = SEED[slug];
    if (!s) throw new ReservaOnlineError('not_found', `salon ${slug}`);
    return s;
  };

  const estadoEfectivo = (r: ReservaGuardada): ReservationStatusValue =>
    r.status === 'pending_payment' && now() >= r.expiresAtMs ? 'expired' : r.status;

  const ocupa = (r: ReservaGuardada): boolean => {
    const e = estadoEfectivo(r);
    return e === 'pending_payment' || e === 'confirmed';
  };

  const estaLibre = (
    p: Persistido,
    slug: string,
    profesionalId: number,
    fecha: Fecha,
    inicio: number,
    duracion: number,
  ): boolean =>
    !p.reservas.some((r) => {
      if (r.slug !== slug || r.profesionalId !== profesionalId || r.fecha !== fecha || !ocupa(r)) return false;
      const ri = aMinutos(r.hora);
      // Solapamiento semiabierto: adyacente NO solapa.
      return ri < inicio + duracion && ri + r.duracionTotalMinutos > inicio;
    });

  const getSalon = async (slug: string): Promise<SalonInfo> => structuredClone(salon(slug).info);

  const getServices = async (slug: string, query?: ServicesQuery): Promise<BookableService[]> =>
    salon(slug)
      .servicios.filter(
        (x) => query?.profesionalId === undefined || x.profesionalIds.includes(query.profesionalId),
      )
      .map(({ id, nombre, duracionMinutos, precio, fotos }) => ({ id, nombre, duracionMinutos, precio, fotos: [...fotos] }));

  const resolverServicios = (s: MockSalon, ids: number[]): MockServicio[] => {
    if (ids.length === 0) throw new ReservaOnlineError('validation', 'servicio_ids');
    return ids.map((id) => {
      const x = s.servicios.find((y) => y.id === id);
      if (!x) throw new ReservaOnlineError('validation', 'servicio_ids');
      return x;
    });
  };

  const getAvailability = async (slug: string, q: AvailabilityQuery): Promise<Availability> => {
    const s = salon(slug);
    const servicios = resolverServicios(s, q.servicioIds);
    const hoy = paredDelSalon(now());
    if (q.fecha < hoy.fecha) throw new ReservaOnlineError('validation', 'fecha');

    const p = cargar();
    const duracion = servicios.reduce((a, x) => a + x.duracionMinutos, 0);
    // Profesionales que ofrecen TODOS los servicios elegidos.
    let candidatos = s.info.profesionales
      .map((x) => x.id)
      .filter((id) => servicios.every((x) => x.profesionalIds.includes(id)));
    if (q.profesionalId !== undefined) {
      if (!candidatos.includes(q.profesionalId)) throw new ReservaOnlineError('validation', 'profesional_id');
      candidatos = [q.profesionalId];
    }

    const minInicio = q.fecha === hoy.fecha ? hoy.minutos + p.settings.anticipacionMinutos : 0;
    const slots: Availability['slots'] = [];
    for (let m = PRIMER_INICIO_MIN; m <= ULTIMO_INICIO_MIN; m += PASO_MIN) {
      if (m < minInicio) continue;
      const libres = candidatos.filter((id) => estaLibre(p, slug, id, q.fecha, m, duracion));
      if (libres.length > 0) slots.push({ hora: hhmm(m), profesionalIds: libres });
    }
    return { fecha: q.fecha, duracionTotalMinutos: duracion, slots };
  };

  // Solo el mock conoce la agenda completa: marca los dias con al menos un horario libre.
  const getDiasConDisponibilidad = async (slug: string, q: DiasQuery): Promise<Fecha[] | null> => {
    const con: Fecha[] = [];
    for (const fecha of q.fechas) {
      try {
        const disp = await getAvailability(slug, {
          fecha,
          servicioIds: q.servicioIds,
          profesionalId: q.profesionalId,
        });
        if (disp.slots.length > 0) con.push(fecha);
      } catch (e) {
        // fecha pasada (validation): sin disponibilidad; cualquier otro error se propaga
        if (!(e instanceof ReservaOnlineError && e.code === 'validation')) throw e;
      }
    }
    return con;
  };

  const getTerms = async (slug: string): Promise<ReservationTerms> => {
    if (!SEED[slug] && !opts.lecturas) throw new ReservaOnlineError('not_found', `salon ${slug}`);
    const { settings } = cargar();
    return {
      deposito: settings.deposito,
      ventanaPagoMinutos: settings.ventanaPagoMinutos,
      anticipacionMinutos: settings.anticipacionMinutos,
      ventanaCancelacionHoras: settings.ventanaCancelacionHoras,
    };
  };

  const createReservation = async (
    slug: string,
    input: CreateReservationInput,
  ): Promise<ReservationCreated> => {
    const consulta = {
      fecha: input.fecha,
      servicioIds: input.servicioIds,
      profesionalId: input.profesionalId,
    };
    let disp: Availability;
    if (SEED[slug]) {
      resolverServicios(SEED[slug], input.servicioIds); // valida los ids
      // Reusa la disponibilidad: valida profesional/fecha y decide si el horario sigue libre.
      disp = await getAvailability(slug, consulta);
    } else if (opts.lecturas) {
      const todos = await opts.lecturas.getServices(slug);
      for (const id of input.servicioIds) {
        if (!todos.some((y) => y.id === id)) throw new ReservaOnlineError('validation', 'servicio_ids');
      }
      disp = await opts.lecturas.getAvailability(slug, consulta);
    } else {
      throw new ReservaOnlineError('not_found', `salon ${slug}`);
    }
    if (!disp.slots.some((x) => x.hora === input.hora)) throw new ReservaOnlineError('slot_taken');

    const p = cargar();
    const id = `mock-${p.seq + 1}`;
    const createdAtMs = now();
    const expiresAtMs = createdAtMs + p.settings.ventanaPagoMinutos * MIN_MS;
    p.seq += 1;
    p.reservas.push({
      id,
      slug,
      servicioIds: input.servicioIds,
      profesionalId: input.profesionalId,
      fecha: input.fecha,
      hora: input.hora,
      clienteNombre: `${input.cliente.nombre} ${input.cliente.apellido}`.trim(),
      duracionTotalMinutos: disp.duracionTotalMinutos,
      deposito: p.settings.deposito,
      nota: input.nota?.trim() || undefined,
      createdAtMs,
      expiresAtMs,
      status: 'pending_payment',
      pagadaAtMs: null,
    });
    guardar(p);
    return { id, status: 'pending_payment', expiresAtMs, checkoutUrl: `/reservar/${slug}/reserva/${id}?mock=1` };
  };

  const buscar = (p: Persistido, slug: string, id: string): ReservaGuardada => {
    const r = p.reservas.find((x) => x.id === id && x.slug === slug);
    if (!r) throw new ReservaOnlineError('not_found', `reserva ${id}`);
    return r;
  };

  const getReservationStatus = async (slug: string, id: string): Promise<ReservationStatus> => {
    const r = buscar(cargar(), slug, id);
    return {
      id: r.id,
      status: estadoEfectivo(r),
      expiresAtMs: r.expiresAtMs,
      checkoutUrl: `/reservar/${slug}/reserva/${r.id}?mock=1`,
      summary: {
        servicioIds: r.servicioIds,
        profesionalId: r.profesionalId,
        fecha: r.fecha,
        hora: r.hora,
        deposito: r.deposito,
        duracionTotalMinutos: r.duracionTotalMinutos,
        nota: r.nota,
      },
    };
  };

  const simulatePayment = async (id: string): Promise<void> => {
    const p = cargar();
    const r = p.reservas.find((x) => x.id === id);
    if (!r) throw new ReservaOnlineError('not_found', `reserva ${id}`);
    if (estadoEfectivo(r) !== 'pending_payment') {
      throw new ReservaOnlineError('validation', 'la reserva ya no esta pendiente de pago');
    }
    r.status = 'confirmed';
    r.pagadaAtMs = now();
    guardar(p);
  };

  const cancelReservation = async (slug: string, id: string): Promise<void> => {
    const p = cargar();
    buscar(p, slug, id).status = 'cancelled';
    guardar(p);
  };

  const getSettings = async (): Promise<ReservaOnlineSettings> => ({ ...cargar().settings });

  const saveSettings = async (patch: Partial<ReservaOnlineSettings>): Promise<ReservaOnlineSettings> => {
    const p = cargar();
    p.settings = { ...p.settings, ...patch };
    guardar(p);
    return { ...p.settings };
  };

  const setMp = async (mp: MpConnection): Promise<MpConnection> => {
    const p = cargar();
    p.mp = mp;
    guardar(p);
    return { ...mp };
  };

  const listOnlineBookings = async (): Promise<OnlineBooking[]> =>
    cargar()
      .reservas.filter((r) => r.status === 'confirmed' && r.pagadaAtMs !== null)
      .sort((a, b) => (b.pagadaAtMs as number) - (a.pagadaAtMs as number))
      .map((r) => ({
        id: r.id,
        clienteNombre: r.clienteNombre,
        fecha: r.fecha,
        hora: r.hora,
        pagadaAtMs: r.pagadaAtMs as number,
        nota: r.nota,
      }));

  const getFotosServicio = async (servicioId: number): Promise<string[]> => [
    ...(cargar().fotosServicio[servicioId] ?? []),
  ];

  const saveFotosServicio = async (servicioId: number, fotos: string[]): Promise<string[]> => {
    if (fotos.length > MAX_FOTOS_SERVICIO) throw new ReservaOnlineError('validation', 'fotos');
    const p = cargar();
    p.fotosServicio = { ...p.fotosServicio, [servicioId]: [...fotos] };
    guardar(p);
    return [...fotos];
  };

  return {
    getSalon,
    getServices,
    getAvailability,
    getDiasConDisponibilidad,
    getTerms,
    createReservation,
    getReservationStatus,
    cancelReservation,
    getSettings,
    saveSettings,
    getMpConnection: async () => ({ ...cargar().mp }),
    connectMp: () => setMp({ conectada: true, cuenta: 'cuenta-demo@turnetto.com' }),
    disconnectMp: () => setMp({ conectada: false, cuenta: null }),
    listOnlineBookings,
    getFotosServicio,
    saveFotosServicio,
    simulatePayment,
  };
}

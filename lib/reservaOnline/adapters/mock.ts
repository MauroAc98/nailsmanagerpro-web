import { MAX_FOTOS_SERVICIO, ReservaOnlineError, type ReservaOnlineReads, type ReservaOnlineService } from '../service';
import type {
  Availability,
  AvailabilityQuery,
  DiasQuery,
  BookableService,
  DatosReserva,
  Fecha,
  MpConnection,
  OnlineBooking,
  ReservaOnlineSettings,
  ReservationCreated,
  ReservationStatus,
  ReservationStatusValue,
  ReservationTerms,
  Retencion,
  RetenerInput,
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

// Intervalo ocupado todos los dias (turnos ya agendados del demo): hace que la
// inicios configurados se descarten y se vea el selector de hora sin solapes.
interface MockOcupado {
  profesionalId: number;
  desde: string; // 'HH:MM'
  hasta: string; // 'HH:MM'
}

interface MockSalon {
  info: SalonInfo;
  servicios: MockServicio[];
  // Inicios ACTIVOS configurados por cada profesional (los desactivados
  // simplemente no estan: ella no atiende a esa hora). Son la unica fuente de
  // horarios ofrecidos: no se genera ninguna grilla.
  horarios: Record<number, string[]>;
  ocupados?: MockOcupado[];
}

// Los horarios ofrecidos son EXACTAMENTE los inicios activos que cada
// profesional configuro (MockSalon.horarios). Un inicio se ofrece si la duracion
// total de los servicios entra sin solapar (semiabierto) un turno ocupado o una
// reserva de ESA profesional, y no cae antes de ahora + anticipacion. Con
// "Cualquiera" se une por hora y se listan solo las profesionales libres.
const MIN_MS = 60_000;
// Tiempo que se retiene el horario mientras la clienta completa sus datos
// (espeja la config del backend). Al iniciar el pago pasa a la ventana de pago.
const HOLD_MINUTOS = 10;

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
        { id: 1, nombre: 'Ana', avatarUrl: null },
        { id: 2, nombre: 'Lucía', avatarUrl: null },
      ],
    },
    servicios: [
      { id: 1, nombre: 'Esmaltado semipermanente', duracionMinutos: 45, precio: 12000, categoria: { id: 1, nombre: 'Manicura' }, fotos: placeholders(4), profesionalIds: [1, 2] },
      { id: 3, nombre: 'Kapping gel', duracionMinutos: 90, precio: 20000, categoria: { id: 1, nombre: 'Manicura' }, fotos: placeholders(6), profesionalIds: [1] },
      { id: 4, nombre: 'Pedicura spa', duracionMinutos: 60, precio: 14000, categoria: { id: 2, nombre: 'Pedicura' }, fotos: [], profesionalIds: [1, 2] },
      { id: 5, nombre: 'Combo mani + pedi', duracionMinutos: 105, precio: 24000, categoria: { id: 3, nombre: 'Promociones' }, fotos: [], profesionalIds: [1, 2] },
      { id: 2, nombre: 'Retiro de esmalte', duracionMinutos: 30, precio: 8000, categoria: null, fotos: [], profesionalIds: [1, 2] },
    ],
    // Ana no atiende a las 09:30, 12:00 ni 15:00 (desactivados); ambas hacen
    // pausa de almuerzo. Horarios irregulares y distintos por profesional.
    horarios: {
      1: ['09:00', '10:30', '11:30', '13:00', '14:00', '16:00', '17:30'],
      2: ['09:30', '10:30', '11:00', '14:00', '15:30', '16:30', '18:00'],
    },
    // Ana 15:00-16:00 y Lucia 15:30-16:30: con "Cualquiera" no hay lugar para
    // un turno de 75 min que arranque en 14:30, 15:00 o 15:30.
    ocupados: [
      { profesionalId: 1, desde: '15:00', hasta: '16:00' },
      { profesionalId: 2, desde: '15:30', hasta: '16:30' },
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
  // 'held' = horario retenido, todavia sin iniciar el pago.
  status: 'held' | 'pending_payment' | 'confirmed' | 'cancelled';
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

  const estadoEfectivo = (r: ReservaGuardada): ReservationStatusValue | 'held' =>
    (r.status === 'pending_payment' || r.status === 'held') && now() >= r.expiresAtMs ? 'expired' : r.status;

  const ocupa = (r: ReservaGuardada): boolean => {
    const e = estadoEfectivo(r);
    return e === 'held' || e === 'pending_payment' || e === 'confirmed';
  };

  const estaLibre = (
    s: MockSalon,
    p: Persistido,
    slug: string,
    profesionalId: number,
    fecha: Fecha,
    inicio: number,
    duracion: number,
  ): boolean =>
    !(s.ocupados ?? []).some(
      (o) => o.profesionalId === profesionalId && aMinutos(o.desde) < inicio + duracion && aMinutos(o.hasta) > inicio,
    ) &&
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
      .map(({ id, nombre, duracionMinutos, precio, categoria, fotos }) => ({
        id, nombre, duracionMinutos, precio, categoria: categoria ? { ...categoria } : null, fotos: [...fotos],
      }));

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
    const porHora = new Map<number, number[]>();
    for (const id of candidatos) {
      for (const hora of new Set(s.horarios[id] ?? [])) {
        const m = aMinutos(hora);
        if (m < minInicio || !estaLibre(s, p, slug, id, q.fecha, m, duracion)) continue;
        porHora.set(m, [...(porHora.get(m) ?? []), id]);
      }
    }
    const slots: Availability['slots'] = [...porHora.entries()]
      .sort(([a], [b]) => a - b)
      .map(([m, ids]) => ({ hora: hhmm(m), profesionalIds: ids }));
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

  const retenerHorario = async (slug: string, input: RetenerInput): Promise<Retencion> => {
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
    // Re-chequeo al retener (el real lo hace con lock): si el inicio ya no entra
    // por solape con un turno o una retencion/reserva pendiente, la lista quedo vieja.
    const slot = disp.slots.find((x) => x.hora === input.hora);
    if (!slot) throw new ReservaOnlineError('slot_taken');
    const profesionalId = input.profesionalId ?? slot.profesionalIds[0];

    const p = cargar();
    const id = `mock-${p.seq + 1}`;
    const createdAtMs = now();
    const expiresAtMs = createdAtMs + HOLD_MINUTOS * MIN_MS;
    p.seq += 1;
    p.reservas.push({
      id,
      slug,
      servicioIds: input.servicioIds,
      profesionalId,
      fecha: input.fecha,
      hora: input.hora,
      clienteNombre: '',
      duracionTotalMinutos: disp.duracionTotalMinutos,
      deposito: p.settings.deposito,
      createdAtMs,
      expiresAtMs,
      status: 'held',
      pagadaAtMs: null,
    });
    guardar(p);
    return { reservaId: id, expiresAtMs, profesionalId };
  };

  const actualizarDatosReserva = async (slug: string, id: string, datos: DatosReserva): Promise<void> => {
    const p = cargar();
    const r = buscar(p, slug, id);
    const e = estadoEfectivo(r);
    if (e === 'expired') throw new ReservaOnlineError('hold_expired');
    if (e !== 'held') throw new ReservaOnlineError('validation', 'la reserva ya no esta retenida');
    r.clienteNombre = `${datos.cliente.nombre} ${datos.cliente.apellido}`.trim();
    r.nota = datos.nota?.trim() || undefined;
    guardar(p);
  };

  const iniciarPago = async (slug: string, id: string): Promise<ReservationCreated> => {
    const p = cargar();
    const r = buscar(p, slug, id);
    const e = estadoEfectivo(r);
    if (e === 'expired') throw new ReservaOnlineError('hold_expired');
    if (e === 'held') {
      // La retencion pasa a la ventana de pago completa, contada desde ahora.
      r.status = 'pending_payment';
      r.expiresAtMs = now() + p.settings.ventanaPagoMinutos * MIN_MS;
      guardar(p);
    } else if (e !== 'pending_payment') {
      throw new ReservaOnlineError('validation', 'la reserva no se puede pagar');
    }
    return {
      id,
      status: 'pending_payment',
      expiresAtMs: r.expiresAtMs,
      checkoutUrl: `/reservar/${slug}/reserva/${id}?mock=1`,
    };
  };

  const liberarHold = async (slug: string, id: string): Promise<void> => {
    const p = cargar();
    const r = p.reservas.find((x) => x.id === id && x.slug === slug);
    if (r && r.status === 'held') {
      r.status = 'cancelled';
      guardar(p);
    }
  };

  const buscar = (p: Persistido, slug: string, id: string): ReservaGuardada => {
    const r = p.reservas.find((x) => x.id === id && x.slug === slug);
    if (!r) throw new ReservaOnlineError('not_found', `reserva ${id}`);
    return r;
  };

  const getReservationStatus = async (slug: string, id: string): Promise<ReservationStatus> => {
    const r = buscar(cargar(), slug, id);
    const status = estadoEfectivo(r);
    // Un hold todavia no es una reserva: la pagina de estado solo existe desde iniciarPago.
    if (status === 'held') throw new ReservaOnlineError('not_found', `reserva ${id}`);
    return {
      id: r.id,
      status,
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
    retenerHorario,
    actualizarDatosReserva,
    iniciarPago,
    liberarHold,
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

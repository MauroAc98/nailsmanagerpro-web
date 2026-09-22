import type {
  Availability,
  AvailabilityQuery,
  Fecha,
  BookableService,
  DatosReserva,
  MpConnection,
  OnlineBooking,
  ReservaOnlineSettings,
  ReservationCreated,
  ReservationStatus,
  ReservationTerms,
  Retencion,
  RetenerInput,
  SalonInfo,
  ServicesQuery,
  DiasQuery,
} from './types';

// Lecturas publicas: las unicas con backend real en el slice 1 (decision D5).
export interface ReservaOnlineReads {
  getSalon(slug: string): Promise<SalonInfo>;
  getServices(slug: string, query?: ServicesQuery): Promise<BookableService[]>;
  getAvailability(slug: string, query: AvailabilityQuery): Promise<Availability>;
  // Fechas con horarios libres; `null` = no se pudo saber (el real ante un error
  // de red/servidor) y la UI no dibuja puntos y cae a buscar dia por dia.
  getDiasConDisponibilidad(slug: string, query: DiasQuery): Promise<Fecha[] | null>;
  // GET /api/public/{slug}/terminos — antes vivia en ReservaOnlineWrites y
  // quedaba SIEMPRE en el mock (componerServicio nunca lo reasignaba): un
  // negocio real veia el deposito/ventanas mockeados (ej. $5000) en vez del
  // suyo propio, aunque el backend ya tuviera el endpoint real. Es una
  // lectura publica sin efectos secundarios, por eso va aca.
  getTerms(slug: string): Promise<ReservationTerms>;
}

// Escrituras y lado del salon: mock hasta los slices siguientes. Cada slice
// mueve metodos de aca al adapter real, sin tocar la UI.
//
// Las fotos de trabajos de un servicio (FotosServicioEditor) NO viven aca:
// aunque el mock las tuvo guardadas en localStorage durante la etapa mock,
// los endpoints reales (POST/DELETE/PATCH /api/servicios/{id}/fotos) son
// autenticados (Bearer token del dueño del salon), no parte del API
// publico anonimo que consume este servicio (crearPublicHttp +
// X-Device-Token). Viven en services/servicioService.ts junto al resto del
// CRUD autenticado de servicios (mismo patron que
// profesionalService.subirFotoHistoriaPrecios).
export interface ReservaOnlineWrites {
  // Flujo de escritura: el horario se RETIENE al elegirlo (antes de pedir datos)
  // para que la clienta no descubra al pagar que se lo ocuparon. slot_taken se
  // levanta en retenerHorario; hold_expired si el hold ya vencio.
  retenerHorario(slug: string, input: RetenerInput): Promise<Retencion>;
  actualizarDatosReserva(slug: string, reservaId: string, datos: DatosReserva): Promise<void>;
  // Extiende la retencion a la ventana de pago completa y devuelve los datos
  // de redireccion al pago (el mock va a la pagina de estado).
  iniciarPago(slug: string, reservaId: string): Promise<ReservationCreated>;
  liberarHold(slug: string, reservaId: string): Promise<void>;
  getReservationStatus(slug: string, id: string): Promise<ReservationStatus>;
  cancelReservation(slug: string, id: string): Promise<void>;
  getSettings(): Promise<ReservaOnlineSettings>;
  saveSettings(patch: Partial<ReservaOnlineSettings>): Promise<ReservaOnlineSettings>;
  getMpConnection(): Promise<MpConnection>;
  connectMp(): Promise<MpConnection>;
  disconnectMp(): Promise<MpConnection>;
  listOnlineBookings(): Promise<OnlineBooking[]>;
}

export interface ReservaOnlineService extends ReservaOnlineReads, ReservaOnlineWrites {}

// Error tipado para respuestas de negocio (404 salon, 422 validacion, slot tomado,
// retencion vencida). Los ultimos 5 codigos son de las escrituras reales
// (slice 3, decision A4/A5/A7 del diseno): limite de intentos, telefono en
// enfriamiento, verificacion pendiente, reto anti-bot fallido y kill switch apagado.
export type ReservaOnlineErrorCode =
  | 'not_found'
  | 'validation'
  | 'slot_taken'
  | 'hold_expired'
  | 'rate_limited'
  | 'phone_cooldown'
  | 'challenge_failed'
  | 'verification_required'
  | 'creation_disabled'
  | 'mp_no_conectado'
  | 'unknown';

export class ReservaOnlineError extends Error {
  readonly code: ReservaOnlineErrorCode;
  // Segundos a esperar antes de reintentar (solo rate_limited y phone_cooldown).
  readonly retryAfterSeconds?: number;
  constructor(code: ReservaOnlineErrorCode, message?: string, retryAfterSeconds?: number) {
    super(message ?? code);
    this.name = 'ReservaOnlineError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

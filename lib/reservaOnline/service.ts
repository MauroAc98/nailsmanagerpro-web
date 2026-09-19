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
}

// Escrituras y lado del salon: mock hasta los slices siguientes. Cada slice
// mueve metodos de aca al adapter real, sin tocar la UI.
export interface ReservaOnlineWrites {
  getTerms(slug: string): Promise<ReservationTerms>;
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
  // Fotos de trabajos por servicio (lado del salon). Mock hasta que el backend
  // tenga almacenamiento; el orden es el de la lista y la primera es la portada.
  getFotosServicio(servicioId: number): Promise<string[]>;
  saveFotosServicio(servicioId: number, fotos: string[]): Promise<string[]>;
}

export const MAX_FOTOS_SERVICIO = 12;

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

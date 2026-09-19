import type {
  Availability,
  AvailabilityQuery,
  Fecha,
  BookableService,
  CreateReservationInput,
  MpConnection,
  OnlineBooking,
  ReservaOnlineSettings,
  ReservationCreated,
  ReservationStatus,
  ReservationTerms,
  SalonInfo,
  ServicesQuery,
  DiasQuery,
} from './types';

// Lecturas publicas: las unicas con backend real en el slice 1 (decision D5).
export interface ReservaOnlineReads {
  getSalon(slug: string): Promise<SalonInfo>;
  getServices(slug: string, query?: ServicesQuery): Promise<BookableService[]>;
  getAvailability(slug: string, query: AvailabilityQuery): Promise<Availability>;
  // Fechas con horarios libres; `null` = este origen no lo sabe (el real no
  // tiene endpoint) y la UI no dibuja puntos de disponibilidad.
  getDiasConDisponibilidad(slug: string, query: DiasQuery): Promise<Fecha[] | null>;
}

// Escrituras y lado del salon: mock hasta los slices siguientes. Cada slice
// mueve metodos de aca al adapter real, sin tocar la UI.
export interface ReservaOnlineWrites {
  getTerms(slug: string): Promise<ReservationTerms>;
  createReservation(slug: string, input: CreateReservationInput): Promise<ReservationCreated>;
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

// Error tipado para respuestas de negocio (404 salon, 422 validacion, slot tomado).
export type ReservaOnlineErrorCode = 'not_found' | 'validation' | 'slot_taken' | 'unknown';

export class ReservaOnlineError extends Error {
  readonly code: ReservaOnlineErrorCode;
  constructor(code: ReservaOnlineErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ReservaOnlineError';
    this.code = code;
  }
}

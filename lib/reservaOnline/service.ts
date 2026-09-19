import type {
  Availability,
  AvailabilityQuery,
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
} from './types';

// Lecturas publicas: las unicas con backend real en el slice 1 (decision D5).
export interface ReservaOnlineReads {
  getSalon(slug: string): Promise<SalonInfo>;
  getServices(slug: string, query?: ServicesQuery): Promise<BookableService[]>;
  getAvailability(slug: string, query: AvailabilityQuery): Promise<Availability>;
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
}

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

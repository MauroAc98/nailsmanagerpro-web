// DTOs de la reserva online (decisiones D5/D7/D8). Espejan el contrato de
// /api/public/{slug} en camelCase; el mapeo snake_case -> camelCase vive en un
// unico mapper del adapter real.
//
// Fechas y horas son strings de pared del salon (fecha 'YYYY-MM-DD', hora
// 'HH:MM'); los instantes (vencimientos, creacion) son epoch en milisegundos.
// Nunca se construye un Date a partir de fecha/hora para logica.

export type Fecha = string; // 'YYYY-MM-DD'
export type Hora = string; // 'HH:MM'

// Precios en pesos tal como los devuelve `servicios.precio` (formatear con lib/money.ts).
export interface ProfesionalPublico {
  id: number;
  nombre: string;
}

export interface SalonInfo {
  nombre: string;
  logoUrl: string | null;
  direccion: string | null;
  profesionales: ProfesionalPublico[];
}

export interface BookableService {
  id: number;
  nombre: string;
  duracionMinutos: number;
  precio: number;
}

export interface AvailabilitySlot {
  hora: Hora;
  // Profesionales que pueden tomar ese horario (solo libres).
  profesionalIds: number[];
}

export interface Availability {
  fecha: Fecha;
  duracionTotalMinutos: number;
  slots: AvailabilitySlot[];
}

export interface AvailabilityQuery {
  fecha: Fecha;
  servicioIds: number[];
  profesionalId?: number;
}

export interface ServicesQuery {
  profesionalId?: number;
}

// Condiciones de la reserva (mock hasta que exista el backend de settings).
export interface ReservationTerms {
  deposito: number;
  ventanaPagoMinutos: number;
  anticipacionMinutos: number;
  ventanaCancelacionHoras: number;
}

export interface ClienteInput {
  nombre: string;
  apellido: string;
  whatsapp: string; // E.164, ej. +5491155551234
}

export interface CreateReservationInput {
  servicioIds: number[];
  profesionalId: number;
  fecha: Fecha;
  hora: Hora;
  cliente: ClienteInput;
}

export type ReservationStatusValue = 'pending_payment' | 'confirmed' | 'expired' | 'cancelled';

export interface ReservationCreated {
  id: string;
  status: 'pending_payment';
  expiresAtMs: number;
  checkoutUrl: string;
}

export interface ReservationSummary {
  servicioIds: number[];
  profesionalId: number;
  fecha: Fecha;
  hora: Hora;
  total: number;
  deposito: number;
  duracionTotalMinutos: number;
}

export interface ReservationStatus {
  id: string;
  status: ReservationStatusValue;
  expiresAtMs: number;
  summary: ReservationSummary;
}

// Lado del salon (ajustes + Agenda), todo mock en el slice 1.
export interface ReservaOnlineSettings {
  habilitada: boolean;
  deposito: number;
  ventanaPagoMinutos: number;
  anticipacionMinutos: number;
  ventanaCancelacionHoras: number;
}

export interface MpConnection {
  conectada: boolean;
  cuenta: string | null;
}

export interface OnlineBooking {
  id: string;
  clienteNombre: string;
  fecha: Fecha;
  hora: Hora;
  pagadaAtMs: number;
}

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
  // Avatar circular de esta profesional — null si todavia no subio uno
  // (EntryScreen/HorarioScreen caen a la inicial via el componente Avatar).
  avatarUrl: string | null;
}

export interface SalonInfo {
  nombre: string;
  logoUrl: string | null;
  direccion: string | null;
  profesionales: ProfesionalPublico[];
  // Fase 1 de Mercado Pago: el negocio tiene seña configurada Y su cuenta de
  // MP conectada. En falso, todo el flujo de reserva online se bloquea desde
  // la entrada — no tiene sentido dejar completar el formulario para
  // terminar con un error generico al momento de pagar.
  pagoHabilitado: boolean;
}

export interface ServicioCategoria {
  id: number;
  nombre: string;
}

// Un servicio de una promo con su profesional fija (solo nombres: el cliente
// publico no necesita ids). `orden` = posicion dentro de la promo.
export interface ComponentePromo {
  servicioNombre: string;
  profesionalNombre: string;
  orden: number;
}

export interface BookableService {
  id: number;
  nombre: string;
  // Categoria del servicio en el salon (null/ausente = sin categoria).
  categoria?: ServicioCategoria | null;
  duracionMinutos: number;
  // Precio de REFERENCIA ("Desde $X"): el valor final depende del diseno y lo
  // confirma el salon. Nunca se suma ni se muestra como total.
  precio: number;
  // Fotos de trabajos del portafolio de este servicio — urls absolutas,
  // ordenadas (la primera es la portada). El adapter real las mapea
  // directamente desde GET /api/public/{slug}/servicios.
  fotos: string[];
  // Promo con componentes: cada servicio ya trae su profesional fija. Se reserva
  // sola (no se combina con otros servicios) y la clienta no elige profesional.
  promoComponentizada?: boolean;
  // Solo en promos componentizadas: como se encadenan los componentes (null =
  // el backend no guardo modo: rige la secuencia) y el detalle en orden.
  modoPromo?: ModoPlan | null;
  componentes?: ComponentePromo[];
}

// Un grupo de servicios con su profesional (sin profesional = "Cualquiera").
export interface Asignacion {
  servicioIds: number[];
  profesionalId?: number;
}

// Como se encadenan los tramos de un horario de varias profesionales: el
// backend lo devuelve con el horario y hay que mandarlo de vuelta al retener.
// Interno: nunca se muestra.
export type ModoPlan = 'paralelo' | 'secuencia';

export interface TramoPlan {
  profesionalId: number;
  offsetMinutos: number;
  duracionMinutos: number;
  servicioIds: number[];
}

export interface AvailabilitySlot {
  hora: Hora;
  // Profesionales que pueden tomar ese horario (solo libres).
  profesionalIds: number[];
  // Solo en horarios de varias profesionales o promo: cuando termina el turno.
  fin?: Hora;
  modo?: ModoPlan;
  tramos?: TramoPlan[];
}

export interface Availability {
  fecha: Fecha;
  // Ausente cuando cada horario trae su propio `fin` (varias profesionales).
  duracionTotalMinutos?: number;
  slots: AvailabilitySlot[];
}

export interface AvailabilityQuery {
  fecha: Fecha;
  servicioIds: number[];
  profesionalId?: number;
  // Varios grupos (una profesional por servicio): si viene, manda sobre
  // servicioIds/profesionalId, que describen el unico grupo de siempre.
  asignaciones?: Asignacion[];
}

// Dias (fechas) entre `fechas` en los que hay al menos un horario libre.
export interface DiasQuery {
  fechas: Fecha[];
  servicioIds: number[];
  profesionalId?: number;
  asignaciones?: Asignacion[];
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

// Paso "Continuar" del horario: retiene (hold) el horario elegido.
export interface RetenerInput {
  servicioIds: number[];
  // Omitido cuando la clienta elige "Cualquiera": el backend asigna la primera
  // profesional libre en ese momento (la lista de horarios puede estar vieja).
  profesionalId?: number;
  asignaciones?: Asignacion[];
  // El `modo` del horario elegido, si el horario lo traia (varias profesionales).
  modo?: ModoPlan;
  fecha: Fecha;
  hora: Hora;
}

export interface TramoRetenido {
  profesionalId: number;
  hora: Hora;
  fin: Hora;
  servicioIds: number[];
}

export interface Retencion {
  reservaId: string;
  expiresAtMs: number;
  // Profesional resuelta al retener (la elegida o, con "Cualquiera", la primera libre).
  profesionalId: number;
  // Solo si el hold es de varias profesionales.
  fin?: Hora;
  tramos?: TramoRetenido[];
}

// Retencion vigente del flujo (se persiste por slug junto con lo elegido).
export interface HoldFlujo {
  reservaId: string;
  expiraMs: number;
  profesionalId: number;
  // Solo si el hold es de varias profesionales: cuando termina y quienes atienden.
  fin?: Hora;
  profesionalIds?: number[];
}

// Datos que se guardan sobre el hold al salir del paso "Tus datos".
export interface DatosReserva {
  cliente: ClienteInput;
  // "Contanos tu idea": texto libre opcional (max ~300 caracteres).
  nota?: string;
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
  // Unico monto firme del flujo: la sena. No hay total (los precios son "desde").
  deposito: number;
  duracionTotalMinutos: number;
  nota?: string;
  // Solo en reservas de varias profesionales.
  fin?: Hora;
  tramos?: TramoRetenido[];
  profesionales?: { id: number; nombre: string }[];
}

export interface ReservationStatus {
  id: string;
  status: ReservationStatusValue;
  expiresAtMs: number;
  // Para "Volver a Mercado Pago" mientras la reserva sigue pendiente.
  checkoutUrl?: string;
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
  nota?: string;
}

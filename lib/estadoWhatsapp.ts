// Estado visual del ultimo WhatsApp automatico de un turno. Funciones puras.

export type EstadoWhatsapp = 'enviado' | 'entregado' | 'leido' | 'fallo';

// Estado crudo que manda el backend (WhatsappMensaje.status). 'manual' es un
// recordatorio que la persona marco como enviado a mano.
export type StatusWhatsapp = 'pending' | 'delivered' | 'read' | 'failed' | 'manual';

const POR_STATUS: Record<StatusWhatsapp, EstadoWhatsapp> = {
  pending: 'enviado',
  delivered: 'entregado',
  read: 'leido',
  failed: 'fallo',
  manual: 'enviado',
};

/** Estado visual de un status del backend; null si no hay mensaje o el status no se conoce. */
export function estadoWhatsapp(status: string | null | undefined): EstadoWhatsapp | null {
  if (!status || !Object.prototype.hasOwnProperty.call(POR_STATUS, status)) return null;
  return POR_STATUS[status as StatusWhatsapp];
}

/**
 * Status que representa a una visita (varios turnos): si alguno fallo, ese;
 * si no, el del primer turno que tenga uno conocido. null si ninguno tiene.
 */
export function statusWhatsappDeVisita(statuses: readonly (string | null | undefined)[]): string | null {
  if (statuses.some((s) => s === 'failed')) return 'failed';
  return statuses.find((s) => estadoWhatsapp(s) !== null) ?? null;
}

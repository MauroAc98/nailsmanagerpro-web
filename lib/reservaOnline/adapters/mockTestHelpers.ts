import type { ReservaOnlineService } from '../service';
import type { ClienteInput, DatosReserva, ReservationCreated, RetenerInput } from '../types';

// Helper SOLO de tests: recorre el flujo completo de escrituras (retener el
// horario -> completar datos -> iniciar pago) y devuelve la reserva pendiente
// de pago. Reemplaza al viejo "crear reserva en un solo paso".
export type ReservaCompleta = RetenerInput & { cliente: ClienteInput; nota?: DatosReserva['nota'] };

export async function crearPendiente(
  svc: ReservaOnlineService,
  slug: string,
  input: ReservaCompleta,
): Promise<ReservationCreated> {
  const { cliente, nota, ...retener } = input;
  const retencion = await svc.retenerHorario(slug, retener);
  await svc.actualizarDatosReserva(slug, retencion.reservaId, { cliente, nota });
  return svc.iniciarPago(slug, retencion.reservaId);
}

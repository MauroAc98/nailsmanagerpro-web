import { reservaOnlineHabilitada } from './flag';

// Criterio ÚNICO de "la reserva online está activa para este negocio". Hoy es el
// flag global de build (`NEXT_PUBLIC_RESERVA_ONLINE`): el interruptor por
// negocio de Configuración > Reservas online todavía vive en el mock (guarda en
// localStorage del navegador, ver adapters/mock.ts), así que no es una fuente
// confiable. Cuando el backend exponga el estado real por negocio, este es el
// ÚNICO lugar a cambiar.
export function reservaOnlineActivaParaNegocio(): boolean {
  return reservaOnlineHabilitada();
}

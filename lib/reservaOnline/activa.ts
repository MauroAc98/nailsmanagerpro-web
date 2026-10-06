import type { User } from '@/services/authService';
import { reservaOnlineHabilitada } from './flag';

// Criterio ÚNICO de "la reserva online está activa para este negocio": el flag
// global de build (`NEXT_PUBLIC_RESERVA_ONLINE`, kill switch) Y el add-on del
// negocio que el backend calcula en vivo (`reserva_online_activa` = contratado
// por el admin + suscripción vigente). El interruptor por negocio de
// Configuración > Reservas online sigue en el mock (localStorage) y NO cuenta.
export function reservaOnlineActivaParaNegocio(user?: Pick<User, 'reserva_online_activa'> | null): boolean {
  return reservaOnlineHabilitada() && user?.reserva_online_activa === true;
}

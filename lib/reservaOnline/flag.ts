// Feature flag de la reserva online (decision D4). Se inlinea en build time
// (NEXT_PUBLIC_*), asi que hay que leer `process.env.NEXT_PUBLIC_RESERVA_ONLINE`
// literal: un acceso dinamico (process.env[nombre]) no se reemplaza en el
// bundle del cliente. Apagado por defecto; en prod queda off hasta que el
// servicio no tenga metodos mock (ver index.ts).
export function reservaOnlineHabilitada(): boolean {
  return process.env.NEXT_PUBLIC_RESERVA_ONLINE === 'true';
}

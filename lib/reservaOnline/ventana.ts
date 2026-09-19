import { hoyDelSalon } from './formatoFecha';
import { diasDesde, sumarDias } from './diasDesde';
import type { Fecha } from './types';

// Ventana en la que la clienta puede reservar: desde el dia en que cae "ahora +
// anticipacion" hasta DIAS_VENTANA dias despues de hoy. Todo con fechas
// 'YYYY-MM-DD' de pared del salon (sin Date local, decision D7).
export const DIAS_VENTANA = 30;

export const primerDiaReservable = (ahoraMs: number, anticipacionMinutos: number): Fecha =>
  hoyDelSalon(ahoraMs + anticipacionMinutos * 60_000);

export const ultimoDiaReservable = (hoy: Fecha): Fecha => sumarDias(hoy, DIAS_VENTANA);

// Dias de primero a ultimo, ambos inclusive.
export function diasReservables(primero: Fecha, ultimo: Fecha): Fecha[] {
  const n = Math.round((Date.parse(ultimo) - Date.parse(primero)) / 86_400_000) + 1;
  return n > 0 ? diasDesde(primero, n) : [];
}

// Semana lunes-domingo (como la tira de la agenda propia) que contiene `fecha`.
export function semanaDeFecha(fecha: Fecha): Fecha[] {
  const [y, m, d] = fecha.split('-').map(Number);
  const desdeLunes = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return diasDesde(sumarDias(fecha, -desdeLunes), 7);
}

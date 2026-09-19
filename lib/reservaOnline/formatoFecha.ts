import { paredDelSalon } from './adapters/mock';
import type { Fecha } from './types';

// Formateo SOLO de display de fechas 'YYYY-MM-DD' (decision D7): se construye
// un Date en UTC puro y se formatea con timeZone UTC, asi la zona del
// navegador nunca corre el dia. Nada de esto se usa para logica.

// 'es' a secas -> es-AR (mismo criterio que lib/money.ts).
const localeIntl = (locale: string): string => (locale === 'es' ? 'es-AR' : locale);

function aDate(fecha: Fecha): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const fmt = (fecha: Fecha, locale: string, opts: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat(localeIntl(locale), { ...opts, timeZone: 'UTC' }).format(aDate(fecha));

const capitalizar = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// "Martes 22 de septiembre"
export function fechaLarga(fecha: Fecha, locale: string): string {
  const dia = fmt(fecha, locale, { weekday: 'long' });
  const dm = fmt(fecha, locale, { day: 'numeric', month: 'long' });
  return capitalizar(`${dia} ${dm.replace(/^(\d+)\s+(?:de\s+)?/, '$1 de ')}`);
}

// "Lun"
export function diaCorto(fecha: Fecha, locale: string): string {
  return capitalizar(fmt(fecha, locale, { weekday: 'short' }).replace('.', ''));
}

export const diaDelMes = (fecha: Fecha): string => String(Number(fecha.slice(8, 10)));

// "Septiembre 2026"
export function mesAnio(fecha: Fecha, locale: string): string {
  return capitalizar(fmt(fecha, locale, { month: 'long', year: 'numeric' }).replace(' de ', ' '));
}

// "martes 22"
export function diaLargoCorto(fecha: Fecha, locale: string): string {
  return `${fmt(fecha, locale, { weekday: 'long' })} ${diaDelMes(fecha)}`;
}

// Hoy en hora de pared del salon (UTC-3), a partir de un instante epoch-ms.
export const hoyDelSalon = (ms: number): Fecha => paredDelSalon(ms).fecha;

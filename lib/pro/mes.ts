// Aritmética de meses "YYYY-MM" del calendario. Todo es texto: nunca se parsea
// un turno con Date. Date.UTC se usa solo con partes numéricas, para saber qué
// día de la semana cae el 1 y para formatear nombres (no depende de la zona
// horaria del dispositivo).
import { esFechaValida, FECHA_MINIMA } from '@/lib/pro/fechaHora';

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MES_MINIMO = FECHA_MINIMA.slice(0, 7);

export function mesValido(mes: string): boolean {
  return typeof mes === 'string' && MES.test(mes) && mes >= MES_MINIMO;
}

export function mesDe(fecha: string): string | null {
  return esFechaValida(fecha) ? fecha.slice(0, 7) : null;
}

function aMes(anio: number, mes: number): string {
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
}

function partes(mes: string): [number, number] | null {
  if (!mesValido(mes)) return null;
  return [Number(mes.slice(0, 4)), Number(mes.slice(5, 7))];
}

// Null si la entrada es inválida o si el resultado quedaría antes de 2000-01
// (el backend no acepta fechas anteriores).
export function mesAnterior(mes: string): string | null {
  const p = partes(mes);
  if (p === null) return null;
  const [anio, m] = p;
  const resultado = m === 1 ? aMes(anio - 1, 12) : aMes(anio, m - 1);
  return mesValido(resultado) ? resultado : null;
}

export function mesSiguiente(mes: string): string | null {
  const p = partes(mes);
  if (p === null) return null;
  const [anio, m] = p;
  return m === 12 ? aMes(anio + 1, 1) : aMes(anio, m + 1);
}

export function primerDia(mes: string): string | null {
  return mesValido(mes) ? `${mes}-01` : null;
}

export function ultimoDia(mes: string): string | null {
  const p = partes(mes);
  if (p === null) return null;
  const [anio, m] = p;
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  const dias = m === 2 ? (bisiesto ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;
  return `${mes}-${String(dias).padStart(2, '0')}`;
}

// "octubre de 2026". Se formatea en UTC sobre una fecha armada con partes
// numéricas, así la zona horaria del dispositivo no puede correr el mes.
export function etiquetaDeMes(mes: string, locale: string): string {
  const p = partes(mes);
  if (p === null) return '';
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(p[0], p[1] - 1, 1)),
  );
}

// "14 de octubre": se formatea en UTC con partes numéricas, la zona del
// dispositivo no puede correr el día. Fecha inválida = texto vacío.
export function etiquetaDeDia(fecha: string, locale: string): string {
  if (!esFechaValida(fecha)) return '';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)))),
  );
}

// "mié, 14 oct": día de la semana y mes abreviados, también en UTC. Fecha inválida
// = texto vacío.
export function etiquetaCortaDeDia(fecha: string, locale: string): string {
  if (!esFechaValida(fecha)) return '';
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)))),
  );
}

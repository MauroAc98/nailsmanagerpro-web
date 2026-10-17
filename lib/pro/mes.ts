// Aritmética de meses "YYYY-MM" de la vista mensual. Todo es texto: nunca se
// parsea un turno con Date. Date.UTC aparece UNA vez, con partes numéricas, solo
// para saber qué día de la semana cae el 1 (no depende de la zona horaria).
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

// Huecos antes del día 1 con la semana empezando el lunes (0 = el 1 es lunes).
export function desfaseLunes(mes: string): number | null {
  const p = partes(mes);
  if (p === null) return null;
  return (new Date(Date.UTC(p[0], p[1] - 1, 1)).getUTCDay() + 6) % 7;
}

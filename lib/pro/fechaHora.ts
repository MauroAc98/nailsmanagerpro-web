// Helpers PUROS sobre la hora de pared del portal de profesionales.
//
// `fecha_hora` llega como "2026-10-17T09:30:00": es la hora de pared del
// negocio SIN sufijo de zona. Pasarla por `new Date(...)`/`Date.parse` la
// interpreta como hora LOCAL del dispositivo y, al formatearla o compararla en
// UTC, corre el día o la hora según el huso. Por eso acá todo es aritmética de
// strings y números; nada de este módulo toca `Date`.

export interface FechaHoraPartida {
  fecha: string; // "YYYY-MM-DD"
  hora: string; // "HH:mm"
}

// Un solo regex para `fecha_hora` (con o sin segundos). El backend manda
// `Y-m-d\TH:i:s`; los segundos opcionales toleran un formato más corto.
const FECHA_HORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^(\d{2}):(\d{2})$/;

const MINUTOS_POR_DIA = 24 * 60;

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

function diasDelMes(anio: number, mes: number): number {
  if (mes === 2) return esBisiesto(anio) ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

function esDiaDeCalendario(anio: number, mes: number, dia: number): boolean {
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasDelMes(anio, mes);
}

export function esFechaValida(fecha: string): boolean {
  const m = typeof fecha === 'string' ? FECHA.exec(fecha) : null;
  return m !== null && esDiaDeCalendario(Number(m[1]), Number(m[2]), Number(m[3]));
}

interface Partes {
  fecha: string;
  hora: string;
  segundos: string;
}

function partes(fechaHora: string): Partes | null {
  const m = typeof fechaHora === 'string' ? FECHA_HORA.exec(fechaHora) : null;
  if (m === null) return null;
  const [, anio, mes, dia, hh, mm, ss = '00'] = m;
  if (!esDiaDeCalendario(Number(anio), Number(mes), Number(dia))) return null;
  if (Number(hh) > 23 || Number(mm) > 59 || Number(ss) > 59) return null;
  return { fecha: `${anio}-${mes}-${dia}`, hora: `${hh}:${mm}`, segundos: ss };
}

export function partirFechaHora(fechaHora: string): FechaHoraPartida | null {
  const p = partes(fechaHora);
  return p === null ? null : { fecha: p.fecha, hora: p.hora };
}

export function diaDe(fechaHora: string): string | null {
  return partes(fechaHora)?.fecha ?? null;
}

export function horaDe(fechaHora: string): string | null {
  return partes(fechaHora)?.hora ?? null;
}

// Comparador para Array.prototype.sort (estable): orden cronológico por la
// clave normalizada (así "09:30" y "09:30:00" empatan). Un valor inválido va al
// final en vez de romper el orden de los demás.
export function compararFechaHora(a: string, b: string): number {
  const pa = partes(a);
  const pb = partes(b);
  if (pa === null || pb === null) return Number(pa === null) - Number(pb === null);
  const ka = `${pa.fecha}T${pa.hora}:${pa.segundos}`;
  const kb = `${pb.fecha}T${pb.hora}:${pb.segundos}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

// Hora de fin sobre la hora de pared. `diaSiguiente` es true si la suma llega
// a las 24:00 o más (terminar a las 24:00 en punto se muestra 00:00 del día
// siguiente). null si la hora o la duración no son válidas.
export function horaFin(hora: string, minutos: number): { hora: string; diaSiguiente: boolean } | null {
  const m = typeof hora === 'string' ? HORA.exec(hora) : null;
  if (m === null || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  if (!Number.isInteger(minutos) || minutos < 0) return null;

  const total = Number(m[1]) * 60 + Number(m[2]) + minutos;
  const dentroDelDia = total % MINUTOS_POR_DIA;
  const hh = String(Math.floor(dentroDelDia / 60)).padStart(2, '0');
  const mm = String(dentroDelDia % 60).padStart(2, '0');
  return { hora: `${hh}:${mm}`, diaSiguiente: total >= MINUTOS_POR_DIA };
}

// Número de día del calendario gregoriano proléptico (algoritmo "days from
// civil"): solo enteros, sin Date, así no hay corrimiento por huso ni por DST.
function numeroDeDia(anio: number, mes: number, dia: number): number {
  const a = mes <= 2 ? anio - 1 : anio;
  const era = Math.floor(a / 400);
  const anioDeEra = a - era * 400;
  const diaDelAnio = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDeEra = anioDeEra * 365 + Math.floor(anioDeEra / 4) - Math.floor(anioDeEra / 100) + diaDelAnio;
  return era * 146097 + diaDeEra;
}

// Días entre dos "YYYY-MM-DD" (hasta - desde; negativo si hasta es anterior).
// null si alguna no es una fecha de calendario válida.
export function diasEntre(desde: string, hasta: string): number | null {
  if (!esFechaValida(desde) || !esFechaValida(hasta)) return null;
  const [d, h] = [desde, hasta].map((f) => f.split('-').map(Number));
  return numeroDeDia(h[0], h[1], h[2]) - numeroDeDia(d[0], d[1], d[2]);
}

// Reglas de ListarTurnosProfesionalRequest (backend): los extremos del rango
// no pueden ser anteriores a 2000-01-01 (es texto "YYYY-MM-DD": se compara
// como string), hasta >= desde y el rango no supera 366 días CONTANDO ambos
// extremos, es decir diasEntre(desde, hasta) <= 365.
export const FECHA_MINIMA = '2000-01-01';
export const MAX_DIAS_RANGO = 366;

export function rangoPermitido(desde: string, hasta: string): boolean {
  const dias = diasEntre(desde, hasta);
  if (dias === null) return false;
  return desde >= FECHA_MINIMA && dias >= 0 && dias <= MAX_DIAS_RANGO - 1;
}

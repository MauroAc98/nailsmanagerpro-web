import type { BucketOcupacion } from '@/services/statsService';

export interface DiaRitmo {
  dia_semana: number; // ISO: 1 = lunes ... 7 = domingo
  completados: number;
  confirmados: number;
  cancelados: number;
}

export type Franja = 'manana' | 'tarde';

// Con menos turnos que esto cualquier "consejo" es ruido estadístico.
const MIN_TURNOS = 10;
const MIN_OCUPACION = 20;
const MIN_CLIENTAS = 5;
const FRANJA_TARDE_DESDE = 13;

function turnosDelDia(d: DiaRitmo): number {
  return d.completados + d.confirmados;
}

function resumenSemana(ritmo: DiaRitmo[]) {
  const totales = ritmo.map(turnosDelDia);
  const total = totales.reduce((a, b) => a + b, 0);
  return { totales, total, max: Math.max(...totales), min: Math.min(...totales) };
}

export function diaPico(ritmo: DiaRitmo[]): { dia_semana: number; pct: number } | null {
  if (ritmo.length === 0) return null;
  const { totales, total, max, min } = resumenSemana(ritmo);
  if (total < MIN_TURNOS || max === min) return null;
  return { dia_semana: ritmo[totales.indexOf(max)].dia_semana, pct: Math.round((max / total) * 100) };
}

export function diaFlojo(ritmo: DiaRitmo[]): { dia_semana: number; pct: number } | null {
  if (ritmo.length === 0) return null;
  const { totales, total, max, min } = resumenSemana(ritmo);
  if (total < MIN_TURNOS || max === min) return null;
  return { dia_semana: ritmo[totales.indexOf(min)].dia_semana, pct: Math.round((min / total) * 100) };
}

// Busca el hueco más claro de la agenda: el día + franja (mañana/tarde) con
// menos turnos, solo entre las franjas que aparecen en los datos (si todo el
// movimiento es a la tarde, "la mañana" no es un hueco: no se atiende).
export function franjaLibre(
  ocupacion: BucketOcupacion[],
): { dia_semana: number; franja: Franja } | null {
  const total = ocupacion.reduce((a, b) => a + b.cantidad, 0);
  if (total < MIN_OCUPACION) return null;

  const franjas: Franja[] = [];
  if (ocupacion.some(b => b.hora < FRANJA_TARDE_DESDE)) franjas.push('manana');
  if (ocupacion.some(b => b.hora >= FRANJA_TARDE_DESDE)) franjas.push('tarde');

  const celdas: { dia_semana: number; franja: Franja; cantidad: number }[] = [];
  for (let dia = 1; dia <= 7; dia++) {
    for (const franja of franjas) {
      const cantidad = ocupacion
        .filter(b => b.dia_semana === dia && (franja === 'manana' ? b.hora < FRANJA_TARDE_DESDE : b.hora >= FRANJA_TARDE_DESDE))
        .reduce((a, b) => a + b.cantidad, 0);
      celdas.push({ dia_semana: dia, franja, cantidad });
    }
  }

  const promedio = celdas.reduce((a, c) => a + c.cantidad, 0) / celdas.length;
  const masVacia = celdas.reduce((best, c) => (c.cantidad < best.cantidad ? c : best), celdas[0]);
  if (masVacia.cantidad > promedio * 0.5) return null;
  return { dia_semana: masVacia.dia_semana, franja: masVacia.franja };
}

export function retencion(nuevas: number, recurrentes: number): { pct: number } | null {
  const total = nuevas + recurrentes;
  if (total < MIN_CLIENTAS) return null;
  return { pct: Math.round((recurrentes / total) * 100) };
}

const MIN_BRECHA = 10;

// "X es el p% de tus turnos pero el q% de la plata": el servicio cuyo peso en
// plata más supera a su peso en turnos, solo si la brecha es de al menos 10
// puntos (si no, es ruido). Los porcentajes se calculan sobre todos los
// servicios recibidos.
export function brechaServicio(
  servicios: { nombre: string; turnos: number; monto: number }[],
): { nombre: string; pctTurnos: number; pctPlata: number } | null {
  const totalTurnos = servicios.reduce((a, s) => a + s.turnos, 0);
  const totalMonto = servicios.reduce((a, s) => a + s.monto, 0);
  if (totalTurnos < MIN_TURNOS || totalMonto <= 0) return null;

  let mejor: { nombre: string; pctTurnos: number; pctPlata: number; brecha: number } | null = null;
  for (const s of servicios) {
    if (s.turnos <= 0 || s.monto <= 0) continue;
    const pctTurnos = Math.round((s.turnos / totalTurnos) * 100);
    const pctPlata = Math.round((s.monto / totalMonto) * 100);
    const brecha = pctPlata - pctTurnos;
    if (brecha >= MIN_BRECHA && (!mejor || brecha > mejor.brecha)) mejor = { nombre: s.nombre, pctTurnos, pctPlata, brecha };
  }
  return mejor ? { nombre: mejor.nombre, pctTurnos: mejor.pctTurnos, pctPlata: mejor.pctPlata } : null;
}

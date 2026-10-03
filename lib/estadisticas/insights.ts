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

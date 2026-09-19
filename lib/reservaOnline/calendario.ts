import { sumarDias } from './diasDesde';
import type { Fecha, Hora } from './types';

// Links de "Agendar" y "Como llegar" de la pantalla de turno confirmado. Solo
// strings: fecha/hora de pared del salon, sin construir Date (decision D7).

const ZONA_SALON = 'America/Argentina/Buenos_Aires';

function paredCompacta(fecha: Fecha, minutosDelDia: number): string {
  const dias = Math.floor(minutosDelDia / 1440);
  const resto = minutosDelDia % 1440;
  const f = (dias > 0 ? sumarDias(fecha, dias) : fecha).replaceAll('-', '');
  const hh = String(Math.floor(resto / 60)).padStart(2, '0');
  const mm = String(resto % 60).padStart(2, '0');
  return `${f}T${hh}${mm}00`;
}

export function linkGoogleCalendar(p: {
  titulo: string;
  fecha: Fecha;
  hora: Hora;
  duracionMinutos: number;
  ubicacion?: string | null;
}): string {
  const [h, m] = p.hora.split(':').map(Number);
  const inicio = h * 60 + m;
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', p.titulo);
  url.searchParams.set(
    'dates',
    `${paredCompacta(p.fecha, inicio)}/${paredCompacta(p.fecha, inicio + p.duracionMinutos)}`,
  );
  url.searchParams.set('ctz', ZONA_SALON);
  if (p.ubicacion) url.searchParams.set('location', p.ubicacion);
  return url.toString();
}

export function linkComoLlegar(direccion: string): string {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', direccion);
  return url.toString();
}

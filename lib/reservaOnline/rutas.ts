import type { Paso } from './pasoMinimo';

// Rutas del flujo publico (decision D1: la URL es el paso).
export const rutaPaso = (slug: string, paso?: Paso): string =>
  paso ? `/reservar/${slug}/${paso}` : `/reservar/${slug}`;

export const rutaServicio = (slug: string, id: number): string => `/reservar/${slug}/servicio/${id}`;

export const rutaReserva = (slug: string, id: string): string => `/reservar/${slug}/reserva/${id}`;

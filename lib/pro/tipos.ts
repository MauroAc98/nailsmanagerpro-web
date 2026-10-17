// Tipos del portal de profesionales. Son una LISTA BLANCA: solo existen las
// claves que el portal puede mostrar. Teléfono, precio, seña, pagos, otras
// profesionales y cualquier dato que el backend agregue mañana no tienen
// lugar en estos tipos, y los parsers (parsers.ts) los descartan por
// construcción. No se reusa `Turno` del tenant a propósito: lib/pro/tipos.test.ts
// hace fallar `tsc` si se agrega una clave fuera de esta lista.

import type { MotivoVinculo } from '@/lib/pro/errores';

export const ESTADOS_VISUALES = ['confirmado', 'en_curso', 'completado'] as const;
export type EstadoVisual = (typeof ESTADOS_VISUALES)[number];

// Servicio tal como aparece dentro de un turno: solo id y nombre.
export interface ProServicioTurno {
  id: number;
  nombre: string;
}

// Servicio de la lista del filtro (GET /api/pro/servicios). Duración y categoría
// (plana, del mismo negocio) son lo único que se suma al nombre; null cuando un
// backend viejo no las manda. Sin precio, comisión ni seña.
export interface ProServicio extends ProServicioTurno {
  duracion_minutos: number | null;
  categoria: ProCategoriaServicio | null;
}

export interface ProCategoriaServicio {
  id: number;
  nombre: string;
}

export interface ProTurno {
  id: number;
  // Hora de pared del negocio, sin sufijo de zona ("2026-10-17T09:30:00").
  // Nunca pasarla por `new Date`: usar lib/pro/fechaHora.
  fecha_hora: string;
  duracion_total_minutos: number;
  estado_visual: EstadoVisual;
  notas: string | null;
  cliente: { nombre: string | null; apellido: string | null };
  servicios: ProServicioTurno[];
  promo: { nombre: string } | null;
  // Único origen que el portal distingue: la reserva online. Cualquier otro valor
  // (o un backend sin el campo) llega como null.
  origen: 'web' | null;
}

export interface ProListaTurnos {
  turnos: ProTurno[];
  // El backend corta en 500 filas: `true` es la única fuente de verdad.
  truncated: boolean;
  // Filas que llegaron en la lista pero no pasaron el parser (id o fecha_hora
  // inválidos). La UI puede avisar si es > 0 en vez de mostrar una agenda
  // "silenciosamente" más corta.
  descartados: number;
}

// Misma forma que `TurnoMes` del tenant, declarada acá para no importar
// services/turnoService (ni siquiera como tipo) dentro del portal.
export interface ProMarcaDia {
  fecha: string; // "YYYY-MM-DD"
  cantidad: number;
}

// Resultado de una lista parseada: los elementos válidos y cuántos se descartaron.
export interface ProMarcas {
  dias: ProMarcaDia[];
  descartados: number;
}

// Resumen del mes de SU agenda: solo conteos y el nombre del servicio más
// pedido. Lista blanca: sin dinero, clientes ni datos de otras profesionales.
export interface ProResumen {
  atendidos: number;
  por_venir: number;
  cancelados: number;
  mas_pedido: string | null;
}

export interface ProServicios {
  servicios: ProServicio[];
  descartados: number;
}

export interface ProVinculo {
  id: number;
  negocioNombre: string;
  profesional: { nombre: string; apellido: string | null; avatar_url: string | null };
  disponible: boolean;
  motivo: MotivoVinculo | null;
}

export interface ProMe {
  email: string | null;
  vinculos: ProVinculo[];
  descartados: number;
}

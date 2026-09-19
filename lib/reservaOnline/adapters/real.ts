import { isAxiosError, type AxiosInstance } from 'axios';
import { ReservaOnlineError, type ReservaOnlineReads } from '../service';
import type { Availability, BookableService, SalonInfo } from '../types';

// Adapter real de las 3 lecturas publicas (/api/public/{slug}), tarea 2.8.
// El mapeo snake_case -> camelCase vive solo en este archivo (decision D5).

interface SalonDto {
  nombre: string;
  logo_url: string | null;
  direccion: string | null;
  profesionales: { id: number; nombre: string }[];
}
interface ServicioDto {
  id: number;
  nombre: string;
  duracion_minutos: number;
  precio: number;
}
interface DisponibilidadDto {
  fecha: string;
  duracion_total_minutos: number;
  slots: { hora: string; profesional_ids: number[] }[];
}

const aSalon = (d: SalonDto): SalonInfo => ({
  nombre: d.nombre,
  logoUrl: d.logo_url ?? null,
  direccion: d.direccion ?? null,
  profesionales: d.profesionales.map((p) => ({ id: p.id, nombre: p.nombre })),
});

const aServicio = (d: ServicioDto): BookableService => ({
  id: d.id,
  nombre: d.nombre,
  duracionMinutos: d.duracion_minutos,
  precio: Number(d.precio),
  // El backend todavia no expone fotos de servicios: se mapea a [].
  fotos: [],
});

const aDisponibilidad = (d: DisponibilidadDto): Availability => ({
  fecha: d.fecha,
  duracionTotalMinutos: d.duracion_total_minutos,
  slots: d.slots.map((s) => ({ hora: s.hora, profesionalIds: s.profesional_ids })),
});

// 404 -> not_found (salon inexistente o vencido, no se distingue a proposito),
// 422 -> validation; todo lo demas (red, 5xx, 429) -> unknown.
function traducirError(err: unknown): ReservaOnlineError {
  if (isAxiosError(err) && err.response) {
    const mensaje = (err.response.data as { message?: string } | undefined)?.message;
    if (err.response.status === 404) return new ReservaOnlineError('not_found', mensaje);
    if (err.response.status === 422) return new ReservaOnlineError('validation', mensaje);
  }
  return new ReservaOnlineError('unknown', err instanceof Error ? err.message : undefined);
}

async function pedir<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await fn()).data;
  } catch (err) {
    throw traducirError(err);
  }
}

export function createRealReads(http: AxiosInstance): ReservaOnlineReads {
  const base = (slug: string) => `/public/${encodeURIComponent(slug)}`;
  return {
    async getSalon(slug) {
      return aSalon(await pedir(() => http.get<SalonDto>(`${base(slug)}/info`)));
    },
    async getServices(slug, query) {
      const params = query?.profesionalId ? { profesional_id: query.profesionalId } : undefined;
      const data = await pedir(() => http.get<ServicioDto[]>(`${base(slug)}/servicios`, { params }));
      return data.map(aServicio);
    },
    // No existe endpoint de dias con disponibilidad: no se inventan datos.
    async getDiasConDisponibilidad() {
      return null;
    },
    async getAvailability(slug, query) {
      const params: Record<string, unknown> = {
        fecha: query.fecha,
        servicio_ids: query.servicioIds,
      };
      if (query.profesionalId) params.profesional_id = query.profesionalId;
      return aDisponibilidad(
        await pedir(() => http.get<DisponibilidadDto>(`${base(slug)}/disponibilidad`, { params })),
      );
    },
  };
}

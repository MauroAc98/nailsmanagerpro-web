import type { AxiosInstance } from 'axios';
import type { ReservaOnlineReads } from '../service';
import type { Availability, BookableService, Fecha, SalonInfo } from '../types';
import { traducirErrorHttp } from './errores';

// Adapter real de las 3 lecturas publicas (/api/public/{slug}), tarea 2.8.
// El mapeo snake_case -> camelCase vive solo en este archivo (decision D5).

interface SalonDto {
  nombre: string;
  logo_url: string | null;
  direccion: string | null;
  profesionales: { id: number; nombre: string; avatar_url: string | null }[];
  pago_habilitado: boolean;
}
interface ServicioDto {
  id: number;
  nombre: string;
  duracion_minutos: number;
  precio: number;
  categoria?: { id: number; nombre: string } | null;
  // Urls absolutas, ordenadas (la primera es la portada) — forma publica de
  // GET /api/public/{slug}/servicios (distinta de la forma autenticada
  // {id,url,orden} que usa el editor de fotos, ver servicioService).
  fotos: string[];
}
interface DisponibilidadDto {
  fecha: string;
  duracion_total_minutos: number;
  slots: { hora: string; profesional_ids: number[] }[];
}

interface DiasDto {
  dias: { fecha: string; libres: number }[];
}

// El backend acepta rangos de hasta 45 dias por pedido.
const MAX_DIAS_POR_PEDIDO = 45;

const aSalon = (d: SalonDto): SalonInfo => ({
  nombre: d.nombre,
  logoUrl: d.logo_url ?? null,
  direccion: d.direccion ?? null,
  profesionales: d.profesionales.map((p) => ({ id: p.id, nombre: p.nombre, avatarUrl: p.avatar_url ?? null })),
  pagoHabilitado: d.pago_habilitado ?? false,
});

const aServicio = (d: ServicioDto): BookableService => ({
  id: d.id,
  nombre: d.nombre,
  duracionMinutos: d.duracion_minutos,
  precio: Number(d.precio),
  categoria: d.categoria ? { id: d.categoria.id, nombre: d.categoria.nombre } : null,
  fotos: d.fotos,
});

const aDisponibilidad = (d: DisponibilidadDto): Availability => ({
  fecha: d.fecha,
  duracionTotalMinutos: d.duracion_total_minutos,
  slots: d.slots.map((s) => ({ hora: s.hora, profesionalIds: s.profesional_ids })),
});

// Cantidad de dias de `desde` a `hasta` inclusive (fechas de pared, sin zona).
const diasEntre = (desde: Fecha, hasta: Fecha): number =>
  Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) + 1;

async function pedir<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await fn()).data;
  } catch (err) {
    throw traducirErrorHttp(err);
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
    // Un pedido por tramo de hasta 45 dias (min-max de las fechas pedidas); el
    // backend devuelve solo los dias con al menos un inicio libre. Cualquier
    // error -> null (la UI no dibuja puntos y cae al recorrido dia por dia).
    async getDiasConDisponibilidad(slug, query) {
      if (query.fechas.length === 0) return [];
      const pedidas = [...query.fechas].sort();
      const conLugar = new Set<Fecha>();
      try {
        for (let i = 0; i < pedidas.length; ) {
          const desde = pedidas[i];
          let j = i;
          while (j + 1 < pedidas.length && diasEntre(desde, pedidas[j + 1]) <= MAX_DIAS_POR_PEDIDO) j++;
          const params: Record<string, unknown> = {
            desde,
            hasta: pedidas[j],
            servicio_ids: query.servicioIds,
          };
          if (query.profesionalId) params.profesional_id = query.profesionalId;
          const data = await pedir(() => http.get<DiasDto>(`${base(slug)}/disponibilidad/dias`, { params }));
          for (const d of data.dias) conLugar.add(d.fecha);
          i = j + 1;
        }
      } catch {
        return null;
      }
      return pedidas.filter((f) => conLugar.has(f));
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

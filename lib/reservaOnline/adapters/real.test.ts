import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import { describeReadsContract } from '../service.contract';
import { crearPublicHttp } from '../publicHttp';
import { createRealReads } from './real';

// HTTP stubbeado (sin mockear modulos): responde con los JSON exactos del
// contrato del backend (PublicController) y registra las URLs pedidas.
function respuesta(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  const res = { data, status, statusText: String(status), headers: {}, config };
  if (status >= 200 && status < 300) return Promise.resolve(res);
  return Promise.reject(
    Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: res, config }),
  );
}

const SALON = {
  nombre: 'Studio Ana',
  logo_url: null,
  direccion: 'Av. X 123',
  profesionales: [{ id: 3, nombre: 'Ana' }],
};
const SERVICIOS = [
  { id: 7, nombre: 'Esmaltado', duracion_minutos: 45, precio: 12000 },
  { id: 9, nombre: 'Pedicura', duracion_minutos: 45, precio: 15000 },
];

export function crearBackendFalso(pedidos: string[] = []): AxiosAdapter {
  return (config) => {
    const url = (config.url ?? '') + (config.params ? `?${JSON.stringify(config.params)}` : '');
    pedidos.push(url);
    const [, , slug, recurso] = (config.url ?? '').split('/');
    if (slug !== 'ana') return respuesta(config, 404, { message: 'No encontrado' });
    if (recurso === 'info') return respuesta(config, 200, SALON);
    if (recurso === 'servicios') return respuesta(config, 200, SERVICIOS);
    if (recurso === 'disponibilidad') {
      const p = config.params as { fecha: string; servicio_ids?: number[] };
      if (!p.servicio_ids?.length || p.fecha < '2026-09-19') {
        return respuesta(config, 422, { message: 'invalido' });
      }
      return respuesta(config, 200, {
        fecha: p.fecha,
        duracion_total_minutos: 90,
        slots: [
          { hora: '10:00', profesional_ids: [3] },
          { hora: '10:30', profesional_ids: [3, 4] },
        ],
      });
    }
    return respuesta(config, 404, {});
  };
}

const nuevo = (pedidos?: string[]) =>
  createRealReads(
    crearPublicHttp({ baseURL: 'https://api.test/api', adapter: crearBackendFalso(pedidos) }),
  );

describeReadsContract('real (HTTP stubbeado)', () => nuevo(), {
  slug: 'ana',
  slugInexistente: 'nadie',
  fechaFutura: '2026-09-25',
  fechaPasada: '2026-09-18',
  servicioIds: [7, 9],
});

describe('real: mapeo', () => {
  it('mapea snake_case a camelCase', async () => {
    const r = nuevo();
    expect((await r.getSalon('ana')).logoUrl).toBeNull();
    expect((await r.getServices('ana'))[0]).toEqual({
      id: 7,
      nombre: 'Esmaltado',
      duracionMinutos: 45,
      precio: 12000,
      fotos: [],
    });
    const d = await r.getAvailability('ana', { fecha: '2026-09-25', servicioIds: [7, 9] });
    expect(d.duracionTotalMinutos).toBe(90);
    expect(d.slots[1]).toEqual({ hora: '10:30', profesionalIds: [3, 4] });
  });

  it('serializa servicio_ids[] y omite profesional_id cuando no se pasa', async () => {
    let capturado = '';
    const http = crearPublicHttp({
      baseURL: 'https://api.test/api',
      adapter: (config) => {
        capturado = http.getUri(config);
        return respuesta(config, 200, { fecha: '2026-09-25', duracion_total_minutos: 1, slots: [] });
      },
    });
    await createRealReads(http).getAvailability('ana', { fecha: '2026-09-25', servicioIds: [7, 9] });
    expect(decodeURIComponent(capturado)).toBe(
      'https://api.test/api/public/ana/disponibilidad?fecha=2026-09-25&servicio_ids[]=7&servicio_ids[]=9',
    );
    await createRealReads(http).getAvailability('ana', {
      fecha: '2026-09-25',
      servicioIds: [7],
      profesionalId: 3,
    });
    expect(decodeURIComponent(capturado)).toContain('profesional_id=3');
  });

  it('getServices pasa profesional_id solo si se indica', async () => {
    const pedidos: string[] = [];
    await nuevo(pedidos).getServices('ana', { profesionalId: 3 });
    expect(pedidos[0]).toContain('"profesional_id":3');
  });

  it('un error de red (sin respuesta) se traduce a unknown', async () => {
    const http = crearPublicHttp({
      baseURL: 'https://api.test/api',
      adapter: () => Promise.reject(Object.assign(new Error('red'), { isAxiosError: true })),
    });
    await expect(createRealReads(http).getSalon('ana')).rejects.toMatchObject({ code: 'unknown' });
  });
});

describe('real: campos que el backend todavia no tiene', () => {
  it('fotos de los servicios se mapea a [] (el backend aun no las expone)', async () => {
    const servicios = await nuevo().getServices('ana');
    expect(servicios.every((s) => Array.isArray(s.fotos) && s.fotos.length === 0)).toBe(true);
  });

  it('no hay endpoint de dias con disponibilidad: devuelve null y la UI no dibuja puntos', async () => {
    const dias = await nuevo().getDiasConDisponibilidad('ana', { fechas: ['2026-09-25'], servicioIds: [7] });
    expect(dias).toBeNull();
  });
});

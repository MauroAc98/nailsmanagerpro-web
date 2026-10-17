import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CACHE_MAX_ENTRADAS,
  CACHE_VIGENCIA_MS,
  cacheMarcas,
  cacheResumen,
  cacheServicios,
  cacheTurno,
  cacheTurnosDia,
  cacheTurnosRango,
  vaciarCachesPro,
} from '@/lib/pro/caches';

const lista = { turnos: [], truncated: false, descartados: 0 };

describe('caches del portal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vaciarCachesPro();
  });
  afterEach(() => {
    vaciarCachesPro();
    vi.useRealTimers();
  });

  it('usa 12 entradas y 60 s de vigencia', () => {
    expect(CACHE_MAX_ENTRADAS).toBe(12);
    expect(CACHE_VIGENCIA_MS).toBe(60_000);
  });

  it('vaciarCachesPro vacía todas las cachés', () => {
    cacheTurnosDia.set('1:dia:2026-10-17', lista);
    cacheTurnosRango.set('1:rango', lista);
    cacheMarcas.set('1:2026-10', { dias: [], descartados: 0 });
    cacheServicios.set('1', { servicios: [], descartados: 0 });
    cacheResumen.set('1:resumen:2026-10', { atendidos: 0, por_venir: 0, cancelados: 0, mas_pedido: null });
    cacheTurno.set('1:turno:5', {
      id: 5,
      fecha_hora: '2026-10-17T09:30:00',
      duracion_total_minutos: 30,
      estado_visual: 'confirmado',
      notas: null,
      cliente: { nombre: null, apellido: null },
      servicios: [],
      promo: null,
    });
    vaciarCachesPro();
    expect(cacheTurnosDia.size()).toBe(0);
    expect(cacheTurnosRango.size()).toBe(0);
    expect(cacheMarcas.size()).toBe(0);
    expect(cacheServicios.size()).toBe(0);
    expect(cacheResumen.size()).toBe(0);
    expect(cacheTurno.size()).toBe(0);
  });

  it('descarta la menos usada al pasar de 12 entradas', () => {
    for (let i = 0; i < 13; i++) cacheTurnosDia.set(`1:dia:${i}`, lista);
    expect(cacheTurnosDia.size()).toBe(12);
    expect(cacheTurnosDia.get('1:dia:0')).toBeUndefined();
    expect(cacheTurnosDia.get('1:dia:12')).toBe(lista);
  });

  it('las entradas vencen a los 60 s', () => {
    cacheMarcas.set('1:2026-10', { dias: [], descartados: 0 });
    vi.advanceTimersByTime(59_000);
    expect(cacheMarcas.get('1:2026-10')).toBeDefined();
    vi.advanceTimersByTime(61_000);
    expect(cacheMarcas.get('1:2026-10')).toBeUndefined();
  });
});

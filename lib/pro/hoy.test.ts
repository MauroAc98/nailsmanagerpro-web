import { afterEach, describe, expect, it, vi } from 'vitest';
import { hoyDelDispositivo } from '@/lib/pro/hoy';
import { esFechaValida } from '@/lib/pro/fechaHora';

describe('hoyDelDispositivo', () => {
  afterEach(() => vi.useRealTimers());

  it('devuelve YYYY-MM-DD con el día de calendario local, con ceros a la izquierda', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 23, 59, 30)); // hora LOCAL del dispositivo
    expect(hoyDelDispositivo()).toBe('2026-01-05');
  });

  it('a la medianoche local ya es el día siguiente', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 0, 0, 1));
    expect(hoyDelDispositivo()).toBe('2026-12-31');
    vi.setSystemTime(new Date(2027, 0, 1, 0, 0, 0));
    expect(hoyDelDispositivo()).toBe('2027-01-01');
  });

  it('el resultado es una fecha válida', () => {
    expect(esFechaValida(hoyDelDispositivo())).toBe(true);
  });
});

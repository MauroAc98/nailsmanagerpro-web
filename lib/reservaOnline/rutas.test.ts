import { describe, expect, it } from 'vitest';
import { rutaPaso, rutaReserva } from './rutas';

describe('rutas del flujo publico', () => {
  it('rutaPaso arma /reservar/<slug>/<paso>', () => {
    expect(rutaPaso('ana', 'horario')).toBe('/reservar/ana/horario');
  });
  it('rutaPaso sin paso es la entrada', () => {
    expect(rutaPaso('ana')).toBe('/reservar/ana');
  });
  it('rutaReserva apunta al estado de una reserva', () => {
    expect(rutaReserva('ana', 'mock-1')).toBe('/reservar/ana/reserva/mock-1');
  });
});

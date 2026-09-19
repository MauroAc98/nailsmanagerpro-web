import { describe, expect, it } from 'vitest';
import { rutaPaso, rutaReserva, rutaServicio } from './rutas';

describe('rutas del flujo publico', () => {
  it('rutaPaso arma /reservar/<slug>/<paso>', () => {
    expect(rutaPaso('ana', 'horario')).toBe('/reservar/ana/horario');
  });
  it('rutaPaso sin paso es la entrada', () => {
    expect(rutaPaso('ana')).toBe('/reservar/ana');
  });
  it('rutaServicio apunta al detalle de un servicio', () => {
    expect(rutaServicio('ana', 7)).toBe('/reservar/ana/servicio/7');
  });
  it('rutaReserva apunta al estado de una reserva', () => {
    expect(rutaReserva('ana', 'mock-1')).toBe('/reservar/ana/reserva/mock-1');
  });
});

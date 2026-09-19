import { describe, expect, it } from 'vitest';
import { rutaExterna, rutaPaso, rutaReserva, rutaServicio } from './rutas';

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

// Bug real de prod (2026-09-19): dentro de reservar.turnetto.com, empujar la
// ruta absoluta /reservar/{slug}/... (la que arman rutaPaso/rutaServicio/
// rutaReserva, correcta para app.turnetto.com) hace que el rewrite de
// middleware.ts la vuelva a prefijar -> /reservar/reservar/... -> 404. Antes
// de navegar en ese host, hay que sacar el prefijo: el rewrite server-side
// de la primera carga ya lo vuelve a agregar por dentro.
describe('rutaExterna', () => {
  it('en reservar.turnetto.com saca el prefijo /reservar', () => {
    expect(rutaExterna('/reservar/ana/servicios', 'reservar.turnetto.com')).toBe('/ana/servicios');
    expect(rutaExterna('/reservar/ana', 'reservar.turnetto.com')).toBe('/ana');
  });

  it('en cualquier otro host deja la ruta intacta', () => {
    expect(rutaExterna('/reservar/ana/servicios', 'app.turnetto.com')).toBe('/reservar/ana/servicios');
  });
});

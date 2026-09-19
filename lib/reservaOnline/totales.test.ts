import { describe, expect, it } from 'vitest';
import { duracionDeServicios, formatearDuracion } from './totales';
import type { BookableService } from './types';

const svc = (id: number, duracionMinutos: number, precio: number): BookableService => ({
  id,
  nombre: `s${id}`,
  duracionMinutos,
  precio,
  fotos: [],
});

describe('duracionDeServicios', () => {
  const servicios = [svc(1, 45, 12000), svc(2, 30, 8000), svc(3, 60, 20000)];

  it('suma la duracion de los servicios elegidos (nunca el precio)', () => {
    expect(duracionDeServicios(servicios, [1, 3])).toBe(105);
  });

  it('sin seleccion devuelve cero', () => {
    expect(duracionDeServicios(servicios, [])).toBe(0);
  });

  it('ignora ids que no estan en el catalogo', () => {
    expect(duracionDeServicios(servicios, [2, 99])).toBe(30);
  });

  it('no cuenta dos veces un id repetido', () => {
    expect(duracionDeServicios(servicios, [1, 1])).toBe(45);
  });
});

describe('formatearDuracion', () => {
  it('menos de una hora: solo minutos', () => {
    expect(formatearDuracion(45)).toBe('45 min');
  });
  it('horas exactas: solo horas', () => {
    expect(formatearDuracion(120)).toBe('2 h');
  });
  it('horas y minutos', () => {
    expect(formatearDuracion(150)).toBe('2 h 30 min');
  });
});

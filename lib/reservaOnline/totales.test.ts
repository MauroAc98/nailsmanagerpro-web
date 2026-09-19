import { describe, expect, it } from 'vitest';
import { totalesDeServicios } from './totales';
import type { BookableService } from './types';

const svc = (id: number, duracionMinutos: number, precio: number): BookableService => ({
  id,
  nombre: `s${id}`,
  duracionMinutos,
  precio,
});

describe('totalesDeServicios', () => {
  const servicios = [svc(1, 45, 12000), svc(2, 30, 8000), svc(3, 60, 20000)];

  it('suma precio y duracion de los servicios elegidos', () => {
    expect(totalesDeServicios(servicios, [1, 3])).toEqual({ precio: 32000, duracionMinutos: 105 });
  });

  it('sin seleccion devuelve ceros', () => {
    expect(totalesDeServicios(servicios, [])).toEqual({ precio: 0, duracionMinutos: 0 });
  });

  it('ignora ids que no estan en el catalogo', () => {
    expect(totalesDeServicios(servicios, [2, 99])).toEqual({ precio: 8000, duracionMinutos: 30 });
  });

  it('no cuenta dos veces un id repetido', () => {
    expect(totalesDeServicios(servicios, [1, 1])).toEqual({ precio: 12000, duracionMinutos: 45 });
  });
});

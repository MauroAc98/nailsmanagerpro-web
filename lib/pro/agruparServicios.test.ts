import { describe, expect, it } from 'vitest';
import { agruparServicios } from './agruparServicios';
import type { ProServicio } from './tipos';

const manos = { id: 5, nombre: 'Manos' };
const pies = { id: 6, nombre: 'Pies' };

function servicio(id: number, categoria: ProServicio['categoria'] = null): ProServicio {
  return { id, nombre: `S${id}`, duracion_minutos: 30, categoria };
}

describe('agruparServicios', () => {
  it('sin ninguna categoría devuelve null (lista plana, como hoy)', () => {
    expect(agruparServicios([servicio(1), servicio(2)])).toBeNull();
  });

  it('una lista vacía devuelve null', () => {
    expect(agruparServicios([])).toBeNull();
  });

  it('agrupa por categoría, ordenadas por nombre, y deja "Sin categoría" (id null) al final', () => {
    const grupos = agruparServicios([servicio(1, pies), servicio(2), servicio(3, manos), servicio(4, pies)]);
    expect(grupos).toEqual([
      { id: 5, nombre: 'Manos', servicios: [servicio(3, manos)] },
      { id: 6, nombre: 'Pies', servicios: [servicio(1, pies), servicio(4, pies)] },
      { id: null, nombre: '', servicios: [servicio(2)] },
    ]);
  });

  it('conserva el orden en que llegaron los servicios dentro de cada grupo', () => {
    const grupos = agruparServicios([servicio(9, manos), servicio(2, manos), servicio(5, manos)]);
    expect(grupos?.[0].servicios.map((s) => s.id)).toEqual([9, 2, 5]);
  });

  it('no agrega el grupo "Sin categoría" si todos tienen categoría', () => {
    expect(agruparServicios([servicio(1, manos)])?.map((g) => g.id)).toEqual([5]);
  });

  it('no muta la lista recibida', () => {
    const entrada = [servicio(1, pies), servicio(2, manos)];
    agruparServicios(entrada);
    expect(entrada.map((s) => s.id)).toEqual([1, 2]);
  });
});

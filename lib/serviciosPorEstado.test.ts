import { describe, expect, it } from 'vitest';
import type { Servicio } from '@/services/servicioService';
import { contarPorEstado, filtrarPorEstado } from './serviciosPorEstado';

const s = (id: number, activo: boolean) => ({ id, activo }) as Servicio;
const lista = [s(1, true), s(2, false), s(3, true)];

describe('filtrarPorEstado', () => {
  it('todos devuelve la lista completa', () => {
    expect(filtrarPorEstado(lista, 'todos').map(x => x.id)).toEqual([1, 2, 3]);
  });
  it('activos deja solo los activos', () => {
    expect(filtrarPorEstado(lista, 'activos').map(x => x.id)).toEqual([1, 3]);
  });
  it('pausados deja solo los inactivos', () => {
    expect(filtrarPorEstado(lista, 'pausados').map(x => x.id)).toEqual([2]);
  });
});

describe('contarPorEstado', () => {
  it('cuenta total, activos y pausados', () => {
    expect(contarPorEstado(lista)).toEqual({ todos: 3, activos: 2, pausados: 1 });
  });
});

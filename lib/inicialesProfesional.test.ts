import { describe, expect, it } from 'vitest';
import { inicialesProfesional } from './inicialesProfesional';

describe('inicialesProfesional', () => {
  it('usa la primera letra del nombre + la primera del apellido cuando hay apellido', () => {
    expect(inicialesProfesional('Ana', 'Gómez')).toBe('AG');
  });

  it('usa las primeras dos palabras del nombre cuando no hay apellido', () => {
    expect(inicialesProfesional('María José', null)).toBe('MJ');
  });

  it('usa las primeras 2 letras del nombre cuando es una sola palabra y no hay apellido', () => {
    expect(inicialesProfesional('Ana')).toBe('AN');
  });

  it('devuelve las iniciales en mayúsculas sin importar el casing de entrada', () => {
    expect(inicialesProfesional('ana', 'gomez')).toBe('AG');
  });
});

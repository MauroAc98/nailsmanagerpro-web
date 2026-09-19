import { describe, expect, it } from 'vitest';
import { diasAtencionParaGuardar } from './diasAtencionParaGuardar';

describe('diasAtencionParaGuardar', () => {
  it('sin selección → null (atiende todos los días, mismo default que omitir el campo)', () => {
    expect(diasAtencionParaGuardar([])).toBeNull();
  });

  it('los 7 días seleccionados → null (equivalente semántico a "todos")', () => {
    expect(diasAtencionParaGuardar([0, 1, 2, 3, 4, 5, 6])).toBeNull();
  });

  it('un subconjunto real se preserva tal cual', () => {
    expect(diasAtencionParaGuardar([1, 3, 5])).toEqual([1, 3, 5]);
  });
});

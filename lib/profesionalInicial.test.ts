import { describe, expect, it } from 'vitest';
import { profesionalInicialId } from './profesionalInicial';
import type { Profesional } from '@/services/profesionalService';

const p = (id: number, activo = true) => ({ id, activo }) as unknown as Profesional;

describe('profesionalInicialId', () => {
  it('devuelve la jefa (id mas bajo activo)', () => {
    expect(profesionalInicialId([p(5), p(2), p(9)])).toBe(2);
  });
  it('ignora inactivas', () => {
    expect(profesionalInicialId([p(1, false), p(4)])).toBe(4);
  });
  it('sin profesionales devuelve null', () => {
    expect(profesionalInicialId([])).toBeNull();
  });
});

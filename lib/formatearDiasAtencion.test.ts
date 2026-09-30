import { describe, expect, it } from 'vitest';
import { formatearDiasAtencion } from './formatearDiasAtencion';

// Abreviaturas de prueba lunes-primero (mismo orden que WeekdayPicker), en
// el orden de valores Carbon del backend (0=domingo..6=sábado).
const ABREV: Record<number, string> = {
  0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb',
};
const TODOS = 'Todos los días';

describe('formatearDiasAtencion', () => {
  it('null (sin restricción) da "todos los días"', () => {
    expect(formatearDiasAtencion(null, ABREV, TODOS, 'a')).toBe(TODOS);
  });

  it('array vacío también es "todos los días" (mismo significado que null)', () => {
    expect(formatearDiasAtencion([], ABREV, TODOS, 'a')).toBe(TODOS);
  });

  it('los 7 días marcados también es "todos los días"', () => {
    expect(formatearDiasAtencion([0, 1, 2, 3, 4, 5, 6], ABREV, TODOS, 'a')).toBe(TODOS);
  });

  it('un rango contiguo lunes a viernes se colapsa en "Lun a Vie"', () => {
    expect(formatearDiasAtencion([1, 2, 3, 4, 5], ABREV, TODOS, 'a')).toBe('Lun a Vie');
  });

  it('un solo día suelto se muestra solo, sin "a"', () => {
    expect(formatearDiasAtencion([3], ABREV, TODOS, 'a')).toBe('Mié');
  });

  it('dos rangos no contiguos se listan separados por coma', () => {
    // Atiende lunes-martes y jueves-viernes (miércoles libre)
    expect(formatearDiasAtencion([1, 2, 4, 5], ABREV, TODOS, 'a')).toBe('Lun a Mar, Jue a Vie');
  });

  it('el rango contiguo respeta el orden lunes-primero aunque el domingo (0) vaya al final', () => {
    // Atiende viernes, sábado y domingo — contiguo en el orden de negocio
    // (Lun..Dom), aunque domingo sea el valor Carbon más chico (0).
    expect(formatearDiasAtencion([5, 6, 0], ABREV, TODOS, 'a')).toBe('Vie a Dom');
  });
});

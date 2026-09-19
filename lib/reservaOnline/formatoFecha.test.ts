import { describe, expect, it } from 'vitest';
import { diaCorto, diaDelMes, fechaLarga, mesAnio, diaLargoCorto, hoyDelSalon } from './formatoFecha';

describe('formatoFecha (solo display, UTC puro)', () => {
  it('fechaLarga capitaliza el dia: "Martes 22 de septiembre"', () => {
    expect(fechaLarga('2026-09-22', 'es')).toBe('Martes 22 de septiembre');
  });
  it('fechaLarga en pt-BR', () => {
    expect(fechaLarga('2026-09-22', 'pt-BR')).toBe('Terça-feira 22 de setembro');
  });
  it('diaCorto y diaDelMes', () => {
    expect(diaCorto('2026-09-21', 'es')).toBe('Lun');
    expect(diaDelMes('2026-09-05')).toBe('5');
  });
  it('mesAnio: "Septiembre 2026"', () => {
    expect(mesAnio('2026-09-22', 'es')).toBe('Septiembre 2026');
  });
  it('diaLargoCorto: "martes 22"', () => {
    expect(diaLargoCorto('2026-09-22', 'es')).toBe('martes 22');
  });
  it('hoyDelSalon usa UTC-3 (a las 01:00 UTC todavia es el dia anterior)', () => {
    expect(hoyDelSalon(Date.UTC(2026, 8, 20, 1, 0))).toBe('2026-09-19');
    expect(hoyDelSalon(Date.UTC(2026, 8, 20, 15, 0))).toBe('2026-09-20');
  });
});

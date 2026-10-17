import { describe, expect, it } from 'vitest';
import type { FiltrosAgenda } from '@/store/useProAgendaStore';
import { filtrosAParams, hayFiltrosActivos, normalizarBuscar, validarBuscar, validarRango } from './filtros';

const vacios: FiltrosAgenda = { buscar: '', servicioId: null, desde: null, hasta: null };

describe('normalizarBuscar', () => {
  it.each([
    ['  Ana  ', 'Ana'],
    ['Ana   María\tPérez', 'Ana María Pérez'],
    ['', ''],
    ['   ', ''],
  ])('%j -> %j', (entrada, salida) => {
    expect(normalizarBuscar(entrada)).toBe(salida);
  });
});

describe('validarBuscar', () => {
  it('acepta vacío, 5 palabras y 60 caracteres', () => {
    expect(validarBuscar('')).toBe('ok');
    expect(validarBuscar('a b c d e')).toBe('ok');
    expect(validarBuscar('x'.repeat(60))).toBe('ok');
  });
  it('rechaza más de 5 palabras', () => {
    expect(validarBuscar('a b c d e f')).toBe('demasiadasPalabras');
    expect(validarBuscar('  a  b c d e   f ')).toBe('demasiadasPalabras');
  });
  it('rechaza más de 60 caracteres (ya normalizado)', () => {
    expect(validarBuscar('x'.repeat(61))).toBe('larga');
    expect(validarBuscar(`  ${'x'.repeat(60)}  `)).toBe('ok');
  });
});

describe('validarRango', () => {
  it('los bordes: 366 días sí, 367 no', () => {
    expect(validarRango('2026-01-01', '2026-12-31')).toBe('ok'); // 365 días
    expect(validarRango('2024-01-01', '2024-12-31')).toBe('ok'); // 366 días, bisiesto
    expect(validarRango('2024-01-01', '2025-01-01')).toBe('largo'); // 367 días
  });
  it('antes del 2000-01-01 no, el 2000-01-01 sí', () => {
    expect(validarRango('1999-12-31', '2000-01-02')).toBe('antes2000');
    expect(validarRango('2000-01-01', '2000-01-02')).toBe('ok');
  });
  it('desde posterior a hasta', () => {
    expect(validarRango('2026-10-18', '2026-10-17')).toBe('orden');
  });
  it('mismo día es válido', () => {
    expect(validarRango('2026-10-17', '2026-10-17')).toBe('ok');
  });
  it('fechas que no existen se rechazan', () => {
    expect(validarRango('2026-02-30', '2026-03-01')).toBe('orden');
  });
});

describe('hayFiltrosActivos', () => {
  it('vacío no está activo', () => {
    expect(hayFiltrosActivos(vacios)).toBe(false);
    expect(hayFiltrosActivos({ ...vacios, buscar: '   ' })).toBe(false);
  });
  it.each([
    [{ buscar: 'Ana' }],
    [{ servicioId: 3 }],
    [{ desde: '2026-10-01', hasta: '2026-10-05' }],
  ])('%j está activo', (cambios) => {
    expect(hayFiltrosActivos({ ...vacios, ...cambios })).toBe(true);
  });
});

describe('filtrosAParams', () => {
  it('sin rango usa el día elegido como rango de un día', () => {
    expect(filtrosAParams({ ...vacios, buscar: ' Ana ', servicioId: 2 }, '2026-10-17')).toEqual({
      desde: '2026-10-17',
      hasta: '2026-10-17',
      buscar: 'Ana',
      servicio_id: 2,
    });
  });
  it('con rango lo envía tal cual y omite lo vacío', () => {
    expect(filtrosAParams({ ...vacios, desde: '2026-10-01', hasta: '2026-10-05' }, '2026-10-17')).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-05',
    });
  });
  it('devuelve null (sin pedido) ante un valor inválido', () => {
    expect(filtrosAParams({ ...vacios, buscar: 'a b c d e f' }, '2026-10-17')).toBeNull();
    expect(filtrosAParams({ ...vacios, desde: '2026-10-05', hasta: '2026-10-01' }, '2026-10-17')).toBeNull();
    expect(filtrosAParams({ ...vacios, desde: '2026-10-05', hasta: null }, '2026-10-17')).toBeNull();
    expect(filtrosAParams({ ...vacios, servicioId: 0 }, '2026-10-17')).toBeNull();
  });
});

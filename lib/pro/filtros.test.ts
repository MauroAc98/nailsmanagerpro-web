import { describe, expect, it } from 'vitest';
import type { FiltrosAgenda } from '@/store/useProAgendaStore';
import { filtrosAParams, hayFiltrosActivos, normalizarBuscar, validarBuscar } from './filtros';

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
    expect(filtrosAParams({ ...vacios, desde: '2024-01-01', hasta: '2025-01-01' }, '2026-10-17')).toBeNull(); // 367 días
    expect(filtrosAParams({ ...vacios, desde: '1999-12-31', hasta: '2000-01-02' }, '2026-10-17')).toBeNull();
    expect(filtrosAParams({ ...vacios, servicioId: 0 }, '2026-10-17')).toBeNull();
  });
});

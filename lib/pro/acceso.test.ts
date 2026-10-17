import { describe, expect, it } from 'vitest';
import { bloqueoEfectivo, calcularAcceso, type BloqueosVinculo } from './acceso';
import type { ProVinculo } from './tipos';

function vinculo(id: number, extra: Partial<ProVinculo> = {}): ProVinculo {
  return {
    id,
    negocioNombre: `Negocio ${id}`,
    profesional: { nombre: 'Ana', apellido: null, avatar_url: null },
    disponible: true,
    motivo: null,
    ...extra,
  };
}

const SIN_BLOQUEOS: BloqueosVinculo = {};

describe('bloqueoEfectivo', () => {
  it('un vínculo disponible y sin bloqueo registrado no está bloqueado', () => {
    expect(bloqueoEfectivo(vinculo(1), SIN_BLOQUEOS)).toBeNull();
  });

  it('un vínculo que `me` informa como no disponible está sin servicio con su motivo', () => {
    const v = vinculo(1, { disponible: false, motivo: 'SUBSCRIPTION_SUSPENDED' });
    expect(bloqueoEfectivo(v, SIN_BLOQUEOS)).toEqual({ estado: 'noService', motivo: 'SUBSCRIPTION_SUSPENDED' });
  });

  it('un vínculo no disponible sin motivo conocido queda sin servicio con motivo null', () => {
    expect(bloqueoEfectivo(vinculo(1, { disponible: false }), SIN_BLOQUEOS)).toEqual({ estado: 'noService', motivo: null });
  });

  it('el bloqueo detectado en una llamada de datos gana sobre lo que dijo `me`', () => {
    const bloqueos: BloqueosVinculo = { 1: { estado: 'disabled', motivo: null } };
    expect(bloqueoEfectivo(vinculo(1), bloqueos)).toEqual({ estado: 'disabled', motivo: null });
  });

  it('el bloqueo de otro vínculo no se contagia', () => {
    const bloqueos: BloqueosVinculo = { 2: { estado: 'disabled', motivo: null } };
    expect(bloqueoEfectivo(vinculo(1), bloqueos)).toBeNull();
  });
});

describe('calcularAcceso', () => {
  it('sin vínculos el acceso está deshabilitado (SE-9 S5)', () => {
    expect(calcularAcceso([], null, SIN_BLOQUEOS)).toBe('deshabilitado');
  });

  it('con el vínculo activo disponible está listo', () => {
    expect(calcularAcceso([vinculo(1), vinculo(2)], 2, SIN_BLOQUEOS)).toBe('listo');
  });

  it('un vínculo activo bloqueado como deshabilitado muestra el acceso deshabilitado', () => {
    expect(calcularAcceso([vinculo(1)], 1, { 1: { estado: 'disabled', motivo: null } })).toBe('deshabilitado');
  });

  it('un vínculo activo bloqueado por servicio muestra sin servicio', () => {
    const bloqueos: BloqueosVinculo = { 1: { estado: 'noService', motivo: 'SUBSCRIPTION_EXPIRED' } };
    expect(calcularAcceso([vinculo(1), vinculo(2)], 1, bloqueos)).toBe('sinServicio');
  });

  it('un vínculo activo que `me` informó como no disponible muestra sin servicio (único vínculo auto-elegido)', () => {
    const unico = vinculo(1, { disponible: false, motivo: 'NO_SUBSCRIPTION' });
    expect(calcularAcceso([unico], 1, SIN_BLOQUEOS)).toBe('sinServicio');
  });

  it('el bloqueo de un vínculo que no es el activo no afecta al activo', () => {
    const bloqueos: BloqueosVinculo = { 2: { estado: 'disabled', motivo: null } };
    expect(calcularAcceso([vinculo(1), vinculo(2)], 1, bloqueos)).toBe('listo');
  });

  it('con varios vínculos y ninguno activo hay que elegir', () => {
    expect(calcularAcceso([vinculo(1), vinculo(2)], null, SIN_BLOQUEOS)).toBe('elegir');
  });

  it('con ninguno activo y solo uno disponible igual hay que elegir (el chooser muestra el otro deshabilitado)', () => {
    const vinculos = [vinculo(1, { disponible: false, motivo: 'NO_SUBSCRIPTION' }), vinculo(2)];
    expect(calcularAcceso(vinculos, null, SIN_BLOQUEOS)).toBe('elegir');
  });

  it('un vínculo disponible bloqueado en tiempo de ejecución no cuenta como elegible', () => {
    const bloqueos: BloqueosVinculo = { 1: { estado: 'disabled', motivo: null } };
    expect(calcularAcceso([vinculo(1), vinculo(2)], null, bloqueos)).toBe('elegir');
    expect(calcularAcceso([vinculo(1), vinculo(2)], null, { ...bloqueos, 2: { estado: 'disabled', motivo: null } })).toBe(
      'deshabilitado',
    );
  });

  it('todos los vínculos sin servicio muestra sin servicio, no una lista vacía (SE-9 S4)', () => {
    const vinculos = [
      vinculo(1, { disponible: false, motivo: 'NO_SUBSCRIPTION' }),
      vinculo(2, { disponible: false, motivo: 'SUBSCRIPTION_SUSPENDED' }),
    ];
    expect(calcularAcceso(vinculos, null, SIN_BLOQUEOS)).toBe('sinServicio');
  });

  it('todos bloqueados y mezclados entre deshabilitado y sin servicio muestra sin servicio', () => {
    const bloqueos: BloqueosVinculo = { 1: { estado: 'disabled', motivo: null } };
    const vinculos = [vinculo(1), vinculo(2, { disponible: false, motivo: 'SUBSCRIPTION_EXPIRED' })];
    expect(calcularAcceso(vinculos, null, bloqueos)).toBe('sinServicio');
  });

  it('un id activo que ya no figura en `me` se trata como sin vínculo activo', () => {
    expect(calcularAcceso([vinculo(1), vinculo(2)], 99, SIN_BLOQUEOS)).toBe('elegir');
    expect(calcularAcceso([vinculo(1, { disponible: false })], 99, SIN_BLOQUEOS)).toBe('sinServicio');
  });
});

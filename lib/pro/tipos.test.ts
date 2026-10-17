import { describe, expect, expectTypeOf, it } from 'vitest';
import { parseProTurno } from './parsers';
import type { ProTurno } from './tipos';

// Barrera de privacidad a nivel de tipos (AG-1 S2): si alguien agrega a
// ProTurno una clave que no está en la lista blanca (teléfono, precio, seña,
// pagos, profesional...), `tsc --noEmit` falla en este archivo. vitest no
// chequea tipos: la garantía la da el `tsc` de la verificación.
type ClavesDeTurno = keyof ProTurno;

type PalabraProhibida =
  | 'telefono'
  | 'phone'
  | 'celular'
  | 'whatsapp'
  | 'precio'
  | 'price'
  | 'monto'
  | 'sena'
  | 'deposit'
  | 'pago'
  | 'payment'
  | 'comision'
  | 'profesional'
  | 'user'
  | 'email';
type ClaveProhibida = Extract<ClavesDeTurno, `${string}${PalabraProhibida}${string}`>;

describe('ProTurno — lista blanca a nivel de tipos', () => {
  it('no tiene ninguna clave de teléfono, precio, seña, pago o profesional', () => {
    expectTypeOf<ClaveProhibida>().toEqualTypeOf<never>();
    // Un tipo que SÍ las tuviera no daría `never`: la comprobación no es vacía.
    expectTypeOf<Extract<'precio_total' | 'id', `${string}precio${string}`>>().toEqualTypeOf<'precio_total'>();
  });

  it('tiene exactamente las claves de la lista blanca', () => {
    expectTypeOf<ClavesDeTurno>().toEqualTypeOf<
      | 'id'
      | 'fecha_hora'
      | 'duracion_total_minutos'
      | 'estado_visual'
      | 'notas'
      | 'cliente'
      | 'servicios'
      | 'promo'
    >();
    expectTypeOf<keyof ProTurno['cliente']>().toEqualTypeOf<'nombre' | 'apellido'>();
    expectTypeOf<keyof ProTurno['servicios'][number]>().toEqualTypeOf<'id' | 'nombre'>();
    expectTypeOf<keyof NonNullable<ProTurno['promo']>>().toEqualTypeOf<'nombre'>();
  });

  it('el parser produce exactamente esas claves en runtime', () => {
    const turno = parseProTurno({
      id: 1,
      fecha_hora: '2026-10-17T09:30:00',
      duracion_total_minutos: 60,
      estado_visual: 'confirmado',
      notas: null,
      cliente: { nombre: 'Ana', apellido: null },
      servicios: [{ id: 2, nombre: 'Gel' }],
      promo: { nombre: 'Promo' },
    });
    const claves: ClavesDeTurno[] = [
      'id',
      'fecha_hora',
      'duracion_total_minutos',
      'estado_visual',
      'notas',
      'cliente',
      'servicios',
      'promo',
    ];
    expect(turno).not.toBeNull();
    expect(Object.keys(turno as ProTurno).sort()).toEqual([...claves].sort());
  });
});

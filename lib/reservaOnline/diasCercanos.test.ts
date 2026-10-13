import { describe, expect, it } from 'vitest';
import { diasCercanos, diasEntre } from './diasCercanos';

const VENTANA = { primero: '2026-09-14', ultimo: '2026-10-14' };

describe('diasEntre', () => {
  it('cuenta los dias de calendario entre dos fechas', () => {
    expect(diasEntre('2026-09-16', '2026-09-18')).toBe(2);
    expect(diasEntre('2026-09-18', '2026-09-16')).toBe(2);
    expect(diasEntre('2026-09-30', '2026-10-01')).toBe(1);
  });
});

describe('diasCercanos', () => {
  it('devuelve el dia con lugar mas cercano de cada lado del elegido', () => {
    const r = diasCercanos(['2026-09-14', '2026-09-15', '2026-09-18', '2026-09-25'], '2026-09-16', VENTANA);
    expect(r).toEqual({ antes: '2026-09-15', despues: '2026-09-18' });
  });

  it('sin dias anteriores (hoy es el primer dia reservable) solo hay "despues"', () => {
    expect(diasCercanos(['2026-09-16'], '2026-09-14', VENTANA)).toEqual({ antes: null, despues: '2026-09-16' });
  });

  it('sin dias posteriores solo hay "antes"', () => {
    expect(diasCercanos(['2026-09-20'], '2026-09-25', VENTANA)).toEqual({ antes: '2026-09-20', despues: null });
  });

  it('nunca sugiere un dia fuera de la ventana reservable (pasado o mas alla del limite)', () => {
    const r = diasCercanos(['2026-09-10', '2026-10-20'], '2026-09-16', VENTANA);
    expect(r).toEqual({ antes: null, despues: null });
  });

  it('no se sugiere a si mismo aunque figure con lugar', () => {
    expect(diasCercanos(['2026-09-16', '2026-09-18'], '2026-09-16', VENTANA)).toEqual({
      antes: null,
      despues: '2026-09-18',
    });
  });

  it('sin ningun dia con lugar no hay sugerencias', () => {
    expect(diasCercanos([], '2026-09-16', VENTANA)).toEqual({ antes: null, despues: null });
  });
});

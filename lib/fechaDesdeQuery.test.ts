import { describe, it, expect } from 'vitest';
import { fechaValidaDeQuery } from './fechaDesdeQuery';

describe('fechaValidaDeQuery', () => {
  it('devuelve la fecha cuando es YYYY-MM-DD válida', () => {
    expect(fechaValidaDeQuery('2026-10-09')).toBe('2026-10-09');
  });
  it('acepta el 29 de febrero de un año bisiesto', () => {
    expect(fechaValidaDeQuery('2028-02-29')).toBe('2028-02-29');
  });
  it.each([null, undefined, '', 'hoy', '2026-1-9', '2026/10/09', '09-10-2026', ' 2026-10-09', '2026-10-09x'])(
    'ignora el valor con mal formato %s',
    (v) => expect(fechaValidaDeQuery(v)).toBeNull(),
  );
  it.each(['2026-13-01', '2026-00-10', '2026-02-30', '2027-02-29', '2026-04-31', '2026-10-00'])(
    'ignora la fecha de calendario inexistente %s',
    (v) => expect(fechaValidaDeQuery(v)).toBeNull(),
  );
});

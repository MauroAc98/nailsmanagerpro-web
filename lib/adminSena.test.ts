import { describe, expect, it } from 'vitest';
import { etiquetaSenaAdmin } from './adminSena';

describe('etiquetaSenaAdmin', () => {
  it('monto fijo: muestra el importe', () => {
    expect(etiquetaSenaAdmin('5000.00')).toBe('Seña: $5.000,00');
  });
  it.each([null, '', '0', '0.00'])('sin monto (%s): muestra un guion, nunca $0 ni null', (m) => {
    expect(etiquetaSenaAdmin(m)).toBe('Seña: —');
  });
});

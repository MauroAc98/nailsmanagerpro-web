import { describe, expect, it } from 'vitest';
import { esHostReservaPublica } from './host';

describe('esHostReservaPublica', () => {
  it('true para reservar.turnetto.com', () => {
    expect(esHostReservaPublica('reservar.turnetto.com')).toBe(true);
  });

  it('false para cualquier otro host', () => {
    expect(esHostReservaPublica('app.turnetto.com')).toBe(false);
    expect(esHostReservaPublica('admin.turnetto.com')).toBe(false);
    expect(esHostReservaPublica('localhost')).toBe(false);
  });
});

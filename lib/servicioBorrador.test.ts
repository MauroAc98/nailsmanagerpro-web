import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BORRADOR_TTL_MS, consumirBorrador, guardarBorrador, limpiarBorrador } from '@/lib/servicioBorrador';

beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('servicioBorrador', () => {
  it('restores what was saved, exactly once (consume + delete)', () => {
    guardarBorrador('nuevo', { nombre: 'Combo' });
    expect(consumirBorrador('nuevo')).toEqual({ nombre: 'Combo' });
    expect(consumirBorrador('nuevo')).toBeNull();
  });

  it('keeps drafts of different forms apart', () => {
    guardarBorrador('nuevo', { a: 1 });
    guardarBorrador('editar-7', { b: 2 });
    expect(consumirBorrador('editar-7')).toEqual({ b: 2 });
    expect(consumirBorrador('nuevo')).toEqual({ a: 1 });
  });

  it('clears a draft on demand', () => {
    guardarBorrador('nuevo', { a: 1 });
    limpiarBorrador('nuevo');
    expect(consumirBorrador('nuevo')).toBeNull();
  });

  it('ignores (and removes) a draft older than the expiry', () => {
    const t0 = 1_000_000;
    guardarBorrador('nuevo', { a: 1 }, t0);
    expect(consumirBorrador('nuevo', t0 + BORRADOR_TTL_MS + 1)).toBeNull();
    expect(consumirBorrador('nuevo', t0)).toBeNull();
  });

  it('ignores corrupt content', () => {
    window.sessionStorage.setItem('servicioBorrador:nuevo', '{no json');
    expect(consumirBorrador('nuevo')).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => guardarBorrador('nuevo', { a: 1 })).not.toThrow();
    expect(consumirBorrador('nuevo')).toBeNull();
    expect(() => limpiarBorrador('nuevo')).not.toThrow();
  });
});

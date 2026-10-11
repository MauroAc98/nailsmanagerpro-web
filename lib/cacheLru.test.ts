import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearCacheLru } from './cacheLru';

describe('crearCacheLru', () => {
  it('guarda y devuelve por clave', () => {
    const c = crearCacheLru<number>(3);
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBeUndefined();
  });

  it('descarta la menos usada al pasar el máximo', () => {
    const c = crearCacheLru<number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a'); // a queda como la más reciente
    c.set('c', 3);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
    expect(c.size()).toBe(2);
  });

  it('clear vacía todo', () => {
    const c = crearCacheLru<number>(2);
    c.set('a', 1);
    c.clear();
    expect(c.size()).toBe(0);
  });

  describe('vencimiento', () => {
    afterEach(() => vi.useRealTimers());

    it('por defecto una entrada vence al minuto: después no se devuelve', () => {
      vi.useFakeTimers();
      const c = crearCacheLru<number>(2);
      c.set('a', 1);
      vi.advanceTimersByTime(59_000);
      expect(c.get('a')).toBe(1);
      vi.advanceTimersByTime(2_000);
      expect(c.get('a')).toBeUndefined();
      expect(c.size()).toBe(0);
    });

    it('acepta otro vencimiento', () => {
      vi.useFakeTimers();
      const c = crearCacheLru<number>(2, 1_000);
      c.set('a', 1);
      vi.advanceTimersByTime(1_001);
      expect(c.get('a')).toBeUndefined();
    });

    it('volver a guardar renueva el vencimiento', () => {
      vi.useFakeTimers();
      const c = crearCacheLru<number>(2);
      c.set('a', 1);
      vi.advanceTimersByTime(50_000);
      c.set('a', 2);
      vi.advanceTimersByTime(50_000);
      expect(c.get('a')).toBe(2);
    });
  });
});

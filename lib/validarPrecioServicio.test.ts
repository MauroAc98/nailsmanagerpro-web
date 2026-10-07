import { describe, expect, it } from 'vitest';
import { validarPrecioServicio } from './validarPrecioServicio';

describe('validarPrecioServicio', () => {
  it('rejects an empty price as required', () => {
    expect(validarPrecioServicio('')).toEqual({ ok: false, error: 'required' });
    expect(validarPrecioServicio('   ')).toEqual({ ok: false, error: 'required' });
  });

  it('rejects an unparseable price as invalid', () => {
    expect(validarPrecioServicio('abc')).toEqual({ ok: false, error: 'invalid' });
  });

  it('accepts a valid price and returns the parsed value', () => {
    expect(validarPrecioServicio('1500')).toEqual({ ok: true, valor: 1500 });
    expect(validarPrecioServicio('1.500,50')).toEqual({ ok: true, valor: 1500.5 });
  });
});

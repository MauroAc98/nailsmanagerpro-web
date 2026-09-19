import { describe, expect, it, vi } from 'vitest';
import { exigirReservaOnlineHabilitada } from './gate';

describe('exigirReservaOnlineHabilitada', () => {
  it('con la flag apagada dispara notFound', () => {
    const notFound = vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
    expect(() => exigirReservaOnlineHabilitada({ habilitada: () => false, notFound })).toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(notFound).toHaveBeenCalledOnce();
  });

  it('con la flag encendida no hace nada', () => {
    const notFound = vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
    exigirReservaOnlineHabilitada({ habilitada: () => true, notFound });
    expect(notFound).not.toHaveBeenCalled();
  });
});

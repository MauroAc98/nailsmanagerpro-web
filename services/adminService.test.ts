import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminService } from './adminService';

const CLAVE = 'admin_token_expires_at';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('adminService.tokenExpirado — falla cerrado', () => {
  it('un expires_at futuro no está vencido', () => {
    localStorage.setItem(CLAVE, new Date(Date.now() + 60 * 60 * 1000).toISOString());

    expect(adminService.tokenExpirado()).toBe(false);
  });

  it('un expires_at pasado está vencido', () => {
    localStorage.setItem(CLAVE, new Date(Date.now() - 1000).toISOString());

    expect(adminService.tokenExpirado()).toBe(true);
  });

  it('sin expires_at guardado cuenta como vencido', () => {
    expect(adminService.tokenExpirado()).toBe(true);
  });

  it('un expires_at vacío cuenta como vencido', () => {
    localStorage.setItem(CLAVE, '');

    expect(adminService.tokenExpirado()).toBe(true);
  });

  it('un expires_at ilegible cuenta como vencido', () => {
    localStorage.setItem(CLAVE, 'no-es-una-fecha');

    expect(adminService.tokenExpirado()).toBe(true);
  });

  it('si localStorage tira, cuenta como vencido', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage deshabilitado');
    });

    try {
      expect(adminService.tokenExpirado()).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });
});

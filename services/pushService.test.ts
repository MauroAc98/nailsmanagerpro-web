import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import api from '@/lib/api';
import { pushService } from './pushService';

const mockedDelete = vi.mocked(api.delete);

beforeEach(() => vi.clearAllMocks());

describe('pushService.borrarSuscripcion', () => {
  it('sin token mantiene el comportamiento actual (el interceptor pone el header)', async () => {
    mockedDelete.mockResolvedValue({ data: {} });
    await pushService.borrarSuscripcion('https://push.example/a');
    expect(mockedDelete).toHaveBeenCalledWith('/push/subscriptions', { data: { endpoint: 'https://push.example/a' } });
  });

  it('con token lo manda explícito como Bearer (para usarlo tras limpiar localStorage)', async () => {
    mockedDelete.mockResolvedValue({ data: {} });
    await pushService.borrarSuscripcion('https://push.example/a', 'tok-1');
    expect(mockedDelete).toHaveBeenCalledWith('/push/subscriptions', {
      data: { endpoint: 'https://push.example/a' },
      headers: { Authorization: 'Bearer tok-1' },
    });
  });
});

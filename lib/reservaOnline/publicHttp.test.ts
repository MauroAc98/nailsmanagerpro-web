import { describe, expect, it } from 'vitest';
import { crearPublicHttp } from './publicHttp';

describe('crearPublicHttp', () => {
  it('no envia Authorization aunque haya un token en localStorage', async () => {
    localStorage.setItem('auth_token', 'secreto');
    let headers: Record<string, unknown> = {};
    const http = crearPublicHttp({
      baseURL: 'https://api.test/api',
      adapter: async (config) => {
        headers = { ...config.headers };
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
      },
    });
    await http.get('/public/demo/info');
    expect(headers.Authorization).toBeUndefined();
    localStorage.removeItem('auth_token');
  });

  it('un 401 no dispara eventos de sesion (auth:session-revoked): solo rechaza', async () => {
    let evento = false;
    const escucha = () => {
      evento = true;
    };
    window.addEventListener('auth:session-revoked', escucha);
    const http = crearPublicHttp({
      baseURL: 'https://api.test/api',
      adapter: async (config) => {
        const err = Object.assign(new Error('401'), {
          isAxiosError: true,
          response: { status: 401, data: {}, headers: {}, config, statusText: 'Unauthorized' },
          config,
        });
        throw err;
      },
    });
    await expect(http.get('/public/demo/info')).rejects.toBeDefined();
    expect(evento).toBe(false);
    window.removeEventListener('auth:session-revoked', escucha);
  });
});

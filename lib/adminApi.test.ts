import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import adminApi from './adminApi';

const adapterOriginal = adminApi.defaults.adapter;

function responderCon(status: number) {
  adminApi.defaults.adapter = (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError('fallo', 'ERR_BAD_REQUEST', config, null, {
        status,
        statusText: '',
        data: {},
        headers: {},
        config,
      }),
    );
}

let escuchador: ReturnType<typeof vi.fn>;

beforeEach(() => {
  escuchador = vi.fn();
  window.addEventListener('admin-session-expired', escuchador);
});

afterEach(() => {
  window.removeEventListener('admin-session-expired', escuchador);
  adminApi.defaults.adapter = adapterOriginal;
});

describe('adminApi — evento admin-session-expired', () => {
  it('un 401 en un request admin cualquiera dispara el evento', async () => {
    responderCon(401);

    await expect(adminApi.get('/admin/me')).rejects.toBeInstanceOf(AxiosError);

    expect(escuchador).toHaveBeenCalledTimes(1);
  });

  it('el 401 del propio login (password incorrecta) NO dispara el evento', async () => {
    responderCon(401);

    await expect(adminApi.post('/admin/login', { email: 'a@b.c', password: 'mal' })).rejects.toBeInstanceOf(AxiosError);

    expect(escuchador).not.toHaveBeenCalled();
  });

  it('tampoco con barra final o query en la URL del login', async () => {
    responderCon(401);

    await expect(adminApi.post('/admin/login/')).rejects.toBeInstanceOf(AxiosError);
    await expect(adminApi.post('/admin/login?x=1')).rejects.toBeInstanceOf(AxiosError);

    expect(escuchador).not.toHaveBeenCalled();
  });

  it('un 401 en /admin/logout sí dispara el evento (no se confunde con el login)', async () => {
    responderCon(401);

    await expect(adminApi.post('/admin/logout')).rejects.toBeInstanceOf(AxiosError);

    expect(escuchador).toHaveBeenCalledTimes(1);
  });

  it('un error que no es 401 no dispara el evento', async () => {
    responderCon(500);

    await expect(adminApi.get('/admin/me')).rejects.toBeInstanceOf(AxiosError);

    expect(escuchador).not.toHaveBeenCalled();
  });
});

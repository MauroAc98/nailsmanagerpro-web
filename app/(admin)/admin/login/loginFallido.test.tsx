import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { vi } from 'vitest';
import { resetNavigationMock, setMockLocation } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

import adminApi from '@/lib/adminApi';
import AdminLayout from '../layout';
import AdminLoginPage from './page';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';

// Integración real: layout + login + store + adminService + adminApi (solo el
// transporte HTTP es falso). Un 401 por password incorrecta es un error de
// credenciales, no una sesión vencida: el modal "Tu sesión expiró" no debe
// aparecer encima del formulario de login.
const adapterOriginal = adminApi.defaults.adapter;

beforeEach(() => {
  localStorage.clear();
  resetNavigationMock();
  useAdminAuthStore.setState({
    admin: null,
    token: null,
    loading: false,
    error: null,
    inicializado: false,
    reautenticacionRequerida: false,
  });
  adminApi.defaults.adapter = (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError('401', 'ERR_BAD_REQUEST', config, null, {
        status: 401,
        statusText: '',
        data: { message: 'Credenciales incorrectas' },
        headers: {},
        config,
      }),
    );
});

afterEach(() => {
  adminApi.defaults.adapter = adapterOriginal;
});

describe('Login admin con password incorrecta', () => {
  it('muestra "credenciales incorrectas" y nunca el modal de sesión expirada', async () => {
    setMockLocation('/login');
    render(
      <AdminLayout>
        <AdminLoginPage />
      </AdminLayout>,
    );

    fireEvent.change(await screen.findByPlaceholderText('admin@turnetto.app'), { target: { value: 'admin@turnetto.app' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'mal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Credenciales incorrectas')).toBeInTheDocument();
    await waitFor(() => expect(useAdminAuthStore.getState().loading).toBe(false));
    expect(useAdminAuthStore.getState().reautenticacionRequerida).toBe(false);
    expect(screen.queryByText('Tu sesión expiró')).toBeNull();
  });
});

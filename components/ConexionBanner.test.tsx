import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { es } from '@/messages';
import { initConexion, marcarConectado, useConexionStore } from '@/store/useConexionStore';
import { ConexionBanner } from './ConexionBanner';

const renderBanner = () =>
  render(
    <NextIntlClientProvider locale="es" messages={es}>
      <ConexionBanner />
    </NextIntlClientProvider>,
  );

describe('ConexionBanner', () => {
  beforeEach(() => useConexionStore.setState({ conectado: true }));

  it('no muestra nada con conexión', () => {
    renderBanner();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('reacciona al evento que emite el interceptor de la API', () => {
    initConexion();
    renderBanner();
    act(() => { window.dispatchEvent(new CustomEvent('app:conexion', { detail: { conectado: false } })); });
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => { window.dispatchEvent(new CustomEvent('app:conexion', { detail: { conectado: true } })); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('avisa al perder la conexión y se va al recuperarla', () => {
    renderBanner();
    act(() => marcarConectado(false));
    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión');
    act(() => marcarConectado(true));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/store/useAuthStore';
import type { User } from '@/services/authService';
import AvisoComisionSena from './AvisoComisionSena';

function setUser(parcial: Partial<User> | null) {
  useAuthStore.setState({
    user: parcial === null ? null : ({
      sena_tipo: 'porcentaje', sena_porcentaje: 30, sena_monto: null, reserva_online_activa: true,
      retencion_iibb_porcentaje: 0, comision_mp_vigente: 7.61, ...parcial,
    } as User),
  });
}

const TEXTO = /Mercado Pago se queda una parte de cada seña/;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
  window.sessionStorage.clear();
  setUser({});
});

describe('AvisoComisionSena', () => {
  it('shows the tip with a percentage deposit, a commission and online booking on', () => {
    renderWithProviders(<AvisoComisionSena />);
    expect(screen.getByText(TEXTO)).toBeInTheDocument();
  });

  it('says that adjusting the price is optional', () => {
    renderWithProviders(<AvisoComisionSena />);
    expect(screen.getByText(/Es opcional/)).toBeInTheDocument();
  });

  it('links straight to the first service so the owner does not have to hunt for the suggestion', () => {
    const onVer = vi.fn();
    renderWithProviders(<AvisoComisionSena primero={{ id: 7, nombre: 'Soft gel' }} onVer={onVer} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver cuánto es en Soft gel' }));
    expect(onVer).toHaveBeenCalledWith(7);
  });

  it('has no link when there is no service with a price to point to', () => {
    renderWithProviders(<AvisoComisionSena onVer={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Ver cuánto es en/ })).toBeNull();
  });

  it('does not show with a fixed deposit', () => {
    setUser({ sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: 5000 });
    renderWithProviders(<AvisoComisionSena />);
    expect(screen.queryByText(TEXTO)).toBeNull();
  });

  it('does not show without commission to cover or without the online booking add-on', () => {
    setUser({ comision_mp_vigente: 0 });
    const { unmount } = renderWithProviders(<AvisoComisionSena />);
    expect(screen.queryByText(TEXTO)).toBeNull();
    unmount();
    setUser({ reserva_online_activa: false });
    renderWithProviders(<AvisoComisionSena />);
    expect(screen.queryByText(TEXTO)).toBeNull();
  });

  it('closing it hides it for the session and it comes back in a new one', () => {
    const { unmount } = renderWithProviders(<AvisoComisionSena />);
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(screen.queryByText(TEXTO)).toBeNull();
    // Mismo recorrido de la sesión (entrar a un servicio y volver): sigue cerrado.
    unmount();
    const { unmount: unmount2 } = renderWithProviders(<AvisoComisionSena />);
    expect(screen.queryByText(TEXTO)).toBeNull();
    unmount2();
    // Sesión nueva (se vuelve a abrir la app): vuelve a aparecer.
    window.sessionStorage.clear();
    renderWithProviders(<AvisoComisionSena />);
    expect(screen.getByText(TEXTO)).toBeInTheDocument();
  });
});

afterEach(() => vi.unstubAllEnvs());

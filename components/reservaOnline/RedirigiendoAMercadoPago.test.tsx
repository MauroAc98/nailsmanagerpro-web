import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { RedirigiendoAMercadoPago } from './RedirigiendoAMercadoPago';

describe('RedirigiendoAMercadoPago', () => {
  it('muestra el aviso de que se está redirigiendo a Mercado Pago', () => {
    renderWithProviders(<RedirigiendoAMercadoPago />);
    expect(screen.getByRole('heading', { name: 'Te llevamos a Mercado Pago' })).toBeInTheDocument();
    expect(screen.getByText(/No cierres esta pantalla ni vuelvas atrás/)).toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/render';
import { LinkCompartir } from './LinkCompartir';

// El link y sus botones (Copiar, Enviar, Ver QR) se ven siempre: la pantalla
// que lo usa solo se abre con la reserva online ya activa. El modal se abre
// bajo demanda; el QR real se ejerce en QrLinkModal.test.tsx.
describe('LinkCompartir', () => {
  const url = 'https://reservar.turnetto.com/mi-salon';

  it('muestra el link y el boton Ver QR', () => {
    renderWithProviders(<LinkCompartir url={url} />);
    expect(screen.getByText('reservar.turnetto.com/mi-salon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver QR' })).toBeInTheDocument();
  });

  it('clickear Ver QR abre el modal con el QR generado', async () => {
    renderWithProviders(<LinkCompartir url={url} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver QR' }));
    const img = await screen.findByRole('img');
    expect(img.getAttribute('src')).toMatch(/^data:image\//);
  });

  it('cerrar el modal (boton) lo desmonta', async () => {
    renderWithProviders(<LinkCompartir url={url} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver QR' }));
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('img')).toBeNull();
  });
});

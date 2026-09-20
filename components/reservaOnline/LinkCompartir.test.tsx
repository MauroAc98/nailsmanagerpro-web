import { describe, expect, it } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/render';
import { LinkCompartir } from './LinkCompartir';

// El boton "Ver QR" se comporta igual que Copiar/Enviar: solo aparece cuando
// `habilitado` (reservas activas + Mercado Pago conectado, decision S12). El
// modal se abre bajo demanda; el QR real se ejerce en QrLinkModal.test.tsx.
describe('LinkCompartir', () => {
  const url = 'https://reservar.turnetto.com/mi-salon';

  it('con habilitado muestra el boton Ver QR', () => {
    renderWithProviders(<LinkCompartir url={url} habilitado />);
    expect(screen.getByRole('button', { name: 'Ver QR' })).toBeInTheDocument();
  });

  it('sin habilitado no muestra el boton Ver QR', () => {
    renderWithProviders(<LinkCompartir url={url} habilitado={false} />);
    expect(screen.queryByRole('button', { name: 'Ver QR' })).toBeNull();
  });

  it('clickear Ver QR abre el modal con el QR generado', async () => {
    renderWithProviders(<LinkCompartir url={url} habilitado />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver QR' }));
    const img = await screen.findByRole('img');
    expect(img.getAttribute('src')).toMatch(/^data:image\//);
  });

  it('cerrar el modal (boton) lo desmonta', async () => {
    renderWithProviders(<LinkCompartir url={url} habilitado />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver QR' }));
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('img')).toBeNull();
  });
});

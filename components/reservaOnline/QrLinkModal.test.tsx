import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/render';
import { QrLinkModal } from './QrLinkModal';

// Sin mockear `qrcode`: se espera su salida real. Para el caso de error se
// usa un link deliberadamente demasiado largo para caber en un QR (la
// libreria rechaza la promesa de verdad con "amount of data is too big"),
// en vez de simular una falla.
describe('QrLinkModal', () => {
  const url = 'https://reservar.turnetto.com/mi-salon';
  const urlDemasiadoLarga = `https://reservar.turnetto.com/${'a'.repeat(5000)}`;

  it('genera y muestra el QR como imagen', async () => {
    renderWithProviders(<QrLinkModal url={url} onClose={() => {}} />);
    const img = await screen.findByRole('img');
    expect(img.getAttribute('src')).toMatch(/^data:image\//);
  });

  it('el boton Descargar apunta a la imagen generada con atributo download', async () => {
    renderWithProviders(<QrLinkModal url={url} onClose={() => {}} />);
    await screen.findByRole('img');
    const link = screen.getByRole('link', { name: 'Descargar' });
    expect(link).toHaveAttribute('download');
    expect(link.getAttribute('href')).toMatch(/^data:image\//);
  });

  // El nombre del archivo usa el slug del salon (ultimo segmento del link),
  // no un nombre generico — cada duena descarga SU QR, identificable.
  it('el nombre del archivo descargado usa el slug del salon', async () => {
    renderWithProviders(<QrLinkModal url={url} onClose={() => {}} />);
    await screen.findByRole('img');
    const link = screen.getByRole('link', { name: 'Descargar' });
    expect(link).toHaveAttribute('download', 'reserva-mi-salon.png');
  });

  it('el boton cerrar llama a onClose', async () => {
    const onClose = vi.fn();
    renderWithProviders(<QrLinkModal url={url} onClose={onClose} />);
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tocar el fondo tambien cierra', async () => {
    const onClose = vi.fn();
    const { container } = renderWithProviders(<QrLinkModal url={url} onClose={onClose} />);
    await screen.findByRole('img');
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mientras genera muestra un estado de carga', () => {
    renderWithProviders(<QrLinkModal url={url} onClose={() => {}} />);
    expect(screen.getByText('Generando código…')).toBeInTheDocument();
  });

  it('si la generacion falla (real) muestra error con boton reintentar', async () => {
    renderWithProviders(<QrLinkModal url={urlDemasiadoLarga} onClose={() => {}} />);
    expect(await screen.findByText('No pudimos generar el código.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('reintentar vuelve a mostrar el estado de carga', async () => {
    renderWithProviders(<QrLinkModal url={urlDemasiadoLarga} onClose={() => {}} />);
    await screen.findByText('No pudimos generar el código.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByText('Generando código…')).toBeInTheDocument();
    // Deja que el segundo intento (tambien real, tambien va a fallar por el
    // mismo link demasiado largo) resuelva dentro de act() antes de terminar
    // el test, para no dejar una actualizacion de estado colgada.
    await screen.findByText('No pudimos generar el código.');
  });
});

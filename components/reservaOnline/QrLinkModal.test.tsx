import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/render';
import { QrLinkModal } from './QrLinkModal';

// navigator.share/canShare no existen en jsdom: se agregan/quitan por test
// para simular soporte (mobile real) o su ausencia (desktop).
function simularWebShare(canShareDevuelve: boolean, shareImpl: (data: ShareData) => Promise<void> = async () => {}) {
  const share = vi.fn(shareImpl);
  const canShare = vi.fn<(data: ShareData) => boolean>(() => canShareDevuelve);
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true });
  return { share, canShare };
}

function quitarWebShare() {
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'canShare');
}

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

  describe('compartir', () => {
    afterEach(() => quitarWebShare());

    it('con Web Share API disponible, comparte el QR como archivo PNG', async () => {
      const { share, canShare } = simularWebShare(true);
      renderWithProviders(<QrLinkModal url={url} onClose={() => {}} />);
      await screen.findByRole('img');
      fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));
      await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
      const [{ files }] = canShare.mock.calls[0] as [{ files: File[] }];
      expect(files[0].name).toBe('reserva-mi-salon.png');
      expect(files[0].type).toBe('image/png');
    });

    it('si el navegador no soporta compartir archivos, cae a la descarga', async () => {
      simularWebShare(false);
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      renderWithProviders(<QrLinkModal url={url} onClose={() => {}} />);
      await screen.findByRole('img');
      fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));
      await vi.waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
      clickSpy.mockRestore();
    });

    it('sin Web Share API en absoluto (desktop), tambien cae a la descarga', async () => {
      quitarWebShare();
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      renderWithProviders(<QrLinkModal url={url} onClose={() => {}} />);
      await screen.findByRole('img');
      fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));
      await vi.waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
      clickSpy.mockRestore();
    });

    it('cancelar la hoja nativa (AbortError) no muestra ningun error', async () => {
      const abortError = Object.assign(new Error('cancelado'), { name: 'AbortError' });
      simularWebShare(true, () => Promise.reject(abortError));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderWithProviders(<QrLinkModal url={url} onClose={() => {}} />);
      await screen.findByRole('img');
      fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));
      await vi.waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

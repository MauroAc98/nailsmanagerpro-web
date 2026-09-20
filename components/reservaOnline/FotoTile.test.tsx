import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { FotoTile } from './FotoTile';

describe('FotoTile', () => {
  it('una url real se dibuja como imagen', () => {
    const { container } = renderWithProviders(<FotoTile src="https://cdn.test/a.jpg" />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/a.jpg');
  });

  it('un data URL (foto subida en el mock) tambien es imagen', () => {
    const { container } = renderWithProviders(<FotoTile src="data:image/jpeg;base64,AAAA" />);
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('un placeholder es una baldosa de gradiente, sin imagen ni request', () => {
    const { container } = renderWithProviders(<FotoTile src="placeholder:2" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('data-placeholder', '2');
  });

  it('por defecto la imagen real rellena con object-fit cover', () => {
    const { container } = renderWithProviders(<FotoTile src="https://cdn.test/a.jpg" />);
    expect(container.querySelector('img')).toHaveStyle({ objectFit: 'cover' });
  });

  it('objectFit permite pedir "contain" (visor a pantalla completa: no recortar la foto)', () => {
    const { container } = renderWithProviders(<FotoTile src="https://cdn.test/a.jpg" objectFit="contain" />);
    expect(container.querySelector('img')).toHaveStyle({ objectFit: 'contain' });
  });
});

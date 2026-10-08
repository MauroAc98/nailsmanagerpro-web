import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BootSplash } from './BootSplash';

describe('BootSplash', () => {
  it('muestra el logo transparente de la marca, no el ícono cuadrado con fondo blanco', () => {
    render(<BootSplash />);
    const logo = screen.getByTestId('boot-splash').querySelector('img');

    expect(logo?.getAttribute('src')).toContain(encodeURIComponent('/logo-turnetto.png'));
    expect(logo?.getAttribute('src')).not.toContain('icon-192');
  });

  it('el fondo es el de la superficie del tema (hueso en claro, oscuro en oscuro), igual que el splash nativo', () => {
    render(<BootSplash />);

    expect(screen.getByTestId('boot-splash').style.backgroundColor).toBe('var(--color-surface)');
  });

  it('el logo no lleva un recuadro propio: no hay fondo ni borde redondeado que se vea sobre el tema', () => {
    render(<BootSplash />);
    const logo = screen.getByTestId('boot-splash').querySelector('img') as HTMLImageElement;

    expect(logo.style.borderRadius).toBe('');
    expect(logo.style.backgroundColor).toBe('');
  });
});

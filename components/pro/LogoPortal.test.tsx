import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { LogoPortal } from './LogoPortal';

describe('LogoPortal', () => {
  it('muestra el logo real del portal con texto alternativo y tamaño fijo', () => {
    renderWithProviders(<LogoPortal />);
    const img = screen.getByRole('img', { name: 'Turnetto, portal de profesionales' });
    expect(img.getAttribute('src')).toContain('pro-logo.png');
    expect(img).toHaveAttribute('width', '96');
    expect(img).toHaveAttribute('height', '96');
  });
});

import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { BadgeEstadoWhatsapp } from './BadgeEstadoWhatsapp';

describe('BadgeEstadoWhatsapp', () => {
  it.each([
    ['pending', 'Enviado'],
    ['manual', 'Enviado'],
    ['delivered', 'Entregado'],
    ['read', 'Leído'],
    ['failed', 'No se pudo enviar'],
  ])('%s se anuncia como "%s"', (status, etiqueta) => {
    renderWithProviders(<BadgeEstadoWhatsapp status={status} />);

    expect(screen.getByRole('img', { name: etiqueta })).toBeInTheDocument();
  });

  it('se distingue por la forma: una tilde, dos tildes o exclamacion', () => {
    const forma = (status: string) => {
      const { container, unmount } = renderWithProviders(<BadgeEstadoWhatsapp status={status} />);
      const html = container.querySelector('svg')!.innerHTML;
      unmount();
      return html;
    };

    expect(new Set([forma('pending'), forma('delivered'), forma('failed')]).size).toBe(3);
    expect(forma('delivered')).toBe(forma('read'));
  });

  it('no captura toques, para no tapar el enlace de WhatsApp', () => {
    renderWithProviders(<BadgeEstadoWhatsapp status="read" />);

    expect(screen.getByRole('img', { name: 'Leído' })).toHaveStyle({ pointerEvents: 'none' });
  });

  it.each([[null], [undefined], ['algo raro']])('no muestra nada con %s', (status) => {
    const { container } = renderWithProviders(<BadgeEstadoWhatsapp status={status} />);

    expect(container).toBeEmptyDOMElement();
  });
});

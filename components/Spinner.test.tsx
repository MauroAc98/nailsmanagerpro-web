import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Colores planos: jsdom no resuelve los var(--…) de los tokens reales.
vi.mock('@/theme/agendaColors', () => ({ agendaColors: { border: '#111111', primaryDeep: '#222222' } }));
vi.mock('@/theme/colors', () => ({ colors: { border: '#333333', primaryDeep: '#444444' } }));

import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('con etiqueta se anuncia como estado de carga para lectores de pantalla', () => {
    render(<Spinner label="Cargando clientes" />);
    const spinner = screen.getByRole('status', { name: 'Cargando clientes' });
    expect(spinner).toHaveClass('loader-spinner');
  });

  it('sin etiqueta es decorativo: no aparece como estado', () => {
    const { container } = render(<Spinner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild).toHaveClass('loader-spinner');
  });

  it('es un círculo del tamaño pedido (32 por defecto)', () => {
    const { container, rerender } = render(<Spinner />);
    expect(container.firstElementChild).toHaveStyle({ width: '32px', height: '32px', borderRadius: '16px' });
    rerender(<Spinner size={20} />);
    expect(container.firstElementChild).toHaveStyle({ width: '20px', height: '20px', borderRadius: '10px' });
  });

  it('el grosor del aro crece con el tamaño', () => {
    const grosor = (size: number) => {
      const { container, unmount } = render(<Spinner size={size} />);
      const ancho = (container.firstElementChild as HTMLElement).style.borderWidth;
      unmount();
      return ancho;
    };
    expect(grosor(18)).toBe('2px');
    expect(grosor(20)).toBe('2px');
    expect(grosor(22)).toBe('3px');
    expect(grosor(32)).toBe('3px');
    expect(grosor(40)).toBe('4px');
    expect(grosor(44)).toBe('4px');
  });

  it('sobre fondo oscuro el aro es blanco translúcido con la punta blanca', () => {
    const { container } = render(<Spinner variante="sobreOscuro" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.borderColor).toBe('rgba(255, 255, 255, 0.4)');
    expect(el.style.borderTopColor).toBe('rgb(255, 255, 255)');
  });

  it('cada variante usa su paleta: agenda por defecto, base fuera del scope de Agenda', () => {
    const colores = (variante?: 'agenda' | 'base') => {
      const { container, unmount } = render(<Spinner variante={variante} />);
      const el = container.firstElementChild as HTMLElement;
      const par = [el.style.borderColor, el.style.borderTopColor];
      unmount();
      return par;
    };
    expect(colores()).toEqual(['rgb(17, 17, 17)', 'rgb(34, 34, 34)']);
    expect(colores('agenda')).toEqual(['rgb(17, 17, 17)', 'rgb(34, 34, 34)']);
    expect(colores('base')).toEqual(['rgb(51, 51, 51)', 'rgb(68, 68, 68)']);
  });
});

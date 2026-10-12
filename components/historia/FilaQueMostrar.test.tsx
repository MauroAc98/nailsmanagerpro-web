import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { agendaColors as colors } from '@/theme/agendaColors';
import { FilaQueMostrar } from './FilaQueMostrar';

function setup(over: Partial<React.ComponentProps<typeof FilaQueMostrar>> = {}) {
  const props = {
    leading: <span data-testid="leading" />, titulo: 'Profesional', valor: 'Caro', activo: false,
    onClick: vi.fn(), ...over,
  };
  render(<FilaQueMostrar {...props} />);
  return props;
}

describe('FilaQueMostrar', () => {
  it('muestra el título, el valor y el visual de la izquierda', () => {
    setup();
    expect(screen.getByText('Profesional')).toBeInTheDocument();
    expect(screen.getByText('Caro')).toBeInTheDocument();
    expect(screen.getByTestId('leading')).toBeInTheDocument();
  });

  it('el valor va en el color primario con filtro activo y apagado sin filtro', () => {
    setup({ activo: true });
    expect(screen.getByText('Caro')).toHaveStyle({ color: colors.primary });
  });

  it('el valor va apagado cuando no hay filtro', () => {
    setup({ activo: false });
    expect(screen.getByText('Caro')).toHaveStyle({ color: colors.muted });
  });

  it('es un botón con aria-label "título: valor" y avisa el click', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Profesional: Caro' }));
    expect(props.onClick).toHaveBeenCalledTimes(1);
  });
});

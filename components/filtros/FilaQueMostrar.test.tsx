import { createRef } from 'react';
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

  it('por defecto no anuncia un diálogo ni cambia el nombre accesible', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Profesional: Caro' })).not.toHaveAttribute('aria-haspopup');
  });

  it('ariaLabel reemplaza el nombre accesible y abreDialogo anuncia el diálogo', () => {
    setup({ ariaLabel: 'Cambiar de negocio. Ahora: Caro', abreDialogo: true });
    expect(screen.getByRole('button', { name: 'Cambiar de negocio. Ahora: Caro' })).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('el ref recibido apunta al botón (para devolverle el foco)', () => {
    const ref = createRef<HTMLButtonElement>();
    setup({ ref });
    expect(ref.current).toBe(screen.getByRole('button'));
  });
});

describe('FilaQueMostrar (identidad con main)', () => {
  it('sin props opcionales renderiza igual que en main', () => {
    setup();
    const boton = screen.getByRole('button', { name: 'Profesional: Caro' });
    expect(boton).toHaveAttribute('type', 'button');
    expect(boton).not.toHaveAttribute('aria-haspopup');
    expect(boton.getAttributeNames().sort()).toEqual(['aria-label', 'style', 'type']);
  });
});

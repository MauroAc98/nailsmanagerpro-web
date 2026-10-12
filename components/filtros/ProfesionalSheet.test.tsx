import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/render';
import { ProfesionalSheet } from './ProfesionalSheet';

const profesionales = [
  { id: 1, nombre: 'Caro', apellido: null, color: '#C00', avatarUrl: null, subtitulo: 'Uñas' },
  { id: 2, nombre: 'Lau', apellido: 'Paz', color: null, avatarUrl: 'https://x/y.png' },
];

function setup(over: Partial<React.ComponentProps<typeof ProfesionalSheet<string>>> = {}) {
  const props = {
    open: true, onClose: vi.fn(), onSelect: vi.fn(), title: 'Profesional',
    equipoLabel: 'Todo el equipo', equipoSubtitulo: 'Junta los horarios libres de todas',
    cerrarLabel: 'Cerrar', profesionales, selectedId: 1 as number | string, ...over,
  };
  renderWithProviders(<ProfesionalSheet {...props} />);
  return props;
}

describe('ProfesionalSheet', () => {
  it('no renderiza nada cerrada', () => {
    setup({ open: false });
    expect(screen.queryByText('Todo el equipo')).toBeNull();
  });

  it('lista "Todo el equipo" primero y después cada profesional', () => {
    setup();
    const filas = screen.getAllByRole('option');
    expect(filas.map(f => f.textContent)).toEqual([
      expect.stringContaining('Todo el equipo'), expect.stringContaining('Caro'), expect.stringContaining('Lau'),
    ]);
    expect(screen.getByText('Junta los horarios libres de todas')).toBeInTheDocument();
    expect(screen.getByText('Uñas')).toBeInTheDocument();
  });

  it('marca con check solo la fila seleccionada', () => {
    setup({ selectedId: 2 });
    const filas = screen.getAllByRole('option');
    expect(filas.map(f => f.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
    expect(filas[2].querySelector('svg.lucide-check')).not.toBeNull();
    expect(filas[1].querySelector('svg.lucide-check')).toBeNull();
  });

  it('marca "Todo el equipo" cuando la selección es equipo', () => {
    setup({ selectedId: 'equipo' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('tocar una profesional llama onSelect con su id y cierra', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('option', { name: /Lau/ }));
    expect(props.onSelect).toHaveBeenCalledWith(2);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('tocar "Todo el equipo" llama onSelect con "equipo" y cierra', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('option', { name: /Todo el equipo/ }));
    expect(props.onSelect).toHaveBeenCalledWith('equipo');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('sin equipoLabel no muestra la fila "Todo el equipo"', () => {
    setup({ equipoLabel: undefined, equipoSubtitulo: undefined });
    const filas = screen.getAllByRole('option');
    expect(filas.map(f => f.textContent)).toEqual([
      expect.stringContaining('Caro'), expect.stringContaining('Lau'),
    ]);
    expect(screen.queryByText('Todo el equipo')).toBeNull();
  });

  describe('extras', () => {
    const extras = [{ id: 'negocio', label: 'Del negocio', subtitulo: 'Gastos del salón', icono: <span data-testid="icono-negocio" /> }];

    it('se muestran después de la fila de equipo y antes de las profesionales', () => {
      setup({ extras });
      const filas = screen.getAllByRole('option');
      expect(filas.map(f => f.textContent)).toEqual([
        expect.stringContaining('Todo el equipo'), expect.stringContaining('Del negocio'),
        expect.stringContaining('Caro'), expect.stringContaining('Lau'),
      ]);
      expect(screen.getByText('Gastos del salón')).toBeInTheDocument();
      expect(screen.getByTestId('icono-negocio')).toBeInTheDocument();
    });

    it('sin equipoLabel el extra va primero', () => {
      setup({ extras, equipoLabel: undefined, equipoSubtitulo: undefined });
      expect(screen.getAllByRole('option')[0].textContent).toContain('Del negocio');
    });

    it('marca con check el extra seleccionado', () => {
      setup({ extras, selectedId: 'negocio' });
      const filas = screen.getAllByRole('option');
      expect(filas.map(f => f.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false']);
      expect(filas[1].querySelector('svg.lucide-check')).not.toBeNull();
    });

    it('tocar un extra llama onSelect con su id y cierra', () => {
      const props = setup({ extras });
      fireEvent.click(screen.getByRole('option', { name: /Del negocio/ }));
      expect(props.onSelect).toHaveBeenCalledWith('negocio');
      expect(props.onClose).toHaveBeenCalled();
    });
  });

  it('Cerrar cierra sin seleccionar', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});

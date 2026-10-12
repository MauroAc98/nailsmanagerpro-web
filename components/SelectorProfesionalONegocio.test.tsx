import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';
import SelectorProfesionalONegocio from './SelectorProfesionalONegocio';
import type { Profesional } from '@/services/profesionalService';

const profs = [
  { id: 1, nombre: 'Ana', apellido: 'Paz', color: '#ff0000', avatar_url: null, activo: true },
  { id: 2, nombre: 'Bea', apellido: null, color: '#00ff00', avatar_url: null, activo: true },
] as unknown as Profesional[];

const setup = (value: number | null, onChange = vi.fn()) => {
  renderWithProviders(<SelectorProfesionalONegocio profesionales={profs} value={value} onChange={onChange} labelNegocio="Del negocio" />);
  return onChange;
};

const abrir = () => fireEvent.click(screen.getByRole('button', { name: /^Profesional:/ }));

describe('SelectorProfesionalONegocio', () => {
  it('la fila muestra "Del negocio" cuando value es null', () => {
    setup(null);
    expect(screen.getByRole('button', { name: 'Profesional: Del negocio' })).toBeInTheDocument();
  });

  it('la fila muestra el nombre de la profesional elegida', () => {
    setup(1);
    expect(screen.getByRole('button', { name: 'Profesional: Ana' })).toBeInTheDocument();
  });

  it('la hoja lista "Del negocio" primero y después cada profesional', () => {
    setup(1);
    abrir();
    const filas = screen.getAllByRole('option');
    expect(filas.map(f => f.textContent)).toEqual([
      expect.stringContaining('Del negocio'), expect.stringContaining('Ana'), expect.stringContaining('Bea'),
    ]);
  });

  it('elegir "Del negocio" avisa null', () => {
    const onChange = setup(1);
    abrir();
    fireEvent.click(screen.getByRole('option', { name: /Del negocio/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('elegir una profesional avisa su id', () => {
    const onChange = setup(null);
    abrir();
    fireEvent.click(screen.getByRole('option', { name: /Bea/ }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('elegir la ya elegida no avisa nada', () => {
    const onChange = setup(1);
    abrir();
    fireEvent.click(screen.getByRole('option', { name: /Ana/ }));
    expect(onChange).not.toHaveBeenCalled();

    const onChange2 = setup(null);
    fireEvent.click(screen.getAllByRole('button', { name: /^Profesional:/ })[1]);
    fireEvent.click(screen.getByRole('option', { name: /Del negocio/ }));
    expect(onChange2).not.toHaveBeenCalled();
  });

  it('marca como seleccionada solo la elegida', () => {
    setup(null);
    abrir();
    const filas = screen.getAllByRole('option');
    expect(filas.map(f => f.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SelectorProfesionalONegocio from './SelectorProfesionalONegocio';
import type { Profesional } from '@/services/profesionalService';

const profs = [
  { id: 1, nombre: 'Ana', apellido: 'Paz', color: '#ff0000', avatar_url: null, activo: true },
  { id: 2, nombre: 'Bea', apellido: null, color: '#00ff00', avatar_url: null, activo: true },
] as unknown as Profesional[];

const setup = (value: number | null, onChange = vi.fn()) => {
  render(<SelectorProfesionalONegocio profesionales={profs} value={value} onChange={onChange} labelNegocio="Del negocio" />);
  return onChange;
};

describe('SelectorProfesionalONegocio', () => {
  it('renderiza "Del negocio" primero', () => {
    setup(1);
    const botones = screen.getAllByRole('button');
    expect(botones[0]).toHaveTextContent('Del negocio');
    expect(botones).toHaveLength(3);
  });

  it('tocar "Del negocio" avisa null', () => {
    const onChange = setup(1);
    fireEvent.click(screen.getByRole('button', { name: /Del negocio/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('tocar una profesional avisa su id', () => {
    const onChange = setup(null);
    fireEvent.click(screen.getByRole('button', { name: /Bea/ }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('tocar la ya elegida no deselecciona', () => {
    const onChange = setup(1);
    fireEvent.click(screen.getByRole('button', { name: /Ana/ }));
    expect(onChange).not.toHaveBeenCalledWith(null);
    expect(onChange.mock.calls.every(c => c[0] === 1)).toBe(true);

    const onChange2 = setup(null);
    fireEvent.click(screen.getAllByRole('button', { name: /Del negocio/ })[1]);
    expect(onChange2.mock.calls.every(c => c[0] === null)).toBe(true);
  });

  it('marca aria-pressed solo en la elegida', () => {
    setup(null);
    expect(screen.getByRole('button', { name: /Del negocio/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Ana/ })).toHaveAttribute('aria-pressed', 'false');
  });
});

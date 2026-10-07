import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FiltroPills } from './FiltroPills';

const options = [
  { value: 'todos', label: 'Todos' },
  { value: 'activos', label: 'Activos' },
  { value: 'inactivos', label: 'Inactivos' },
] as const;

describe('FiltroPills', () => {
  it('marca solo la opcion elegida', () => {
    render(<FiltroPills options={options} value="activos" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Activos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Inactivos' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('avisa el valor de la opcion tocada', () => {
    const onChange = vi.fn();
    render(<FiltroPills options={options} value="todos" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Inactivos' }));

    expect(onChange).toHaveBeenCalledWith('inactivos');
  });

  it('con ariaLabel expone el grupo con ese nombre', () => {
    render(<FiltroPills options={options} value="todos" onChange={vi.fn()} ariaLabel="Filtrar por estado" />);

    expect(screen.getByRole('group', { name: 'Filtrar por estado' })).toBeInTheDocument();
  });

  it('las opciones son botones de tipo button (no envian formularios)', () => {
    render(<FiltroPills options={options} value="todos" onChange={vi.fn()} />);

    for (const b of screen.getAllByRole('button')) expect(b).toHaveAttribute('type', 'button');
  });
});

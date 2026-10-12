import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Clock, Type } from 'lucide-react';
import { BarraHerramientas } from './BarraHerramientas';

describe('BarraHerramientas', () => {
  const items = [
    { id: 'a', icono: Clock, label: 'Horarios' },
    { id: 'b', icono: Type, label: 'Texto' },
  ];

  it('renders labels and marks the active one', () => {
    render(<BarraHerramientas items={items} activo="b" onChange={() => {}} />);
    expect(screen.getByText('Horarios')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Texto' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Horarios' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onChange with the item id', () => {
    const onChange = vi.fn();
    render(<BarraHerramientas items={items} activo="b" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Horarios' }));
    expect(onChange).toHaveBeenCalledWith('a');
  });
});

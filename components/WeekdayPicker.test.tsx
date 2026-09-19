import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import WeekdayPicker from './WeekdayPicker';

describe('WeekdayPicker', () => {
  it('renderiza 7 chips en orden lunes→domingo con las iniciales localizadas', () => {
    renderWithProviders(<WeekdayPicker value={[]} onChange={vi.fn()} />);
    // Orden de aparición: L M M J V S D (lunes primero, domingo al final) —
    // el backend usa 0=domingo..6=sábado, pero la UI se muestra lunes-primero.
    const chips = screen.getAllByRole('button');
    expect(chips).toHaveLength(7);
    expect(chips.map(c => c.textContent)).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
  });

  it('tocar un día no seleccionado lo agrega al value (convención 0=domingo..6=sábado)', () => {
    const onChange = vi.fn();
    renderWithProviders(<WeekdayPicker value={[1, 2]} onChange={onChange} />);
    // Cuarto chip visible = jueves = 4
    screen.getAllByRole('button')[3].click();
    expect(onChange).toHaveBeenCalledWith([1, 2, 4]);
  });

  it('tocar el último día seleccionado lo quita, incluso si deja el array vacío', () => {
    const onChange = vi.fn();
    renderWithProviders(<WeekdayPicker value={[0]} onChange={onChange} />);
    // Domingo es el último chip visible (orden lunes-primero) y value=[0] → domingo.
    screen.getAllByRole('button')[6].click();
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

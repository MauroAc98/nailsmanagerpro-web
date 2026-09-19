import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { NoDisponibleAun } from './NoDisponibleAun';

describe('NoDisponibleAun', () => {
  it('muestra el titulo y el detalle de "no disponible todavia"', () => {
    renderWithProviders(<NoDisponibleAun />);
    expect(screen.getByRole('heading', { name: 'Todavía no está disponible' })).toBeInTheDocument();
    expect(screen.getByText(/La reserva online no está disponible en este momento/)).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import type { TurnoMes } from '@/services/turnoService';
import { WeekStrip, getCurrentWeekDates } from './WeekStrip';

// ─────────────────────────────────────────────
// getCurrentWeekDates — pure, Monday-start (same convention as
// CalendarioMensual's own firstDayOfMonth math in app/(app)/agenda/page.tsx).
// ─────────────────────────────────────────────
describe('getCurrentWeekDates', () => {
  it('returns 7 consecutive days starting on Monday', () => {
    // 2026-09-17 is a Thursday.
    const jueves = new Date(2026, 8, 17);
    const dias = getCurrentWeekDates(jueves);
    expect(dias).toHaveLength(7);
    expect(dias[0].getDay()).toBe(1); // Monday
    expect(dias[6].getDay()).toBe(0); // Sunday
    expect(dias[0].getDate()).toBe(14);
    expect(dias[6].getDate()).toBe(20);
  });

  it('keeps Monday itself as the first day when "today" is a Monday', () => {
    const lunes = new Date(2026, 8, 14);
    const dias = getCurrentWeekDates(lunes);
    expect(dias[0].getDate()).toBe(14);
  });
});

// ─────────────────────────────────────────────
// WeekStrip
// ─────────────────────────────────────────────
function fecha(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

describe('WeekStrip', () => {
  const dates = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 14 + i));
  const turnosMes: TurnoMes[] = [{ fecha: fecha(2026, 9, 16), cantidad: 3 }];

  function setup(overrides: Partial<Parameters<typeof WeekStrip>[0]> = {}) {
    const onDayClick = vi.fn();
    const onAbrirCalendario = vi.fn();
    renderWithProviders(
      <WeekStrip
        dates={dates}
        fechaSeleccionada={fecha(2026, 9, 14)}
        turnosMes={turnosMes}
        onDayClick={onDayClick}
        onAbrirCalendario={onAbrirCalendario}
        {...overrides}
      />,
    );
    return { onDayClick, onAbrirCalendario };
  }

  it('renders one cell per day of the week and the "Elegir fecha" action', () => {
    setup();
    expect(screen.getByText('Esta semana')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Elegir fecha/ })).toBeInTheDocument();
    for (let d = 14; d <= 20; d++) {
      expect(screen.getByTestId(`week-day-${fecha(2026, 9, d)}`)).toBeInTheDocument();
    }
  });

  it('calls onDayClick with the clicked day\'s date string', () => {
    const { onDayClick } = setup();
    fireEvent.click(screen.getByTestId(`week-day-${fecha(2026, 9, 16)}`));
    expect(onDayClick).toHaveBeenCalledWith(fecha(2026, 9, 16));
  });

  it('opens the full calendar sheet via onAbrirCalendario', () => {
    const { onAbrirCalendario } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Elegir fecha/ }));
    expect(onAbrirCalendario).toHaveBeenCalledTimes(1);
  });
});

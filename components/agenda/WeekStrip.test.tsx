import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('renders the "Semana" eyebrow + the real date range (not a bare month/year) and the calendar icon-button', () => {
    setup();
    // Rango real de la semana (14-20 de sept) en vez de "Septiembre 2026" —
    // el mes suelto no representaba lo que la tira realmente muestra (7
    // días puntuales, no un mes completo). El botón "Elegir fecha" pasa a
    // ser un ícono con aria-label, no texto visible, para no competir con
    // el rango de fechas como si fueran dos labels del mismo tipo.
    expect(screen.getByText('Semana')).toBeInTheDocument();
    expect(screen.getByText('14 – 20 de septiembre')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir fecha' })).toBeInTheDocument();
    for (let d = 14; d <= 20; d++) {
      expect(screen.getByTestId(`week-day-${fecha(2026, 9, d)}`)).toBeInTheDocument();
    }
  });

  it('shows the real day range even when the week crosses two months', () => {
    const otroMes = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 30 + i)); // 30 nov - 6 dic
    setup({ dates: otroMes });
    expect(screen.getByText('30 de nov – 6 de dic')).toBeInTheDocument();
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

  // Mismo criterio que CalendarioMensual (Change 1 solo lo colapsó a esta
  // tira, no cambió su lógica): día futuro con turnos -> badge numerado; día
  // pasado con turnos -> punto simple sin número. "Hoy" se fija con fake
  // timers para no depender del reloj real de quien corra el test.
  describe('badge de cantidad vs. punto (futuro vs. pasado)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 16)); // "hoy" = miércoles 16/9/2026
    });
    afterEach(() => vi.useRealTimers());

    it('muestra un badge con la cantidad en un día futuro con turnos', () => {
      // El 16 (hoy) también tiene turnos en el fixture — usamos el 17
      // (jueves, futuro) para no pisarnos con el caso "hoy" de otro test.
      const turnosConFuturo: TurnoMes[] = [{ fecha: fecha(2026, 9, 17), cantidad: 5 }];
      setup({ turnosMes: turnosConFuturo, fechaSeleccionada: fecha(2026, 9, 14) });
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('muestra un punto simple, sin número, en un día pasado con turnos', () => {
      const turnosConPasado: TurnoMes[] = [{ fecha: fecha(2026, 9, 15), cantidad: 2 }]; // martes, pasado
      setup({ turnosMes: turnosConPasado, fechaSeleccionada: fecha(2026, 9, 14) });
      expect(screen.queryByText('2')).toBeNull();
    });

    it('no muestra badge ni punto en el día seleccionado, aunque tenga turnos', () => {
      const turnosDelSeleccionado: TurnoMes[] = [{ fecha: fecha(2026, 9, 17), cantidad: 5 }];
      setup({ turnosMes: turnosDelSeleccionado, fechaSeleccionada: fecha(2026, 9, 17) });
      expect(screen.queryByText('5')).toBeNull();
    });
  });
});

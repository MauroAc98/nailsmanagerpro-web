import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { CalendarioMensual } from './CalendarioMensual';

function setup(overrides: Partial<Parameters<typeof CalendarioMensual>[0]> = {}) {
  const onDayClick = vi.fn();
  const onMonthChange = vi.fn();
  renderWithProviders(
    <CalendarioMensual
      viewDate={new Date(2026, 8, 1)}
      onMonthChange={onMonthChange}
      fechaSeleccionada="2026-09-21"
      turnosMes={[]}
      onDayClick={onDayClick}
      {...overrides}
    />,
  );
  return { onDayClick, onMonthChange };
}

describe('CalendarioMensual', () => {
  it('muestra el mes y llama onDayClick con la fecha tocada', () => {
    const { onDayClick } = setup();
    expect(screen.getByText(/septiembre 2026/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cal-day-2026-09-23'));
    expect(onDayClick).toHaveBeenCalledWith('2026-09-23');
  });

  it('los dias deshabilitados no disparan onDayClick y quedan aria-disabled', () => {
    const { onDayClick } = setup({ diaDeshabilitado: (f) => f < '2026-09-20' });
    const bloqueado = screen.getByTestId('cal-day-2026-09-10');
    expect(bloqueado).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(bloqueado);
    expect(onDayClick).not.toHaveBeenCalled();
    expect(screen.getByTestId('cal-day-2026-09-25')).not.toHaveAttribute('aria-disabled');
  });

  it('dibuja punto en los dias de diasConPunto', () => {
    setup({ diasConPunto: ['2026-09-22'] });
    expect(screen.getByTestId('cal-day-2026-09-22').querySelector('[data-punto]')).not.toBeNull();
    expect(screen.getByTestId('cal-day-2026-09-24').querySelector('[data-punto]')).toBeNull();
  });

  it('las flechas de mes llaman onMonthChange con el mes anterior / siguiente', () => {
    const { onMonthChange } = setup();
    const [anterior, siguiente] = screen.getAllByRole('button');
    fireEvent.click(anterior);
    fireEvent.click(siguiente);
    expect(onMonthChange).toHaveBeenNthCalledWith(1, new Date(2026, 7, 1));
    expect(onMonthChange).toHaveBeenNthCalledWith(2, new Date(2026, 9, 1));
  });
});

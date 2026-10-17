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

  it('las 7 columnas son flexibles sin ancho mínimo, así la grilla entra en celulares angostos', () => {
    setup();
    const grilla = screen.getByTestId('cal-day-2026-09-23').parentElement as HTMLElement;
    const encabezados = grilla.previousElementSibling as HTMLElement;
    expect(grilla.style.gridTemplateColumns).toBe('repeat(7, minmax(0, 1fr))');
    expect(encabezados.style.gridTemplateColumns).toBe('repeat(7, minmax(0, 1fr))');
    for (const celda of Array.from(grilla.children) as HTMLElement[]) {
      expect(celda.style.minWidth).toBe('');
      expect(celda.style.width).not.toMatch(/px/);
    }
  });

  it('los encabezados de la semana son L M M J V S D', () => {
    setup();
    const grilla = screen.getByTestId('cal-day-2026-09-23').parentElement as HTMLElement;
    const encabezados = grilla.previousElementSibling as HTMLElement;
    expect(Array.from(encabezados.children).map((c) => c.textContent)).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
  });

  it('un día pasado con turnos lleva un punto en vez de la cantidad', () => {
    setup({ viewDate: new Date(2000, 9, 1), fechaSeleccionada: '2000-10-17', turnosMes: [{ fecha: '2000-10-14', cantidad: 3 }] });
    const dia = screen.getByTestId('cal-day-2000-10-14');
    expect(dia).toHaveTextContent(/^14$/);
    expect(dia.querySelector('[data-punto-pasado]')).not.toBeNull();
  });

  it('un día de otro mes se marca con data-fuera-del-mes', () => {
    setup();
    expect(screen.getByTestId('cal-day-2026-08-31')).toHaveAttribute('data-fuera-del-mes', 'true');
    expect(screen.getByTestId('cal-day-2026-09-01')).not.toHaveAttribute('data-fuera-del-mes');
  });

  describe('con etiquetas accesibles (portal de profesionales)', () => {
    const etiquetas = {
      anterior: 'Mes anterior',
      siguiente: 'Mes siguiente',
      dia: (fecha: string, cantidad: number) => (cantidad > 0 ? `${fecha}, ${cantidad} turnos` : `${fecha}, sin turnos`),
    };

    it('los días son botones con nombre, aria-pressed y deshabilitados cuando corresponde', () => {
      const { onDayClick } = setup({
        etiquetas,
        turnosMes: [{ fecha: '2099-09-14', cantidad: 3 }],
        viewDate: new Date(2099, 8, 1),
        fechaSeleccionada: '2099-09-17',
        diaDeshabilitado: (f) => f === '2099-09-20',
      });
      expect(screen.getByRole('button', { name: '2099-09-14, 3 turnos' })).toHaveTextContent('3');
      expect(screen.getByTestId('cal-day-2099-09-17')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('cal-day-2099-09-18')).toHaveAttribute('aria-pressed', 'false');
      const bloqueado = screen.getByRole('button', { name: '2099-09-20, sin turnos' });
      expect(bloqueado).toBeDisabled();
      fireEvent.click(bloqueado);
      expect(onDayClick).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('cal-day-2099-09-21'));
      expect(onDayClick).toHaveBeenCalledWith('2099-09-21');
    });

    it('las flechas llevan nombre y miden al menos 44px', () => {
      const { onMonthChange } = setup({ etiquetas });
      const anterior = screen.getByRole('button', { name: 'Mes anterior' });
      const siguiente = screen.getByRole('button', { name: 'Mes siguiente' });
      for (const boton of [anterior, siguiente]) {
        expect(parseInt(boton.style.minWidth, 10)).toBeGreaterThanOrEqual(44);
        expect(parseInt(boton.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
      }
      fireEvent.click(siguiente);
      expect(onMonthChange).toHaveBeenCalledWith(new Date(2026, 9, 1));
    });

    it('sin etiquetas los días siguen siendo celdas simples (no botones)', () => {
      setup();
      expect(screen.getByTestId('cal-day-2026-09-23').tagName).toBe('DIV');
    });
  });

  describe('mesMinimo', () => {
    const etiquetas = { anterior: 'Mes anterior', siguiente: 'Mes siguiente', dia: () => 'día' };

    it('bloquea la flecha anterior cuando el mes anterior queda antes del mínimo', () => {
      const { onMonthChange } = setup({ viewDate: new Date(2000, 0, 1), mesMinimo: '2000-01', etiquetas });
      const anterior = screen.getByRole('button', { name: 'Mes anterior' });
      expect(anterior).toBeDisabled();
      fireEvent.click(anterior);
      expect(onMonthChange).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeEnabled();
    });

    it('permite retroceder hasta el mes mínimo', () => {
      const { onMonthChange } = setup({ viewDate: new Date(2000, 1, 1), mesMinimo: '2000-01' });
      const [anterior] = screen.getAllByRole('button');
      fireEvent.click(anterior);
      expect(onMonthChange).toHaveBeenCalledWith(new Date(2000, 0, 1));
    });

    it('sin mesMinimo la flecha anterior nunca se bloquea', () => {
      setup({ viewDate: new Date(1990, 0, 1) });
      expect(screen.getAllByRole('button')[0]).toBeEnabled();
    });
  });
});

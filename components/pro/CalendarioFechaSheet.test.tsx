import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, within } from '@/test/render';
import { hoyDelDispositivo } from '@/lib/pro/hoy';
import type { ProError } from '@/lib/pro/errores';
import { CalendarioFechaSheet } from './CalendarioFechaSheet';

const marcasBase = [
  { fecha: '2099-10-14', cantidad: 3 },
  { fecha: '2099-10-15', cantidad: 0 },
];

function montar(props: Partial<React.ComponentProps<typeof CalendarioFechaSheet>> = {}) {
  const acciones = { onElegir: vi.fn(), onCerrar: vi.fn(), onCambiarMes: vi.fn(), onReintentar: vi.fn() };
  const vista = renderWithProviders(
    <CalendarioFechaSheet
      abierto
      mes="2099-10"
      fecha="2099-10-17"
      marcas={marcasBase}
      error={null}
      {...acciones}
      {...props}
    />,
  );
  return { ...vista, ...acciones };
}

describe('CalendarioFechaSheet', () => {
  it('cerrada no pinta nada', () => {
    const { container } = montar({ abierto: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('abierta es un diálogo "Elegir fecha" con el mes y la grilla de 42 celdas', () => {
    montar();
    const dialogo = screen.getByRole('dialog', { name: 'Elegir fecha' });
    expect(within(dialogo).getByText('octubre 2099')).toBeInTheDocument();
    expect(dialogo.querySelectorAll('[data-testid^="cal-dia-"]')).toHaveLength(42);
    expect(screen.getByTestId('cal-dia-2099-10-01')).toBeInTheDocument();
    expect(screen.getByTestId('cal-dia-2099-10-31')).toBeInTheDocument();
  });

  it('tocar un día lo elige; los días fuera del mes se ven atenuados pero también se pueden elegir', () => {
    const { onElegir } = montar();
    fireEvent.click(screen.getByTestId('cal-dia-2099-10-20'));
    expect(onElegir).toHaveBeenCalledWith('2099-10-20');
    expect(screen.getByTestId('cal-dia-2099-09-30')).toHaveAttribute('data-fuera-del-mes', 'true');
  });

  it('el día elegido va resaltado y los días con turnos muestran su cantidad', () => {
    montar();
    expect(screen.getByTestId('cal-dia-2099-10-17')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('cal-dia-2099-10-18')).toHaveAttribute('aria-pressed', 'false');
    const marcado = screen.getByRole('button', { name: /14 de octubre.*3 turnos/ });
    expect(marcado).toHaveTextContent('3');
    expect(screen.getByTestId('cal-dia-2099-10-15')).toHaveTextContent(/^15$/);
    expect(screen.getByRole('button', { name: /20 de octubre.*sin turnos/ })).toBeInTheDocument();
  });

  it('un día pasado con turnos lleva un punto en vez de la cantidad', () => {
    montar({ mes: '2000-10', fecha: '2000-10-17', marcas: [{ fecha: '2000-10-14', cantidad: 3 }] });
    const dia = screen.getByTestId('cal-dia-2000-10-14');
    expect(dia).toHaveTextContent(/^14$/);
    expect(dia.querySelector('[data-punto]')).not.toBeNull();
  });

  it('las flechas piden el mes anterior y el siguiente, cruzando el año', () => {
    const { onCambiarMes, rerender } = montar({ mes: '2099-12' });
    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(onCambiarMes).toHaveBeenLastCalledWith('2100-01');
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(onCambiarMes).toHaveBeenLastCalledWith('2099-11');
    rerender(
      <CalendarioFechaSheet abierto mes="2099-01" fecha="2099-01-05" marcas={[]} error={null} onElegir={vi.fn()} onCerrar={vi.fn()} onCambiarMes={onCambiarMes} onReintentar={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(onCambiarMes).toHaveBeenLastCalledWith('2098-12');
  });

  it('no deja ir antes de 2000-01', () => {
    const { onCambiarMes } = montar({ mes: '2000-01', fecha: '2000-01-05', marcas: [] });
    const anterior = screen.getByRole('button', { name: 'Mes anterior' });
    expect(anterior).toBeDisabled();
    fireEvent.click(anterior);
    expect(onCambiarMes).not.toHaveBeenCalled();
  });

  it('"Hoy" lleva el calendario al mes de hoy sin elegir ni cerrar', () => {
    const { onCambiarMes, onElegir, onCerrar } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(onCambiarMes).toHaveBeenCalledWith(hoyDelDispositivo().slice(0, 7));
    expect(onElegir).not.toHaveBeenCalled();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('el botón Cerrar, Escape y el fondo piden cerrar', () => {
    const { onCerrar } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByTestId('fondo-calendario'));
    expect(onCerrar).toHaveBeenCalledTimes(3);
  });

  it('mientras no hay marcas muestra el spinner sin tapar la grilla', () => {
    montar({ marcas: null });
    expect(screen.getByRole('status', { name: 'Cargando turnos' })).toBeInTheDocument();
    expect(screen.getByTestId('cal-dia-2099-10-10')).toBeInTheDocument();
  });

  it('si fallan las marcas muestra el error del tipo, la grilla sigue y se puede reintentar', () => {
    const error: ProError = { kind: 'network' };
    const { onReintentar, onElegir } = montar({ error });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Igual puedes elegir un día/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('cal-dia-2099-10-10'));
    expect(onElegir).toHaveBeenCalledWith('2099-10-10');
  });

  it('los objetivos táctiles de las flechas y de los días miden al menos 44px', () => {
    montar();
    for (const boton of [
      screen.getByRole('button', { name: 'Mes anterior' }),
      screen.getByRole('button', { name: 'Mes siguiente' }),
      screen.getByTestId('cal-dia-2099-10-14'),
    ]) {
      expect(parseInt(boton.style.minWidth, 10)).toBeGreaterThanOrEqual(44);
      expect(parseInt(boton.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    }
  });
});

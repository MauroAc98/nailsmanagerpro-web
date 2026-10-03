import { cloneElement, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// ResponsiveContainer mide con ResizeObserver, que jsdom no implementa: sin
// tamaño no dibuja nada. Se le da un tamaño fijo para poder montar el SVG.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      cloneElement(children, { width: 300, height: 150 } as Record<string, unknown>),
  };
});

import DonutChart from './DonutChart';
import RitmoSemanaChart from './RitmoSemanaChart';
import TendenciaChart from './TendenciaChart';
import { TooltipCard } from './TooltipCard';
import { Consejo } from './Consejo';
import AcumuladoChart from './AcumuladoChart';
import BurbujasChart from './BurbujasChart';


describe('DonutChart', () => {
  const data = [
    { name: 'Capping', value: 24, color: '#111', valorLabel: '35%' },
    { name: 'Esmaltado semipermanente', value: 16, color: '#222', valorLabel: '24%' },
  ];

  it('muestra el total al centro y una leyenda con cada rebanada', () => {
    render(<DonutChart data={data} centerValue={40} centerLabel="turnos" ariaLabel="Servicios" />);
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('turnos')).toBeInTheDocument();
    expect(screen.getByText('Capping')).toBeInTheDocument();
    expect(screen.getByText('35%')).toBeInTheDocument();
    expect(screen.getByText('Esmaltado semipermanente')).toBeInTheDocument();
  });

  it('dibuja un gráfico SVG', () => {
    const { container } = render(<DonutChart data={data} centerValue={40} centerLabel="turnos" ariaLabel="Servicios" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('TendenciaChart', () => {
  const puntos = [
    { label: '1/9', monto: 1000 },
    { label: '2/9', monto: 3000 },
    { label: '3/9', monto: 2000 },
  ];

  it('monta el área con la serie del mes anterior', () => {
    const { container } = render(
      <TendenciaChart puntos={puntos} previo={[500, 800, undefined]} previoLabel="Agosto" tipo="area"
        ocultarMonto={false} parcialLabel="parcial" ariaLabel="Ganancias" />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    // Dos trazos: el mes actual y el anterior (punteado).
    expect(container.querySelectorAll('.recharts-area-curve').length).toBe(2);
  });

  it('los días futuros (monto null) no se dibujan: la curva termina en el último dato', () => {
    const base = { previo: [1, 2, 3, 4], previoLabel: 'Agosto', tipo: 'area' as const, ocultarMonto: false, parcialLabel: 'parcial', ariaLabel: 'Ganancias' };
    const completo = render(
      <TendenciaChart {...base} puntos={[
        { label: '1/10', monto: 1000 }, { label: '2/10', monto: 3000 }, { label: '3/10', monto: 2000 }, { label: '4/10', monto: 500 },
      ]} />,
    );
    // Cantidad de puntos de la curva del mes actual (cada comando M/L/C = un punto).
    const segmentos = (c: HTMLElement) => (c.querySelectorAll('.recharts-area-curve')[1]?.getAttribute('d')?.match(/[MLC]/g) ?? []).length;
    const completos = segmentos(completo.container);
    completo.unmount();

    const cortado = render(
      <TendenciaChart {...base} puntos={[
        { label: '1/10', monto: 1000 }, { label: '2/10', monto: 3000 }, { label: '3/10', monto: null }, { label: '4/10', monto: null },
      ]} />,
    );
    // Menos puntos que la serie completa (nunca baja a 0), y el mes anterior sigue entero.
    expect(segmentos(cortado.container)).toBeLessThan(completos);
    expect(segmentos(cortado.container)).toBe(2);
    expect(cortado.container.querySelectorAll('.recharts-area-curve').length).toBe(2);
  });

  it('en modo barras monta una barra por bucket', () => {
    const { container } = render(
      <TendenciaChart puntos={[{ label: 'S1', monto: 10, completo: false }, { label: 'S2', monto: 20, completo: true }]}
        tipo="barras" ocultarMonto={false} parcialLabel="parcial" ariaLabel="Ganancias" />,
    );
    expect(container.querySelectorAll('.recharts-bar-rectangle').length).toBe(2);
  });
});

describe('RitmoSemanaChart', () => {
  it('apila completados, confirmados y cancelados por día', () => {
    const dias = [1, 2, 3, 4, 5, 6, 7].map(i => ({
      dia_semana: i, label: `D${i}`, completados: i, confirmados: 1, cancelados: i === 6 ? 2 : 0,
    }));
    const { container } = render(
      <RitmoSemanaChart dias={dias} labels={{ completed: 'Completados', confirmed: 'Confirmados', cancelled: 'Cancelados' }} ariaLabel="Ritmo" seleccionado={null} onSeleccionar={() => {}} />,
    );
    expect(container.querySelectorAll('.recharts-bar').length).toBe(3);
  });
});

describe('TooltipCard', () => {
  it('muestra título y filas con su valor', () => {
    render(<TooltipCard title="Sáb 20" rows={[{ label: 'Septiembre', value: '$96.000', color: '#000' }]} />);
    expect(screen.getByText('Sáb 20')).toBeInTheDocument();
    expect(screen.getByText('$96.000')).toBeInTheDocument();
  });
});

describe('Consejo', () => {
  it('es una nota accesible con el texto del consejo', () => {
    render(<Consejo>El sábado concentra el 27% de tus turnos.</Consejo>);
    expect(screen.getByRole('note')).toHaveTextContent('El sábado concentra el 27% de tus turnos.');
  });
});

describe('TendenciaChart — promedio diario', () => {
  const puntos = [{ label: '1', monto: 100 }, { label: '2', monto: 300 }, { label: '3', monto: 200 }];
  const base = { puntos, tipo: 'area' as const, parcialLabel: 'parcial', ariaLabel: 'Ganancias' };

  it('dibuja una línea de referencia con el promedio y su etiqueta corta', () => {
    const { container } = render(<TendenciaChart {...base} ocultarMonto={false} promedio={200} promedioLabel='Prom. $200' />);
    expect(container.querySelectorAll('.recharts-reference-line').length).toBe(1);
    expect(screen.getByText('Prom. $200')).toBeInTheDocument();
  });

  it('sin promedio no hay línea', () => {
    const { container } = render(<TendenciaChart {...base} ocultarMonto={false} />);
    expect(container.querySelectorAll('.recharts-reference-line').length).toBe(0);
  });

  it('con ocultar monto no se imprime la etiqueta con el importe', () => {
    render(<TendenciaChart {...base} ocultarMonto promedio={200} promedioLabel='Prom. $200' />);
    expect(screen.queryByText('Prom. $200')).toBeNull();
  });
});

describe('AcumuladoChart', () => {
  const labels = { daily: 'Cobros del día', cumulative: 'Acumulado', previous: 'Septiembre' };
  const completa = [
    { label: '1', monto: 100, acumulado: 100, previo: 50 },
    { label: '2', monto: 200, acumulado: 300, previo: 150 },
    { label: '3', monto: 50, acumulado: 350, previo: 400 },
  ];

  it('monta barras del día, la línea de acumulado y la punteada del mes anterior', () => {
    const { container } = render(<AcumuladoChart serie={completa} labels={labels} ocultarMonto={false} ariaLabel='Acumulado' />);
    expect(container.querySelectorAll('.recharts-bar-rectangle').length).toBe(3);
    expect(container.querySelectorAll('.recharts-line-curve').length).toBe(2);
  });

  it('los días futuros (null) no dibujan barra y cortan la línea del acumulado', () => {
    const cortada = [
      completa[0], completa[1],
      { label: '3', monto: null, acumulado: null, previo: 400 },
    ];
    const puntos = (c: HTMLElement) => (c.querySelectorAll('.recharts-line-curve')[0]?.getAttribute('d')?.match(/[MLC]/g) ?? []).length;
    const a = render(<AcumuladoChart serie={completa} labels={labels} ocultarMonto={false} ariaLabel='Acumulado' />);
    const completos = puntos(a.container);
    a.unmount();
    const b = render(<AcumuladoChart serie={cortada} labels={labels} ocultarMonto={false} ariaLabel='Acumulado' />);
    expect(b.container.querySelectorAll('.recharts-bar-rectangle').length).toBe(2);
    expect(puntos(b.container)).toBeLessThan(completos);
    // la punteada del mes anterior sigue entera
    expect(b.container.querySelectorAll('.recharts-line-curve').length).toBe(2);
  });
});

describe('BurbujasChart', () => {
  const servicios = [
    { servicio_id: 1, nombre: 'Capping', turnos: 46, ticket: 3000, monto: 138000, color: '#111' },
    { servicio_id: 2, nombre: 'Soft gel', turnos: 17, ticket: 22000, monto: 374000, color: '#222' },
    { servicio_id: 3, nombre: 'Semis pies', turnos: 4, ticket: 14000, monto: 56000, color: '#333' },
  ];

  it('dibuja una burbuja por servicio', () => {
    const { container } = render(
      <BurbujasChart servicios={servicios} ejes={{ turnos: 'Turnos', ticket: 'Ticket', monto: 'Total' }} ocultarMonto={false} ariaLabel='Servicios' />,
    );
    expect(container.querySelectorAll('.recharts-scatter-symbol').length).toBe(3);
  });
});

describe('RitmoSemanaChart — tocar para filtrar', () => {
  const dias = [1, 2, 3, 4, 5, 6, 7].map(i => ({ dia_semana: i, label: ['L', 'M', 'X', 'J', 'V', 'S', 'D'][i - 1], completados: i, confirmados: 1, cancelados: 0 }));
  const labels = { completed: 'Completados', confirmed: 'Confirmados', cancelled: 'Cancelados' };

  it('cada día es un botón real; tocarlo avisa cuál (toggle lo resuelve el padre)', () => {
    const onSeleccionar = vi.fn();
    render(<RitmoSemanaChart dias={dias} labels={labels} ariaLabel='Ritmo' seleccionado={null} onSeleccionar={onSeleccionar} />);
    fireEvent.click(screen.getByRole('button', { name: 'S' }));
    expect(onSeleccionar).toHaveBeenCalledWith(6);
  });

  it('marca como presionado solo el día elegido', () => {
    render(<RitmoSemanaChart dias={dias} labels={labels} ariaLabel='Ritmo' seleccionado={6} onSeleccionar={() => {}} />);
    expect(screen.getByRole('button', { name: 'S' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'L' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('los botones tienen un target cómodo (>=44px de alto) y no bloquean el scroll vertical', () => {
    render(<RitmoSemanaChart dias={dias} labels={labels} ariaLabel='Ritmo' seleccionado={null} onSeleccionar={() => {}} />);
    const btn = screen.getByRole('button', { name: 'S' });
    expect(parseInt(btn.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(btn.style.touchAction).toBe('manipulation');
  });
});

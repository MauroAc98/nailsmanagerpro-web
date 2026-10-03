import { cloneElement, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
      <RitmoSemanaChart dias={dias} labels={{ completed: 'Completados', confirmed: 'Confirmados', cancelled: 'Cancelados' }} ariaLabel="Ritmo" />,
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

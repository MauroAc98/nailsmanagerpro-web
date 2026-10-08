import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { setMockLocation, resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
// Los gráficos de Recharts viven en chunks dinámicos (ssr:false); acá no se
// prueban (ver components/estadisticas/charts.test.tsx), solo la página.
// Los mocks capturan las props de cada gráfico (se distinguen por su prop
// característica) para poder afirmar qué reciben; el de ritmo además expone un
// botón que dispara onSeleccionar, como el real.
type Cap = Record<string, unknown>;
const chartProps = vi.hoisted(() => ({
  tendencia: null as null | { puntos: { label: string; monto: number | null }[]; previo?: (number | undefined)[]; promedio?: number | null },
  acumulado: null as null | { serie: { label: string; monto: number | null; acumulado: number | null; previo?: number }[] },
  burbujas: null as null | { servicios: { nombre: string; turnos: number; ticket: number; monto: number }[] },
}));
vi.mock('next/dynamic', () => ({
  default: () => function ChartMock(props: Cap) {
    if (props.puntos) chartProps.tendencia = props as never;
    if (props.serie) chartProps.acumulado = props as never;
    if (props.servicios) chartProps.burbujas = props as never;
    if (props.onSeleccionar) {
      const onSel = props.onSeleccionar as (d: number) => void;
      return <button type="button" data-testid="ritmo-dia-6" onClick={() => onSel(6)} />;
    }
    return null;
  },
}));
vi.mock('@/store/useProfesionalStore', () => ({
  useProfesionalStore: () => ({ profesionales: [], fetchProfesionales: vi.fn() }),
}));
vi.mock('@/services/statsService', () => ({
  statsService: {
    getDashboard: vi.fn(),
    getGananciasPorPeriodo: vi.fn(async () => ({ puntos: [], truncado: false })),
    getOcupacion: vi.fn(async () => [] as BucketOcupacion[]),
  },
}));

import { statsService, type BucketOcupacion, type DashboardStats } from '@/services/statsService';
import EstadisticasPage from './page';

const getDashboard = vi.mocked(statsService.getDashboard);

function dashboard(over: Partial<DashboardStats> = {}): DashboardStats {
  return {
    total_turnos: 68,
    turnos_por_estado: { completados: 64, confirmados: 0, cancelados: 4 },
    servicios_mas_pedidos: [],
    clientes: { nuevas: 3, recurrentes: 41 },
    ganancias: 1560000,
    gastos: 275500,
    ganancia_neta: 1284500,
    ganancias_por_servicio: [],
    ganancias_por_dia: [],
    turnos_por_estado_por_dia_semana: [],
    ...over,
  };
}

beforeEach(() => {
  // Fecha fija: 15/11/2026 => octubre ya es un mes CERRADO (comparación contra septiembre completo).
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 15, 12) });
  chartProps.tendencia = null;
  chartProps.acumulado = null;
  chartProps.burbujas = null;
  resetNavigationMock();
  localStorage.clear();
  getDashboard.mockReset();
  setMockLocation('/configuracion/estadisticas', 'mes=2026-10');
});

describe('Estadísticas — héroe', () => {
  it('muestra ganancia neta, ticket promedio y % de cancelaciones', async () => {
    getDashboard.mockResolvedValue(dashboard());
    renderWithProviders(<EstadisticasPage />);

    expect(await screen.findByText(/1\.284\.500/)).toBeInTheDocument();
    // 1.560.000 / 64 completados
    expect(screen.getByText(/24\.375/)).toBeInTheDocument();
    // 4 cancelados de 68
    expect(screen.getByText('6%')).toBeInTheDocument();
  });

  // En el celular las tres cajitas separadas quedaban angostas: monto cortado
  // ("$24.375,0…") y etiquetas con "…" ("promedio p…"). Una sola franja con
  // divisores, monto corto sin decimales y etiquetas que bajan de renglón.
  it('los tres datos de contexto van en una sola franja, con monto corto y etiquetas completas', async () => {
    getDashboard.mockResolvedValue(dashboard());
    renderWithProviders(<EstadisticasPage />);

    const franja = await screen.findByTestId('hero-kpis');
    expect(within(franja).getByText('$24.375,00')).toBeInTheDocument();
    for (const etiqueta of ['turnos', 'promedio por turno', 'cancelaciones']) {
      const nodo = within(franja).getByText(etiqueta);
      expect(nodo.style.whiteSpace).not.toBe('nowrap');
      expect(nodo.style.textOverflow).not.toBe('ellipsis');
    }
  });

  it('el monto grande y el promedio por turno usan MontoFit (se achican, nunca se cortan ni se parten)', async () => {
    getDashboard.mockResolvedValue(dashboard());
    renderWithProviders(<EstadisticasPage />);

    const franja = await screen.findByTestId('hero-kpis');
    const promedio = within(franja).getByText('$24.375,00');
    expect(promedio.style.whiteSpace).toBe('nowrap');
    expect(promedio.style.overflowWrap).not.toBe('anywhere');

    const grande = screen.getByText(/1\.284\.500/);
    expect(grande.style.whiteSpace).toBe('nowrap');
    expect(grande.style.wordBreak).not.toBe('break-word');
  });

  it('compara contra el mes anterior pidiendo ese rango al backend', async () => {
    getDashboard.mockImplementation(async (desde: string) =>
      desde === '2026-09-01' ? dashboard({ ganancia_neta: 1000000 }) : dashboard());
    renderWithProviders(<EstadisticasPage />);

    expect(await screen.findByText(/28% vs Septiembre/)).toBeInTheDocument();
    expect(getDashboard).toHaveBeenCalledWith('2026-09-01', '2026-09-30', undefined);
  });

  it('sin base de comparación (mes previo en 0) no muestra la insignia', async () => {
    getDashboard.mockImplementation(async (desde: string) =>
      desde === '2026-09-01' ? dashboard({ ganancia_neta: 0, ganancias: 0 }) : dashboard());
    renderWithProviders(<EstadisticasPage />);

    await screen.findByText(/1\.284\.500/);
    await waitFor(() => expect(getDashboard).toHaveBeenCalledWith('2026-09-01', '2026-09-30', undefined));
    expect(screen.queryByText(/vs Septiembre/)).toBeNull();
  });

  it('si falla el mes anterior la pantalla funciona igual, sin error ni insignia', async () => {
    getDashboard.mockImplementation(async (desde: string) => {
      if (desde === '2026-09-01') throw new Error('boom');
      return dashboard();
    });
    renderWithProviders(<EstadisticasPage />);

    expect(await screen.findByText(/1\.284\.500/)).toBeInTheDocument();
    expect(screen.queryByText(/vs Septiembre/)).toBeNull();
    expect(screen.queryByText('Reintentar')).toBeNull();
  });

  it('en rango personalizado no hay comparación con el mes anterior', async () => {
    getDashboard.mockImplementation(async (desde: string) =>
      desde === '2026-09-01' ? dashboard({ ganancia_neta: 1000000 }) : dashboard());
    renderWithProviders(<EstadisticasPage />);
    await screen.findByText(/28% vs Septiembre/);

    fireEvent.click(screen.getByRole('button', { name: 'Rango personalizado' }));

    await waitFor(() => expect(screen.queryByText(/vs Septiembre/)).toBeNull());
  });

  it('con ocultar monto activo el héroe tapa el importe', async () => {
    localStorage.setItem('agenda:ocultarMontoResumen', '1');
    getDashboard.mockResolvedValue(dashboard());
    renderWithProviders(<EstadisticasPage />);

    await screen.findByText('turnos');
    await waitFor(() => expect(screen.queryByText(/1\.284\.500/)).toBeNull());
    expect(screen.getByRole('button', { name: 'Mostrar monto' })).toBeInTheDocument();
  });
});

describe('Estadísticas — consejos', () => {
  it('no muestra consejos de día pico/flojo con pocos turnos', async () => {
    getDashboard.mockResolvedValue(dashboard({
      turnos_por_estado_por_dia_semana: [{ dia_semana: 6, completados: 3, confirmados: 0, cancelados: 0 }],
    }));
    renderWithProviders(<EstadisticasPage />);
    await screen.findByText(/1\.284\.500/);
    expect(screen.queryByText(/concentra el/)).toBeNull();
    expect(screen.queryByText(/día más flojo/)).toBeNull();
  });

  it('muestra el día pico cuando hay datos suficientes', async () => {
    const dias = [3, 4, 5, 3, 4, 18, 3].map((c, i) => ({ dia_semana: i + 1, completados: c, confirmados: 0, cancelados: 0 }));
    getDashboard.mockResolvedValue(dashboard({ turnos_por_estado_por_dia_semana: dias }));
    renderWithProviders(<EstadisticasPage />);

    expect(await screen.findByText(/concentra el 45% de tus turnos/)).toBeInTheDocument();
  });

  it('muestra la retención de clientas', async () => {
    getDashboard.mockResolvedValue(dashboard());
    renderWithProviders(<EstadisticasPage />);
    expect(await screen.findByText(/93% de tus clientes ya había venido antes/)).toBeInTheDocument();
  });
});

describe('Estadísticas — mes en curso', () => {
  beforeEach(() => {
    // 2/10/2026: octubre está en curso con solo 2 días.
    vi.setSystemTime(new Date(2026, 9, 2, 12));
  });

  const diasOctubre = (hasta: number) =>
    Array.from({ length: hasta }, (_, i) => ({ fecha: `2026-10-0${i + 1}`, monto: 1000 * (i + 1) }));

  it('compara contra el MISMO período del mes anterior (día 1 al día de hoy), no contra septiembre completo', async () => {
    getDashboard.mockImplementation(async (desde: string, hasta: string) => {
      if (desde === '2026-09-01' && hasta === '2026-09-02') return dashboard({ ganancia_neta: 1000000 });
      if (desde === '2026-09-01') return dashboard({ ganancia_neta: 9000000 });
      return dashboard();
    });
    renderWithProviders(<EstadisticasPage />);

    expect(await screen.findByText(/28% vs Septiembre al día 2/)).toBeInTheDocument();
    expect(getDashboard).toHaveBeenCalledWith('2026-09-01', '2026-09-02', undefined);
  });

  it('sin base de comparación en el mismo período (previo en 0) oculta la insignia', async () => {
    getDashboard.mockImplementation(async (desde: string, hasta: string) => {
      if (desde === '2026-09-01' && hasta === '2026-09-02') return dashboard({ ganancia_neta: 0, ganancias: 0 });
      if (desde === '2026-09-01') return dashboard({ ganancia_neta: 9000000 });
      return dashboard();
    });
    renderWithProviders(<EstadisticasPage />);

    await screen.findByText(/1\.284\.500/);
    await waitFor(() => expect(getDashboard).toHaveBeenCalledWith('2026-09-01', '2026-09-02', undefined));
    expect(screen.queryByText(/vs Septiembre/)).toBeNull();
  });

  it('la serie del mes en curso se corta hoy: los días futuros van null, no 0', async () => {
    getDashboard.mockImplementation(async (desde: string) =>
      desde === '2026-10-01' ? dashboard({ ganancias_por_dia: diasOctubre(2) }) : dashboard({ ganancias_por_dia: [] }));
    renderWithProviders(<EstadisticasPage />);

    await waitFor(() => expect(chartProps.tendencia).not.toBeNull());
    const { puntos } = chartProps.tendencia!;
    expect(puntos).toHaveLength(31);
    expect(puntos.slice(0, 2).map(p => p.monto)).toEqual([1000, 2000]);
    expect(puntos.slice(2).every(p => p.monto === null)).toBe(true);
  });

  it('un día de hoy sin turnos sigue siendo 0 (pasado/presente), solo el futuro es null', async () => {
    getDashboard.mockImplementation(async (desde: string) =>
      desde === '2026-10-01' ? dashboard({ ganancias_por_dia: diasOctubre(1) }) : dashboard());
    renderWithProviders(<EstadisticasPage />);

    await waitFor(() => expect(chartProps.tendencia).not.toBeNull());
    expect(chartProps.tendencia!.puntos[1].monto).toBe(0);
    expect(chartProps.tendencia!.puntos[2].monto).toBeNull();
  });

  it('en un mes cerrado la serie va completa (sin nulls)', async () => {
    vi.setSystemTime(new Date(2026, 10, 15, 12));
    getDashboard.mockResolvedValue(dashboard({ ganancias_por_dia: diasOctubre(2) }));
    renderWithProviders(<EstadisticasPage />);

    await waitFor(() => expect(chartProps.tendencia).not.toBeNull());
    expect(chartProps.tendencia!.puntos.every(p => p.monto !== null)).toBe(true);
  });
});

describe('Estadísticas — acumulado vs mes anterior', () => {
  const dias = (mes: string, montos: number[]) =>
    montos.map((monto, i) => ({ fecha: `${mes}-${String(i + 1).padStart(2, '0')}`, monto }));

  beforeEach(() => vi.setSystemTime(new Date(2026, 9, 2, 12)));

  function mockMeses(octubre: number[], septiembre: number[]) {
    getDashboard.mockImplementation(async (desde: string) =>
      desde === '2026-09-01'
        ? dashboard({ ganancias_por_dia: dias('2026-09', septiembre) })
        : dashboard({ ganancias_por_dia: dias('2026-10', octubre) }));
  }

  it('mes en curso: badge con la diferencia del acumulado a igual día y serie cortada en hoy', async () => {
    mockMeses([100000, 200000], [50000, 100000, 80000]);
    renderWithProviders(<EstadisticasPage />);

    expect(await screen.findByText('¿Cómo vas contra el mes pasado?')).toBeInTheDocument();
    // día 2: 300.000 contra 150.000 de septiembre
    expect(screen.getByText(/\$150\.000(,00)? por encima de Septiembre al día 2/)).toBeInTheDocument();
    const serie = chartProps.acumulado!.serie;
    expect(serie).toHaveLength(31);
    expect(serie.slice(0, 2).map(p => p.acumulado)).toEqual([100000, 300000]);
    expect(serie.slice(2).every(p => p.acumulado === null && p.monto === null)).toBe(true);
    // el previo sigue completo (acumulado de septiembre: 50k, 150k, 230k, ...)
    expect(serie[2].previo).toBe(230000);
  });

  it('por debajo cuando el acumulado queda atrás', async () => {
    mockMeses([10000, 20000], [50000, 100000]);
    renderWithProviders(<EstadisticasPage />);
    expect(await screen.findByText(/\$120\.000(,00)? por debajo de Septiembre al día 2/)).toBeInTheDocument();
  });

  it('sin base de comparación (mes anterior sin cobros) no se muestra la tarjeta', async () => {
    mockMeses([100000, 200000], []);
    renderWithProviders(<EstadisticasPage />);
    await screen.findByText(/1\.284\.500/);
    await waitFor(() => expect(getDashboard).toHaveBeenCalledWith('2026-09-01', '2026-09-30', undefined));
    expect(screen.queryByText('¿Cómo vas contra el mes pasado?')).toBeNull();
  });

  it('en rango personalizado no hay tarjeta de acumulado', async () => {
    mockMeses([100000, 200000], [50000, 100000]);
    renderWithProviders(<EstadisticasPage />);
    await screen.findByText('¿Cómo vas contra el mes pasado?');
    fireEvent.click(screen.getByRole('button', { name: 'Rango personalizado' }));
    await waitFor(() => expect(screen.queryByText('¿Cómo vas contra el mes pasado?')).toBeNull());
  });

  it('con ocultar monto el badge no imprime el importe', async () => {
    localStorage.setItem('agenda:ocultarMontoResumen', '1');
    mockMeses([100000, 200000], [50000, 100000]);
    renderWithProviders(<EstadisticasPage />);
    await screen.findByText('¿Cómo vas contra el mes pasado?');
    expect(screen.queryByText(/150\.000/)).toBeNull();
    expect(screen.getByText(/por encima de Septiembre al día 2/)).toBeInTheDocument();
  });

  it('el gráfico por día recibe el promedio de los días transcurridos (no del mes entero)', async () => {
    mockMeses([100000, 200000], [50000]);
    renderWithProviders(<EstadisticasPage />);
    await waitFor(() => expect(chartProps.tendencia?.promedio).toBe(150000));
  });
});

describe('Estadísticas — burbujas de servicios', () => {
  const sv = (id: number, nombre: string, cantidad: number, monto: number) => ({
    mas: { servicio_id: id, nombre, cantidad }, gan: { servicio_id: id, nombre, monto },
  });

  function mockServicios(items: ReturnType<typeof sv>[]) {
    getDashboard.mockResolvedValue(dashboard({
      servicios_mas_pedidos: items.map(i => i.mas),
      ganancias_por_servicio: items.map(i => i.gan),
    }));
  }

  it('con >=3 servicios con plata muestra burbujas con ticket = monto ÷ turnos y la lista debajo', async () => {
    mockServicios([sv(1, 'Capping', 46, 138000), sv(2, 'Soft gel', 17, 374000), sv(3, 'Semis pies', 4, 56000)]);
    renderWithProviders(<EstadisticasPage />);

    expect(await screen.findByText('Qué servicio rinde más')).toBeInTheDocument();
    const b = chartProps.burbujas!.servicios;
    expect(b.find(s => s.nombre === 'Soft gel')).toMatchObject({ turnos: 17, ticket: 22000, monto: 374000 });
    expect(screen.getByText('17 turnos')).toBeInTheDocument();
    expect(screen.getByText(/^\$374\.000(,00)?$/)).toBeInTheDocument();
  });

  it('con menos de 3 servicios con plata no muestra la tarjeta', async () => {
    mockServicios([sv(1, 'Capping', 46, 138000), sv(2, 'Soft gel', 17, 374000)]);
    renderWithProviders(<EstadisticasPage />);
    await screen.findByText(/1\.284\.500/);
    expect(screen.queryByText('Qué servicio rinde más')).toBeNull();
  });

  it('muestra el insight cuando un servicio pesa mucho más en plata que en turnos', async () => {
    mockServicios([sv(1, 'Capping', 30, 45000), sv(2, 'Soft gel', 10, 55000), sv(3, 'Pedicura', 5, 5000)]);
    renderWithProviders(<EstadisticasPage />);
    expect(await screen.findByText(/Soft gel es el 22% de tus turnos pero el 52% de la plata/)).toBeInTheDocument();
  });

  it('con ocultar monto la lista no imprime importes', async () => {
    localStorage.setItem('agenda:ocultarMontoResumen', '1');
    mockServicios([sv(1, 'Capping', 46, 138000), sv(2, 'Soft gel', 17, 374000), sv(3, 'Semis pies', 4, 56000)]);
    renderWithProviders(<EstadisticasPage />);
    await screen.findByText('Qué servicio rinde más');
    expect(screen.queryByText(/^\$374\.000(,00)?$/)).toBeNull();
  });
});

describe('Estadísticas — tocar un día para filtrar', () => {
  const ocupacion: BucketOcupacion[] = [
    { dia_semana: 6, hora: 10, cantidad: 2 }, { dia_semana: 6, hora: 11, cantidad: 7 },
    { dia_semana: 2, hora: 15, cantidad: 9 },
  ];
  const ritmo = [1, 2, 3, 4, 5, 6, 7].map(i => ({
    dia_semana: i, completados: i === 6 ? 4 : 1, confirmados: i === 6 ? 2 : 0, cancelados: i === 6 ? 1 : 0,
  }));

  beforeEach(() => {
    getDashboard.mockResolvedValue(dashboard({
      turnos_por_estado_por_dia_semana: ritmo,
      // 2026-10-03 y 2026-10-10 son sábados
      ganancias_por_dia: [{ fecha: '2026-10-03', monto: 60000 }, { fecha: '2026-10-10', monto: 40000 }, { fecha: '2026-10-05', monto: 9999 }],
    }));
    vi.mocked(statsService.getOcupacion).mockResolvedValue(ocupacion);
  });

  it('sin día elegido no hay chip ni tarjeta de detalle', async () => {
    renderWithProviders(<EstadisticasPage />);
    await screen.findByTestId('ritmo-dia-6');
    expect(screen.queryByRole('button', { name: /Quitar filtro/ })).toBeNull();
    expect(screen.queryByText('hora pico')).toBeNull();
  });

  it('al tocar un día aparece el chip, el resumen del día y la hora pico de ESE día', async () => {
    renderWithProviders(<EstadisticasPage />);
    fireEvent.click(await screen.findByTestId('ritmo-dia-6'));

    expect(await screen.findByRole('button', { name: 'Quitar filtro de sábado' })).toBeInTheDocument();
    const resumen = within(screen.getByTestId('resumen-dia'));
    expect(resumen.getByText('hora pico')).toBeInTheDocument();
    // hora pico de sábado (11 h), no la del martes (15 h)
    expect(resumen.getByText('11hs')).toBeInTheDocument();
    // ticket derivado de datos reales: (60.000 + 40.000) ÷ 4 completados
    expect(resumen.getByText(/^\$25\.000(,00)?$/)).toBeInTheDocument();
  });

  it('el ticket del día se omite cuando no se puede derivar (sin completados ese día)', async () => {
    getDashboard.mockResolvedValue(dashboard({
      turnos_por_estado_por_dia_semana: ritmo.map(d => (d.dia_semana === 6 ? { ...d, completados: 0 } : d)),
      ganancias_por_dia: [],
    }));
    renderWithProviders(<EstadisticasPage />);
    fireEvent.click(await screen.findByTestId('ritmo-dia-6'));
    await screen.findByText('hora pico');
    expect(within(screen.getByTestId('resumen-dia')).queryByText('promedio por turno')).toBeNull();
  });

  it('tocar de nuevo (o el chip) limpia el filtro', async () => {
    renderWithProviders(<EstadisticasPage />);
    fireEvent.click(await screen.findByTestId('ritmo-dia-6'));
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar filtro de sábado' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Quitar filtro/ })).toBeNull());

    fireEvent.click(screen.getByTestId('ritmo-dia-6'));
    await screen.findByText('hora pico');
    fireEvent.click(screen.getByTestId('ritmo-dia-6'));
    await waitFor(() => expect(screen.queryByText('hora pico')).toBeNull());
  });

  it('resalta la columna del día elegido en el heatmap (las demás se atenúan)', async () => {
    renderWithProviders(<EstadisticasPage />);
    fireEvent.click(await screen.findByTestId('ritmo-dia-6'));
    await screen.findByText('hora pico');

    const sabado = screen.getAllByRole('button', { name: /^sábado 1[01]hs/ });
    const martes = screen.getAllByRole('button', { name: /^martes 15hs/ });
    expect(sabado.every(c => c.style.opacity !== '0.3')).toBe(true);
    expect(martes.every(c => c.style.opacity === '0.3')).toBe(true);
  });
});

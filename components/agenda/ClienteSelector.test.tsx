import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderWithProviders, screen } from '@/test/render';
import { useClientesStore } from '@/store/useClienteStore';
import type { Cliente } from '@/services/clienteService';
import { ClienteSelector } from './ClienteSelector';

// jsdom no mide layout: la lista virtualizada se reemplaza por una que dibuja
// todas las filas y avisa hasta cuál se vio (por defecto, hasta la última).
const visibles = vi.hoisted(() => ({ hasta: null as number | null }));
vi.mock('react-window', async () => {
  const React = await import('react');
  return {
    List: ({ rowComponent: Row, rowCount, rowProps, onRowsRendered }: {
      rowComponent: React.ComponentType<Record<string, unknown>>;
      rowCount: number;
      rowProps: Record<string, unknown>;
      onRowsRendered?: (visible: { startIndex: number; stopIndex: number }) => void;
    }) => {
      React.useEffect(() => {
        onRowsRendered?.({ startIndex: 0, stopIndex: visibles.hasta ?? rowCount - 1 });
      });
      return React.createElement(
        'div',
        null,
        Array.from({ length: rowCount }, (_, index) =>
          React.createElement(Row, { key: index, index, style: {}, ariaAttributes: {}, ...rowProps }),
        ),
      );
    },
  };
});

const marta: Cliente = { id: 1, nombre: 'Marta', apellido: 'Rios', telefono: '3764111111', activo: true };
const jose: Cliente = { id: 2, nombre: 'José', apellido: 'Paz', telefono: '3764222222', activo: true };

const labels = {
  placeholder: 'Todos los clientes',
  searchByName: 'Buscar por nombre...',
  noResults: 'No se encontraron clientes.',
  loading: 'Cargando clientes...',
  retry: 'Reintentar',
  newClient: '+ Nuevo cliente',
  clear: 'Quitar el cliente',
};

const cargarPrimeraPagina = vi.fn();
const cargarSiguientePagina = vi.fn();

const abrir = () => fireEvent.click(screen.getByText('Todos los clientes'));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  cargarPrimeraPagina.mockReset();
  cargarSiguientePagina.mockReset();
  visibles.hasta = 0; // por defecto no se llega al final: no pide más páginas
  useClientesStore.setState({
    clientesPagina: [marta, jose], cargandoPagina: false, cargandoMasPagina: false, error: null,
    cargarPrimeraPagina, cargarSiguientePagina,
  });
});
afterEach(() => vi.useRealTimers());

describe('ClienteSelector', () => {
  it('al abrir pide la primera página, solo activos y sin búsqueda, y muestra la lista', () => {
    renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={labels} />);
    abrir();

    expect(cargarPrimeraPagina).toHaveBeenCalledWith('', 'activos');
    expect(screen.getByText('Marta Rios')).toBeInTheDocument();
    expect(screen.getByText('José Paz')).toBeInTheDocument();
  });

  it('la búsqueda va al servidor con debounce, no filtra en el navegador', () => {
    renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={labels} />);
    abrir();
    cargarPrimeraPagina.mockClear();

    const input = screen.getByPlaceholderText('Buscar por nombre...');
    fireEvent.change(input, { target: { value: 'ma' } });
    fireEvent.change(input, { target: { value: 'marta rios ' } });
    expect(cargarPrimeraPagina).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(300); });
    expect(cargarPrimeraPagina).toHaveBeenCalledTimes(1);
    expect(cargarPrimeraPagina).toHaveBeenCalledWith('marta rios', 'activos');
  });

  it('elegir un cliente llama a onChange y cierra la lista', () => {
    const onChange = vi.fn();
    renderWithProviders(<ClienteSelector value={null} onChange={onChange} labels={labels} />);
    abrir();
    fireEvent.click(screen.getByText('Marta Rios'));

    expect(onChange).toHaveBeenCalledWith(marta);
    expect(screen.queryByPlaceholderText('Buscar por nombre...')).not.toBeInTheDocument();
  });

  it('al elegir se cancela una búsqueda pendiente', () => {
    renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={labels} />);
    abrir();
    cargarPrimeraPagina.mockClear();
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre...'), { target: { value: 'ma' } });
    fireEvent.click(screen.getByText('Marta Rios'));
    act(() => { vi.advanceTimersByTime(1000); });

    expect(cargarPrimeraPagina).not.toHaveBeenCalled();
  });

  it('pide la página siguiente cuando se llega al final de la lista', () => {
    visibles.hasta = null; // el mock avisa que se vio hasta la última fila
    renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={labels} />);
    abrir();

    expect(cargarSiguientePagina).toHaveBeenCalled();
  });

  it('no pide más páginas si no se llegó al final', () => {
    renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={{ ...labels }} />);
    useClientesStore.setState({ clientesPagina: [marta, jose, { ...marta, id: 3 }, { ...jose, id: 4 }, { ...marta, id: 5 }, { ...jose, id: 6 }] });
    abrir();

    expect(cargarSiguientePagina).not.toHaveBeenCalled();
  });

  it('con allowClear, la X quita el cliente sin abrir la lista', () => {
    const onChange = vi.fn();
    renderWithProviders(<ClienteSelector value={marta} onChange={onChange} labels={labels} allowClear />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar el cliente' }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByPlaceholderText('Buscar por nombre...')).not.toBeInTheDocument();
  });

  it('sin allowClear no hay X', () => {
    renderWithProviders(<ClienteSelector value={marta} onChange={vi.fn()} labels={labels} />);
    expect(screen.queryByRole('button', { name: 'Quitar el cliente' })).not.toBeInTheDocument();
  });

  it('muestra la alta rápida solo si se pasa onNuevo, y la dispara', () => {
    const onNuevo = vi.fn();
    const { unmount } = renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={labels} />);
    abrir();
    expect(screen.queryByText('+ Nuevo cliente')).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={labels} onNuevo={onNuevo} />);
    abrir();
    fireEvent.click(screen.getByText('+ Nuevo cliente'));
    expect(onNuevo).toHaveBeenCalled();
  });

  it('avisa cuando no hay resultados', () => {
    useClientesStore.setState({ clientesPagina: [] });
    renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={labels} />);
    abrir();

    expect(screen.getByText('No se encontraron clientes.')).toBeInTheDocument();
  });

  it('muestra el error con reintento cuando falla la carga', () => {
    useClientesStore.setState({ clientesPagina: [], error: 'Sin conexión' });
    renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={labels} />);
    abrir();
    cargarPrimeraPagina.mockClear();
    fireEvent.click(screen.getByText('Reintentar'));

    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    expect(cargarPrimeraPagina).toHaveBeenCalledWith('', 'activos');
  });
});

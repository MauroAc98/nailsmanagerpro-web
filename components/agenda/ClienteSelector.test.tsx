import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { useClientesStore } from '@/store/useClienteStore';
import type { Cliente } from '@/services/clienteService';
import { ClienteSelector } from './ClienteSelector';

const marta: Cliente = { id: 1, nombre: 'Marta', apellido: 'Rios', telefono: '3764111111', activo: true };
const jose: Cliente = { id: 2, nombre: 'José', apellido: 'Paz', telefono: '3764222222', activo: true };
const baja: Cliente = { id: 3, nombre: 'Lucía', apellido: 'Baja', telefono: '3764333333', activo: false };

const labels = {
  placeholder: 'Todos los clientes',
  searchByName: 'Buscar por nombre...',
  noResults: 'No se encontraron clientes.',
  loading: 'Cargando clientes...',
  retry: 'Reintentar',
  newClient: '+ Nuevo cliente',
  clear: 'Quitar el cliente',
};

const fetchClientes = vi.fn();

beforeEach(() => {
  fetchClientes.mockReset();
  useClientesStore.setState({ clientes: [marta, jose, baja], loading: false, error: null, fetchClientes });
});

describe('ClienteSelector', () => {
  it('muestra el placeholder y, al abrir, la lista de clientes activos', () => {
    renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={labels} />);
    fireEvent.click(screen.getByText('Todos los clientes'));

    expect(screen.getByText('Marta Rios')).toBeInTheDocument();
    expect(screen.getByText('José Paz')).toBeInTheDocument();
    expect(screen.queryByText('Lucía Baja')).not.toBeInTheDocument();
  });

  it('filtra al tipear, ignorando acentos', () => {
    renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={labels} />);
    fireEvent.click(screen.getByText('Todos los clientes'));
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre...'), { target: { value: 'jose' } });

    expect(screen.getByText('José Paz')).toBeInTheDocument();
    expect(screen.queryByText('Marta Rios')).not.toBeInTheDocument();
  });

  it('elegir un cliente llama a onChange y cierra la lista', () => {
    const onChange = vi.fn();
    renderWithProviders(<ClienteSelector value={null} onChange={onChange} labels={labels} />);
    fireEvent.click(screen.getByText('Todos los clientes'));
    fireEvent.click(screen.getByText('Marta Rios'));

    expect(onChange).toHaveBeenCalledWith(marta);
    expect(screen.queryByPlaceholderText('Buscar por nombre...')).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByText('Todos los clientes'));
    expect(screen.queryByText('+ Nuevo cliente')).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={labels} onNuevo={onNuevo} />);
    fireEvent.click(screen.getByText('Todos los clientes'));
    fireEvent.click(screen.getByText('+ Nuevo cliente'));
    expect(onNuevo).toHaveBeenCalled();
  });

  it('pide los clientes al abrir si todavía no están cargados', () => {
    useClientesStore.setState({ clientes: [] });
    renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={labels} />);
    fireEvent.click(screen.getByText('Todos los clientes'));

    expect(fetchClientes).toHaveBeenCalledTimes(1);
  });

  it('avisa cuando la búsqueda no encuentra a nadie', () => {
    renderWithProviders(<ClienteSelector value={null} onChange={vi.fn()} labels={labels} />);
    fireEvent.click(screen.getByText('Todos los clientes'));
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre...'), { target: { value: 'zzz' } });

    expect(screen.getByText('No se encontraron clientes.')).toBeInTheDocument();
  });
});

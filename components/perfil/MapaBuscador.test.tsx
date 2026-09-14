import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { MapaBuscador } from './MapaBuscador';

// `onBuscar` es la única superficie con Leaflet/geocoding — se inyecta como
// prop para que este componente (input + estado de carga/error) sea
// testeable en jsdom sin tocar el mapa real (mismo motivo por el que
// `MapaPicker` se mockea en SheetDatosPersonales.test.tsx).
function setup(onBuscar = vi.fn()) {
  renderWithProviders(<MapaBuscador onBuscar={onBuscar} />);
  return { onBuscar };
}

describe('MapaBuscador', () => {
  it('renders the search input and button', () => {
    setup();
    expect(screen.getByPlaceholderText('Buscar dirección...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument();
  });

  it('does not call onBuscar for an empty or whitespace-only query', () => {
    const { onBuscar } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.change(screen.getByPlaceholderText('Buscar dirección...'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(onBuscar).not.toHaveBeenCalled();
  });

  it('calls onBuscar with the trimmed query on button click', async () => {
    const onBuscar = vi.fn().mockResolvedValue(true);
    setup(onBuscar);
    fireEvent.change(screen.getByPlaceholderText('Buscar dirección...'), { target: { value: '  Av. Corrientes 1234  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(onBuscar).toHaveBeenCalledWith('Av. Corrientes 1234'));
  });

  it('calls onBuscar on Enter inside the input', async () => {
    const onBuscar = vi.fn().mockResolvedValue(true);
    setup(onBuscar);
    const input = screen.getByPlaceholderText('Buscar dirección...');
    fireEvent.change(input, { target: { value: 'Plaza de Mayo' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onBuscar).toHaveBeenCalledWith('Plaza de Mayo'));
  });

  it('disables the button while the search is in flight', async () => {
    let resolver: (v: boolean) => void = () => {};
    const onBuscar = vi.fn(() => new Promise<boolean>((r) => { resolver = r; }));
    setup(onBuscar);
    fireEvent.change(screen.getByPlaceholderText('Buscar dirección...'), { target: { value: 'algo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled();
    resolver(true);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar' })).not.toBeDisabled());
  });

  it('shows a "not found" message when onBuscar resolves false', async () => {
    const onBuscar = vi.fn().mockResolvedValue(false);
    setup(onBuscar);
    fireEvent.change(screen.getByPlaceholderText('Buscar dirección...'), { target: { value: 'lugar inexistente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('No encontramos esa dirección. Probá con otra.')).toBeInTheDocument();
  });

  it('clears a previous "not found" message once the search succeeds', async () => {
    const onBuscar = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    setup(onBuscar);
    const input = screen.getByPlaceholderText('Buscar dirección...');
    fireEvent.change(input, { target: { value: 'lugar inexistente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('No encontramos esa dirección. Probá con otra.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Plaza de Mayo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(screen.queryByText('No encontramos esa dirección. Probá con otra.')).toBeNull());
  });

  it('clears a previous "not found" message as soon as the user types again', async () => {
    const onBuscar = vi.fn().mockResolvedValue(false);
    setup(onBuscar);
    const input = screen.getByPlaceholderText('Buscar dirección...');
    fireEvent.change(input, { target: { value: 'lugar inexistente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('No encontramos esa dirección. Probá con otra.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'lugar inexistente2' } });
    expect(screen.queryByText('No encontramos esa dirección. Probá con otra.')).toBeNull();
  });
});

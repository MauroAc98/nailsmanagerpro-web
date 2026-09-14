import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { SheetDatosPersonales } from './SheetDatosPersonales';

// The map picker itself is untestable in jsdom (Leaflet needs real layout/
// canvas DOM APIs, design D3) — only `MapaPicker` is mocked so the modal
// chrome (open/confirm/cancel) still renders and exercises real logic.
vi.mock('./MapaPicker', () => ({
  MapaPicker: ({ onPinMovido }: { onPinMovido: (lat: number, lng: number) => void }) => (
    <button type="button" data-testid="mapa-picker-mock" onClick={() => onPinMovido(-27.5, -58.9)}>
      mock map
    </button>
  ),
}));

type Props = Parameters<typeof SheetDatosPersonales>[0];

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    nombreEstudio: 'Estudio Ana',
    setNombreEstudio: vi.fn(),
    codigoPais: '54',
    setCodigoPais: vi.fn(),
    telefono: '',
    setTelefono: vi.fn(),
    onPasteTelefono: vi.fn(),
    direccion: 'Av. Siempreviva 742',
    setDireccion: vi.fn(),
    latitud: null,
    longitud: null,
    setUbicacion: vi.fn(),
    errorUbicacion: null,
    onGuardar: vi.fn(),
    guardando: false,
    onClose: vi.fn(),
    ...overrides,
  };
  renderWithProviders(<SheetDatosPersonales {...props} />);
  return props;
}

describe('SheetDatosPersonales — location status row', () => {
  it('shows "sin cargar" and the "Marcar en el mapa" button when no coordinates are saved', () => {
    setup({ latitud: null, longitud: null });
    expect(screen.getByText('Sin cargar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar en el mapa' })).toBeInTheDocument();
  });

  it('shows "✓ Ubicación cargada" and the "Editar" button when coordinates are saved', () => {
    setup({ latitud: -27.4692, longitud: -58.8306 });
    expect(screen.getByText('✓ Ubicación cargada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('shows a server-side error message near the location row', () => {
    setup({ errorUbicacion: 'Guardá la ubicación completa: faltan coordenadas.' });
    expect(screen.getByText('Guardá la ubicación completa: faltan coordenadas.')).toBeInTheDocument();
  });

  it('renders no error text when errorUbicacion is null', () => {
    setup({ errorUbicacion: null });
    expect(screen.queryByText(/faltan coordenadas/)).toBeNull();
  });
});

describe('SheetDatosPersonales — map modal interaction', () => {
  it('opens the modal when the action button is clicked', async () => {
    setup({ latitud: null, longitud: null });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar en el mapa' }));
    expect(await screen.findByTestId('mapa-picker-mock')).toBeInTheDocument();
  });

  it('calls setUbicacion with the moved pin coordinates on Confirm', async () => {
    const props = setup({ latitud: null, longitud: null });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar en el mapa' }));
    fireEvent.click(await screen.findByTestId('mapa-picker-mock'));
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));

    expect(props.setUbicacion).toHaveBeenCalledWith(-27.5, -58.9);
  });

  it('discards the pin move and does not call setUbicacion on Cancel', async () => {
    const props = setup({ latitud: null, longitud: null });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar en el mapa' }));
    fireEvent.click(await screen.findByTestId('mapa-picker-mock'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(props.setUbicacion).not.toHaveBeenCalled();
    expect(screen.queryByTestId('mapa-picker-mock')).toBeNull();
  });
});

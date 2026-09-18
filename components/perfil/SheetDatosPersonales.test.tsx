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
    onQuitarUbicacion: vi.fn(),
    errorUbicacion: null,
    onGuardar: vi.fn(),
    guardando: false,
    onClose: vi.fn(),
    ...overrides,
  };
  renderWithProviders(<SheetDatosPersonales {...props} />);
  return props;
}

describe('SheetDatosPersonales — location card', () => {
  it('empty state: explains the feature and offers "Marcar en el mapa" + "Usar mi ubicación actual"', () => {
    setup({ latitud: null, longitud: null });
    expect(screen.getByText('Todavía no marcaste tu negocio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar en el mapa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar mi ubicación actual' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar ubicación' })).toBeNull();
  });

  it('loaded state: shows "Ubicación marcada" with move-pin, GPS and remove actions', () => {
    setup({ latitud: -27.4692, longitud: -58.8306 });
    expect(screen.getByText('Ubicación marcada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mover pin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar GPS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar ubicación' })).toBeInTheDocument();
    expect(screen.queryByText('Todavía no marcaste tu negocio')).toBeNull();
  });

  it('loaded state: renders the static map preview when a LocationIQ key is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCATIONIQ_KEY', 'abc123');
    setup({ latitud: -27.4692, longitud: -58.8306 });
    const img = screen.getByRole('img', { name: 'Vista previa de la ubicación' });
    expect(img.getAttribute('src')).toContain('maps.locationiq.com/v3/staticmap');
    vi.unstubAllEnvs();
  });

  it('loaded state: without a key, no preview image is rendered (no broken image)', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCATIONIQ_KEY', '');
    setup({ latitud: -27.4692, longitud: -58.8306 });
    expect(screen.queryByRole('img', { name: 'Vista previa de la ubicación' })).toBeNull();
    vi.unstubAllEnvs();
  });

  it('calls onQuitarUbicacion when the remove button is clicked', () => {
    const props = setup({ latitud: -27.4692, longitud: -58.8306, onQuitarUbicacion: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Quitar ubicación' }));
    expect(props.onQuitarUbicacion).toHaveBeenCalledTimes(1);
  });

  it('"Mover pin" opens the map modal', async () => {
    setup({ latitud: -27.4692, longitud: -58.8306 });
    fireEvent.click(screen.getByRole('button', { name: 'Mover pin' }));
    expect(await screen.findByTestId('mapa-picker-mock')).toBeInTheDocument();
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

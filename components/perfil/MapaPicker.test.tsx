import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderWithProviders, screen } from '@/test/render';

// jsdom no puede ejercitar Leaflet: se reemplaza por un doble que registra qué se
// le pide (URL de tiles, setView) y deja disparar a mano el evento `load` de la capa.
const m = vi.hoisted(() => {
  const handlersCapa: Record<string, () => void> = {};
  const mapa = { setView: vi.fn(), on: vi.fn(), remove: vi.fn() };
  mapa.setView.mockReturnValue(mapa);
  const capa = { addTo: vi.fn(), on: vi.fn() };
  capa.addTo.mockReturnValue(capa);
  capa.on.mockImplementation((evento: string, fn: () => void) => { handlersCapa[evento] = fn; return capa; });
  const marcador = { addTo: vi.fn(), on: vi.fn(), setLatLng: vi.fn(), getLatLng: vi.fn() };
  marcador.addTo.mockReturnValue(marcador);
  return { handlersCapa, mapa, capa, marcador, tileLayer: vi.fn(() => capa), obtenerGps: vi.fn() };
});

vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => m.mapa),
    tileLayer: m.tileLayer,
    marker: vi.fn(() => m.marcador),
    divIcon: vi.fn(() => ({})),
  },
}));
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('@/lib/obtenerGps', () => ({ obtenerGps: m.obtenerGps }));

import { MapaPicker } from './MapaPicker';

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  for (const k of Object.keys(m.handlersCapa)) delete m.handlersCapa[k];
  m.obtenerGps.mockResolvedValue(null);
});
afterEach(() => vi.useRealTimers());

const montar = (lat: number | null = null, lng: number | null = null) =>
  renderWithProviders(<MapaPicker latitud={lat} longitud={lng} onPinMovido={vi.fn()} />);

describe('MapaPicker — tiles', () => {
  it('pide los tiles con {r}, para que en pantallas retina lleguen a 512 px y no se vean pixelados', () => {
    montar();

    const [url] = m.tileLayer.mock.calls[0] as unknown as [string];
    expect(url).toContain('{r}');
  });
});

describe('MapaPicker — loader inicial', () => {
  it('muestra un loader hasta que la capa de tiles termina de cargar los primeros', () => {
    montar();
    expect(screen.getByRole('status', { name: 'Cargando mapa' })).toBeInTheDocument();

    act(() => m.handlersCapa.load());

    expect(screen.queryByRole('status', { name: 'Cargando mapa' })).not.toBeInTheDocument();
  });

  it('si el evento load nunca llega, el loader se va solo y no deja el mapa tapado', () => {
    montar();

    act(() => { vi.advanceTimersByTime(8000); });

    expect(screen.queryByRole('status', { name: 'Cargando mapa' })).not.toBeInTheDocument();
  });

  it('no deja timers colgados al cerrar el mapa', () => {
    const { unmount } = montar();
    unmount();

    expect(() => vi.advanceTimersByTime(10000)).not.toThrow();
    expect(m.mapa.remove).toHaveBeenCalled();
  });
});

describe('MapaPicker — GPS inicial', () => {
  it('sin ubicación guardada, recentra por GPS sin animar (la animación ampliaba los tiles viejos y se veía pixelado)', async () => {
    m.obtenerGps.mockResolvedValue({ lat: -27.5, lon: -58.9 });
    montar();
    await act(async () => { await Promise.resolve(); });

    expect(m.mapa.setView).toHaveBeenLastCalledWith([-27.5, -58.9], 16, { animate: false });
  });

  it('con ubicación guardada no pide el GPS y abre directo en zoom 16', () => {
    montar(-27.4, -58.8);

    expect(m.obtenerGps).not.toHaveBeenCalled();
    expect(m.mapa.setView).toHaveBeenCalledWith([-27.4, -58.8], 16);
  });
});

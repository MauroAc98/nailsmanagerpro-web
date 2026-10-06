import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { nombreMes } from '@/lib/dateFormat';
import { safeAreaInsets } from '@/lib/historia/safeArea';
import {
  EncabezadoHistoria, ENCABEZADO_TILE, ENCABEZADO_GAP, alturaZonaEncabezado, reservaSuperiorEncabezado,
} from './EncabezadoHistoria';

const ALTO = 747;
const ahora = new Date();
const periodo = `${nombreMes(ahora, 'long')} ${ahora.getFullYear()}`;

function renderEncabezado(props: Partial<React.ComponentProps<typeof EncabezadoHistoria>> = {}) {
  return renderWithProviders(
    <EncabezadoHistoria titulo="Lista de precios" canvasHeight={ALTO} {...props} />,
  );
}
const titulo = () => screen.getByTestId('encabezado-titulo');
const linea = () => screen.getByTestId('encabezado-linea');

describe('EncabezadoHistoria · reserva compartida', () => {
  it('la reserva es safe.top + recuadro + separación, y el encabezado arranca en safe.top', () => {
    const safe = safeAreaInsets(ALTO);
    expect(reservaSuperiorEncabezado(ALTO)).toBe(safe.top + ENCABEZADO_TILE + ENCABEZADO_GAP);
    renderEncabezado();
    const raiz = screen.getByTestId('encabezado-historia');
    expect(raiz.style.top).toBe(`${safe.top}px`);
    expect(raiz.style.height).toBe(`${ENCABEZADO_TILE}px`);
  });

  it('la zona de la franja desenfocada cubre todo el encabezado', () => {
    expect(alturaZonaEncabezado(ALTO)).toBeGreaterThan(reservaSuperiorEncabezado(ALTO) - ENCABEZADO_GAP);
    expect(alturaZonaEncabezado(ALTO)).toBe(safeAreaInsets(ALTO).top + Math.round(ALTO * 0.10));
  });
});

describe('EncabezadoHistoria · contenido', () => {
  it("modo una sin profesional: título 'Lista de precios' y la línea es solo el período", () => {
    renderEncabezado();
    expect(titulo().textContent).toBe('Lista de precios');
    expect(linea().textContent).toBe(periodo);
  });

  it("modo una con profesional: 'con Ana · Período'", () => {
    renderEncabezado({ profesionalNombre: 'Ana' });
    expect(linea().textContent).toBe(`con Ana · ${periodo}`);
  });

  it("modo categoría: título = categoría; línea 'Lista de precios · con Ana · Período'", () => {
    renderEncabezado({ subtitulo: 'Pies', profesionalNombre: 'Ana' });
    expect(titulo().textContent).toBe('Pies');
    expect(linea().textContent).toBe(`Lista de precios · con Ana · ${periodo}`);
  });

  it("modo categoría sin profesional: 'Lista de precios · Período'", () => {
    renderEncabezado({ subtitulo: 'Pies' });
    expect(linea().textContent).toBe(`Lista de precios · ${periodo}`);
  });
});

describe('EncabezadoHistoria · estilo sobre la foto', () => {
  it('texto blanco con sombra, en serif y en una sola línea', () => {
    renderEncabezado();
    expect(titulo().style.color).toBe('rgb(255, 255, 255)');
    expect(titulo().style.textShadow).toMatch(/2px 6px.*0\.85|0\.85.*2px 6px/);
    expect(titulo().style.whiteSpace).toBe('nowrap');
    expect(titulo().style.fontSize).toBe('20px');
    expect(linea().style.color).toBe('rgba(255, 255, 255, 0.9)');
    expect(linea().style.textShadow).toMatch(/2px 6px.*0\.85|0\.85.*2px 6px/);
    expect(linea().style.whiteSpace).toBe('nowrap');
    expect(linea().style.fontSize).toBe('11px');
    expect(linea().style.textOverflow).toBe('ellipsis');
  });

  it('con foto: recuadro 44x44, radio 12, borde blanco translúcido y cover', () => {
    renderEncabezado({ logoUrl: 'data:image/png;base64,eA==' });
    const img = screen.getByTestId('encabezado-foto') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('data:image/png;base64,eA==');
    expect(img.style.width).toBe('44px');
    expect(img.style.height).toBe('44px');
    expect(img.style.borderRadius).toBe('12px');
    expect(img.style.objectFit).toBe('cover');
    expect(img.style.border).toContain('1.5px solid');
    expect(img.style.filter).toBe('');
    expect(screen.queryByTestId('encabezado-icono')).toBeNull();
  });

  it('sin foto: recuadro translúcido con el ícono Tag blanco', () => {
    renderEncabezado({ logoUrl: null });
    expect(screen.queryByTestId('encabezado-foto')).toBeNull();
    const icono = screen.getByTestId('encabezado-icono');
    expect(icono.style.width).toBe('44px');
    expect(icono.style.borderRadius).toBe('12px');
    expect(icono.style.backgroundColor).toBe('rgba(255, 255, 255, 0.18)');
    expect(icono.querySelector('svg')?.getAttribute('class')).toContain('lucide-tag');
  });

  it('contador de serie: solo con serie, "1/4", blanco sobre translúcido', () => {
    const { unmount } = renderEncabezado({ subtitulo: 'Pies' });
    expect(screen.queryByTestId('encabezado-serie')).toBeNull();
    unmount();
    renderEncabezado({ subtitulo: 'Pies', serie: { actual: 1, total: 4 } });
    const pill = screen.getByTestId('encabezado-serie');
    expect(pill.textContent).toBe('1/4');
    expect(pill.style.borderRadius).toBe('999px');
    expect(pill.style.backgroundColor).toBe('rgba(255, 255, 255, 0.2)');
    expect(pill.style.color).toBe('rgb(255, 255, 255)');
  });
});

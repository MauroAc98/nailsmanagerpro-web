import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { nombreMes } from '@/lib/dateFormat';
import { safeAreaInsets } from '@/lib/historia/safeArea';
import {
  EncabezadoHistoria, ENCABEZADO_TILE, ENCABEZADO_GAP, ENCABEZADO_SUBIDA, alturaZonaEncabezado, reservaSuperiorEncabezado,
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
  it('la reserva es safe.top + recuadro + separación, y el encabezado arranca en safe.top menos la subida', () => {
    const safe = safeAreaInsets(ALTO);
    expect(reservaSuperiorEncabezado(ALTO)).toBe(safe.top - ENCABEZADO_SUBIDA + ENCABEZADO_TILE + ENCABEZADO_GAP);
    renderEncabezado();
    const raiz = screen.getByTestId('encabezado-historia');
    expect(raiz.style.top).toBe(`${safe.top - ENCABEZADO_SUBIDA}px`);
    expect(raiz.style.height).toBe(`${ENCABEZADO_TILE}px`);
  });

  it('la zona de la franja desenfocada cubre todo el encabezado', () => {
    expect(alturaZonaEncabezado(ALTO)).toBeGreaterThan(reservaSuperiorEncabezado(ALTO) - ENCABEZADO_GAP);
    expect(alturaZonaEncabezado(ALTO)).toBe(safeAreaInsets(ALTO).top - ENCABEZADO_SUBIDA + Math.round(ALTO * 0.10));
  });
});

describe('EncabezadoHistoria · contenido', () => {
  // El aire entre piezas de la etiqueta es una rayita dibujada (no texto), así
  // que el textContent las une sin separador.
  it("modo una sin profesional: título 'Lista de precios' y la etiqueta es solo el período", () => {
    renderEncabezado();
    expect(titulo().textContent).toBe('Lista de precios');
    expect(linea().textContent).toBe(periodo);
  });

  it("modo una con profesional: 'Período — con Ana'", () => {
    renderEncabezado({ profesionalNombre: 'Ana' });
    expect(linea().textContent).toBe(`${periodo}con Ana`);
    expect(linea().querySelector('b')?.textContent).toBe('Ana');
  });

  it("modo categoría: título 'Precios de Pies' (espejo de 'Turnos de Lash'); etiqueta 'Período — con Ana'", () => {
    renderEncabezado({ subtitulo: 'Pies', profesionalNombre: 'Ana' });
    expect(titulo().textContent).toBe('Precios de Pies');
    expect(titulo().querySelector('em')?.textContent).toBe('Pies');
    expect(linea().textContent).toBe(`${periodo}con Ana`);
  });

  it("modo categoría sin profesional: la etiqueta es solo el período", () => {
    renderEncabezado({ subtitulo: 'Pies' });
    expect(linea().textContent).toBe(periodo);
  });

  it('modo una: el título lleva la última palabra en cursiva', () => {
    renderEncabezado();
    expect(titulo().querySelector('em')?.textContent).toBe('precios');
  });

  it('la etiqueta va sobre el título y la insignia queda a la derecha', () => {
    renderEncabezado({ logoUrl: 'data:image/png;base64,eA==' });
    const foto = screen.getByTestId('encabezado-foto');
    expect(linea().compareDocumentPosition(titulo()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(titulo().compareDocumentPosition(foto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('EncabezadoHistoria · estilo sobre la foto', () => {
  it('texto blanco con sombra, en serif y en una sola línea', () => {
    renderEncabezado();
    expect(titulo().style.color).toBe('rgb(255, 255, 255)');
    expect(titulo().style.textShadow).toMatch(/2px 6px.*0\.85|0\.85.*2px 6px/);
    expect(titulo().style.whiteSpace).toBe('nowrap');
    expect(titulo().style.fontSize).toBe('24px');
    expect(linea().style.color).toBe('rgba(255, 255, 255, 0.72)');
    expect(linea().style.textShadow).toMatch(/2px 6px.*0\.85|0\.85.*2px 6px/);
    expect(linea().style.whiteSpace).toBe('nowrap');
    expect(linea().style.fontSize).toBe('8px');
    expect(linea().style.textTransform).toBe('uppercase');
    expect(linea().style.textOverflow).toBe('ellipsis');
  });

  it('con foto: círculo de 44x44 con anillo (box-shadow, nunca filter) y cover', () => {
    renderEncabezado({ logoUrl: 'data:image/png;base64,eA==' });
    const img = screen.getByTestId('encabezado-foto') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('data:image/png;base64,eA==');
    expect(img.style.width).toBe('44px');
    expect(img.style.height).toBe('44px');
    expect(img.style.borderRadius).toBe('50%');
    expect(img.style.objectFit).toBe('cover');
    expect(img.style.boxShadow).not.toBe('');
    expect(img.style.filter).toBe('');
    expect(screen.queryByTestId('encabezado-icono')).toBeNull();
  });

  it('sin foto: círculo de vidrio con anillo y el ícono Tag blanco', () => {
    renderEncabezado({ logoUrl: null });
    expect(screen.queryByTestId('encabezado-foto')).toBeNull();
    const icono = screen.getByTestId('encabezado-icono');
    expect(icono.style.width).toBe('44px');
    expect(icono.style.borderRadius).toBe('50%');
    expect(icono.style.boxShadow).not.toBe('');
    expect(icono.querySelector('svg')?.getAttribute('class')).toContain('lucide-tag');
  });

  it('contador de serie: solo con serie, "1/4" como texto al final de la etiqueta (sin pill)', () => {
    const { unmount } = renderEncabezado({ subtitulo: 'Pies' });
    expect(screen.queryByTestId('encabezado-serie')).toBeNull();
    unmount();
    renderEncabezado({ subtitulo: 'Pies', serie: { actual: 1, total: 4 } });
    const serie = screen.getByTestId('encabezado-serie');
    expect(serie.textContent).toBe('1/4');
    expect(linea().contains(serie)).toBe(true);
    expect(serie.style.borderRadius).toBe('');
    expect(serie.style.backgroundColor).toBe('');
    expect(serie.style.color).toBe('rgb(255, 255, 255)');
  });
});

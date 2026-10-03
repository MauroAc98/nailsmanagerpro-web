import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MontoFit } from './MontoFit';

// jsdom no calcula layout: se simulan los anchos. Cada px de fuente ocupa 10px
// de ancho de texto, y el contenedor mide `anchoDisponible`.
function simularAnchos(anchoDisponible: number) {
  const proto = HTMLElement.prototype;
  const originales = {
    scrollWidth: Object.getOwnPropertyDescriptor(proto, 'scrollWidth'),
    clientWidth: Object.getOwnPropertyDescriptor(proto, 'clientWidth'),
  };
  Object.defineProperty(proto, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) { return (Number.parseFloat(this.style.fontSize) || 0) * 10; },
  });
  Object.defineProperty(proto, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) { return this.dataset.contenedor ? anchoDisponible : 0; },
  });
  return () => {
    for (const [k, d] of Object.entries(originales)) {
      if (d) Object.defineProperty(proto, k, d); else delete (proto as unknown as Record<string, unknown>)[k];
    }
  };
}

let restaurar: (() => void) | null = null;
afterEach(() => { restaurar?.(); restaurar = null; });

function renderMonto(ancho: number) {
  restaurar = simularAnchos(ancho);
  return render(
    <div data-contenedor="1">
      <MontoFit maxFontSize={38} minFontSize={12}>$12.345.678,00</MontoFit>
    </div>,
  );
}

describe('MontoFit — un monto nunca se corta', () => {
  it('si entra, queda en el tamaño máximo', () => {
    renderMonto(500);
    expect(screen.getByText('$12.345.678,00').style.fontSize).toBe('38px');
  });

  it('si no entra, baja el tamaño hasta que entre en el ancho disponible', () => {
    renderMonto(200);
    // 10px de ancho por px de fuente: el mayor tamaño que entra en 200 es 20.
    expect(screen.getByText('$12.345.678,00').style.fontSize).toBe('20px');
  });

  it('nunca usa puntos suspensivos ni recorta el texto', () => {
    renderMonto(200);
    const el = screen.getByText('$12.345.678,00');
    expect(el.style.textOverflow).not.toBe('ellipsis');
    expect(el.style.overflow).not.toBe('hidden');
  });

  it('si ni en el tamaño mínimo entra, deja que el número baje de renglón en vez de recortarse', () => {
    renderMonto(50);
    const el = screen.getByText('$12.345.678,00');
    expect(el.style.fontSize).toBe('12px');
    expect(el.style.whiteSpace).toBe('normal');
    expect(el.style.overflowWrap).toBe('anywhere');
  });

  it('mientras entra en una línea se mantiene sin partirse', () => {
    renderMonto(500);
    expect(screen.getByText('$12.345.678,00').style.whiteSpace).toBe('nowrap');
  });
});

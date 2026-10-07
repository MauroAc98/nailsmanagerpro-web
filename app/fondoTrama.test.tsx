import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';

// Fondo con trama de íconos de turnos (calendario, reloj, mensaje, campana,
// check). Se aplica DESDE CSS a cualquier contenedor que pinte el color de
// fondo de la app, así no hay que tocar las ~60 pantallas que lo hacen. Estos
// tests cuidan lo frágil de ese enfoque: que los selectores sigan encontrando
// lo que React realmente escribe en el atributo style, y que los archivos
// existan.
const RAIZ = process.cwd();
const css = readFileSync(join(RAIZ, 'app/globals.css'), 'utf-8');

// Los dos tokens con los que las pantallas pintan su fondo: el del rediseño de
// Agenda (--ag-bg) y el del tema base (--color-background).
const SELECTORES = [
  '[style*="background-color: var(--ag-bg)"]',
  '[style*="background-color: var(--color-background)"]',
];

describe('fondo con trama', () => {
  it.each(['claro', 'oscuro'])('existe el archivo de la trama en modo %s', (modo) => {
    const ruta = join(RAIZ, `public/fondo-trama-${modo}.svg`);
    expect(existsSync(ruta)).toBe(true);
    const svg = readFileSync(ruta, 'utf-8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 160 136"');
  });

  it('el modo claro usa trazo oscuro y el oscuro trazo claro, sutiles', () => {
    const claro = readFileSync(join(RAIZ, 'public/fondo-trama-claro.svg'), 'utf-8');
    const oscuro = readFileSync(join(RAIZ, 'public/fondo-trama-oscuro.svg'), 'utf-8');
    expect(claro).toContain('#4a3f42');
    expect(oscuro).toContain('#e9e1e4');
    const opacidad = (s: string) => Number(/opacity="([0-9.]+)"/.exec(s)?.[1]);
    expect(opacidad(claro)).toBeGreaterThan(0.04);
    expect(opacidad(claro)).toBeLessThanOrEqual(0.12);
    expect(opacidad(oscuro)).toBeGreaterThan(0.04);
    expect(opacidad(oscuro)).toBeLessThanOrEqual(0.12);
  });

  it('globals.css declara los selectores de ambos tokens y los dos archivos', () => {
    for (const s of SELECTORES) expect(css).toContain(s);
    expect(css).toContain('/fondo-trama-claro.svg');
    expect(css).toContain('/fondo-trama-oscuro.svg');
  });

  it('el modo oscuro se activa con data-theme="dark" del html', () => {
    expect(css).toMatch(/html\[data-theme="dark"\]\s+\[style\*="background-color: var\(--ag-bg\)"\]/);
  });

  it.each([
    ['--ag-bg', SELECTORES[0]],
    ['--color-background', SELECTORES[1]],
  ])('un contenedor con backgroundColor var(%s) coincide con su selector', (token, selector) => {
    const { container } = render(<div style={{ backgroundColor: `var(${token})` }} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.matches(selector)).toBe(true);
  });

  // El HTML que genera el servidor (SSR) escribe el style SIN espacio tras los
  // dos puntos (`background-color:var(--ag-bg)`); el DOM del navegador lo
  // serializa CON espacio. Hace falta cubrir los dos o la primera pantalla que
  // se carga (la que viene del servidor) quedaría sin trama.
  it.each(['--ag-bg', '--color-background'])('el HTML del servidor (sin espacio) para var(%s) también coincide', (token) => {
    const html = renderToStaticMarkup(<div style={{ backgroundColor: `var(${token})` }} />);
    expect(html).toContain(`background-color:var(${token})`);
    const host = document.createElement('div');
    host.innerHTML = html;
    const el = host.firstElementChild as HTMLElement;
    const sinEspacio = `[style*="background-color:var(${token})"]`;
    expect(css).toContain(sinEspacio);
    expect(el.matches(sinEspacio)).toBe(true);
  });

  it('el body también lleva la trama (pantallas sin contenedor propio), en claro y en oscuro', () => {
    expect(css).toMatch(/\nbody\s*\{[^}]*fondo-trama-claro\.svg/);
    expect(css).toMatch(/html\[data-theme="dark"\]\s+body\s*\{[^}]*fondo-trama-oscuro\.svg/);
  });

  it('hay una forma de excluir un elemento (data-sin-trama), p. ej. una barra que usa el mismo color', () => {
    expect(css).toMatch(/\[data-sin-trama\]\s*\{[^}]*background-image:\s*none\s*!important/);
  });

  it('una tarjeta (superficie) NO recibe la trama', () => {
    const { container } = render(<div style={{ backgroundColor: 'var(--ag-surface)' }} />);
    const el = container.firstElementChild as HTMLElement;
    for (const s of SELECTORES) expect(el.matches(s)).toBe(false);
  });

  it('la trama no intercepta toques ni cambia el layout: solo es background-image', () => {
    // No se usan pseudo-elementos ni capas fijas encima del contenido.
    expect(css).not.toMatch(/fondo-trama[^;]*\n?[^}]*position:\s*fixed/);
  });
});

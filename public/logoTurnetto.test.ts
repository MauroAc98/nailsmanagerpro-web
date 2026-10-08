import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import sharp from 'sharp';

// El logo transparente se dibuja sobre fondos claros (hueso) y oscuros. Si sus
// píxeles de borde no son del verde de la marca (halo claro, restos del fondo
// blanco original) o si el borde es escalonado (alfa solo 0 o 255), se nota
// sobre todo en modo oscuro.
const VERDE = { r: 107, g: 143, b: 106 };
const TOLERANCIA = 8;

async function cargarLogo() {
  const { data, info } = await sharp(join(process.cwd(), 'public', 'logo-turnetto.png'))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, ancho: info.width, alto: info.height };
}

describe('public/logo-turnetto.png', () => {
  it('conserva la proporción 635:499 que usan las pantallas que lo muestran', async () => {
    const { ancho, alto } = await cargarLogo();

    expect(ancho / alto).toBeCloseTo(635 / 499, 2);
  });

  it('todo píxel visible es del verde de la marca (sin halo claro en el borde)', async () => {
    const { data } = await cargarLogo();
    let visibles = 0;
    let fueraDelVerde = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      visibles += 1;
      if (
        Math.abs(data[i] - VERDE.r) > TOLERANCIA ||
        Math.abs(data[i + 1] - VERDE.g) > TOLERANCIA ||
        Math.abs(data[i + 2] - VERDE.b) > TOLERANCIA
      ) fueraDelVerde += 1;
    }

    expect(visibles).toBeGreaterThan(0);
    expect(fueraDelVerde).toBe(0);
  });

  it('el borde está suavizado: hay píxeles semitransparentes, no solo 0 o 255', async () => {
    const { data } = await cargarLogo();
    let visibles = 0;
    let semitransparentes = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      visibles += 1;
      if (data[i + 3] < 255) semitransparentes += 1;
    }

    expect(semitransparentes / visibles).toBeGreaterThan(0.005);
  });

  it('no quedan píxeles sueltos en las esquinas (el resplandor de la fuente se descartó)', async () => {
    const { data, ancho, alto } = await cargarLogo();
    const bloque = 40;
    const hayVisible = (x0: number, y0: number) => {
      for (let y = y0; y < y0 + bloque; y += 1) {
        for (let x = x0; x < x0 + bloque; x += 1) {
          if (data[(y * ancho + x) * 4 + 3] > 0) return true;
        }
      }
      return false;
    };

    expect(hayVisible(0, 0)).toBe(false);
    expect(hayVisible(ancho - bloque, 0)).toBe(false);
    expect(hayVisible(0, alto - bloque)).toBe(false);
    expect(hayVisible(ancho - bloque, alto - bloque)).toBe(false);
  });

  it('tiene resolución para pantallas de alta densidad (al menos el doble de los 635 px originales)', async () => {
    const { ancho } = await cargarLogo();

    expect(ancho).toBeGreaterThanOrEqual(1270);
  });
});

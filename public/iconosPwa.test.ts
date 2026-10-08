import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import sharp from 'sharp';

// Android arma el splash de la PWA con el background_color del manifest (hueso,
// #faf6f0) y el ícono centrado. Si el ícono trae su propio fondo blanco, se ve un
// cuadrado blanco sobre el hueso. iOS usa el mismo archivo como ícono de inicio.
const HUESO = { r: 250, g: 246, b: 240 };
const TOLERANCIA = 3;

describe.each(['icon-192.png', 'icon-512.png'])('public/%s', (archivo) => {
  const cargar = async () => {
    const { data, info } = await sharp(join(process.cwd(), 'public', archivo))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data, ancho: info.width, alto: info.height };
  };
  const pixel = (d: Buffer, ancho: number, x: number, y: number) => {
    const i = (y * ancho + x) * 3;
    return { r: d[i], g: d[i + 1], b: d[i + 2] };
  };

  it('el fondo es el hueso del splash, no blanco', async () => {
    const { data, ancho, alto } = await cargar();
    for (const [x, y] of [[2, 2], [ancho - 3, 2], [2, alto - 3], [ancho - 3, alto - 3]]) {
      const p = pixel(data, ancho, x, y);
      expect(Math.abs(p.r - HUESO.r)).toBeLessThanOrEqual(TOLERANCIA);
      expect(Math.abs(p.g - HUESO.g)).toBeLessThanOrEqual(TOLERANCIA);
      expect(Math.abs(p.b - HUESO.b)).toBeLessThanOrEqual(TOLERANCIA);
    }
  });

  it('no queda ningún píxel blanco puro (restos del fondo anterior)', async () => {
    const { data } = await cargar();
    let blancos = 0;
    for (let i = 0; i < data.length; i += 3) {
      if (data[i] >= 253 && data[i + 1] >= 253 && data[i + 2] >= 253) blancos += 1;
    }

    expect(blancos).toBe(0);
  });

  it('conserva la "t" verde de la marca', async () => {
    const { data } = await cargar();
    let verdes = 0;
    for (let i = 0; i < data.length; i += 3) {
      if (Math.abs(data[i] - 107) < 12 && Math.abs(data[i + 1] - 143) < 12 && Math.abs(data[i + 2] - 106) < 12) verdes += 1;
    }

    expect(verdes / (data.length / 3)).toBeGreaterThan(0.05);
  });
});

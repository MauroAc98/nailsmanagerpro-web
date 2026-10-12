import { describe, expect, it } from 'vitest';
import { HISTORIA_ALTO, HISTORIA_ANCHO, HISTORIA_EXPORT_ANCHO, PIXEL_RATIO_EXPORT, escalaVistaPrevia } from './formatoHistoria';

describe('formato fijo de la historia', () => {
  it('es 9:16 exacto y se exporta a 1080 x 1920', () => {
    expect(HISTORIA_ANCHO * 16).toBe(HISTORIA_ALTO * 9);
    expect(HISTORIA_ANCHO * PIXEL_RATIO_EXPORT).toBe(HISTORIA_EXPORT_ANCHO);
    expect(HISTORIA_ALTO * PIXEL_RATIO_EXPORT).toBe(1920);
  });

  it('la vista previa ocupa el 85% del ancho de pantalla, con tope de 420px', () => {
    expect(escalaVistaPrevia(390)).toBeCloseTo((390 * 0.85) / HISTORIA_ANCHO);
    expect(escalaVistaPrevia(1440)).toBeCloseTo(420 / HISTORIA_ANCHO);
  });

  it('sin ancho de pantalla todavía (primer render) usa escala 1', () => {
    expect(escalaVistaPrevia(0)).toBe(1);
  });
});

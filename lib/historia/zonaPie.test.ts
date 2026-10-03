import { describe, expect, it } from 'vitest';
import { zonaPieDesdeLinea } from './zonaPie';

describe('zonaPieDesdeLinea', () => {
  it('alto desde la línea hasta el borde inferior del canvas', () => {
    expect(zonaPieDesdeLinea({ bottomRaiz: 640, topLinea: 540, alturaRenderizada: 640, alturaCanvas: 640 })).toBe(100);
  });

  it('corrige por la escala si el canvas se ve achicado o agrandado', () => {
    // Se renderiza a la mitad: 50px medidos son 100px del canvas.
    expect(zonaPieDesdeLinea({ bottomRaiz: 320, topLinea: 270, alturaRenderizada: 320, alturaCanvas: 640 })).toBe(100);
  });

  it('redondea al píxel', () => {
    expect(zonaPieDesdeLinea({ bottomRaiz: 640, topLinea: 540.4, alturaRenderizada: 640, alturaCanvas: 640 })).toBe(100);
  });

  it('null sin layout real (alto 0) o con medidas inválidas', () => {
    expect(zonaPieDesdeLinea({ bottomRaiz: 0, topLinea: 0, alturaRenderizada: 0, alturaCanvas: 640 })).toBeNull();
    expect(zonaPieDesdeLinea({ bottomRaiz: 640, topLinea: 700, alturaRenderizada: 640, alturaCanvas: 640 })).toBeNull();
    expect(zonaPieDesdeLinea({ bottomRaiz: 640, topLinea: 540, alturaRenderizada: 640, alturaCanvas: 0 })).toBeNull();
  });
});

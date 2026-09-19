import { describe, expect, it } from 'vitest';
import { LOGO_ASPECT_RATIO, tamanoCanvasParaAspecto } from './logo';

// recortarLogo en si depende de canvas/Image del DOM real (no disponible en
// jsdom) — igual que el resto de esta capa (ver reducirImagen en
// lib/reservaOnline/fotos.ts, que degrada con try/catch por el mismo motivo),
// asi que no hay un test end-to-end de recortarLogo en este repo. Lo que SI
// es una funcion pura testeable es el calculo del tamaño de lienzo a partir
// del aspect ratio pedido — generalizado para reusar el cropper con avatares
// (1/1) ademas del logo (3/2 default).
describe('tamanoCanvasParaAspecto', () => {
  it('con el aspect ratio del logo (3/2) da 1200x800', () => {
    expect(tamanoCanvasParaAspecto(LOGO_ASPECT_RATIO)).toEqual({ width: 1200, height: 800 });
  });

  it('con aspect ratio 1/1 (avatar circular) da un lienzo cuadrado', () => {
    expect(tamanoCanvasParaAspecto(1)).toEqual({ width: 1200, height: 1200 });
  });
});

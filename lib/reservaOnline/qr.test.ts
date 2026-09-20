import { describe, expect, it } from 'vitest';
import { generarQrDataUrl } from './qr';

// La libreria `qrcode` es determinista y no se mockea: se espera su salida
// real (una data URL PNG en base64). No probamos contenido de pixeles, solo
// forma y que dos URLs distintas generen imagenes distintas.
describe('generarQrDataUrl', () => {
  it('resuelve a una data URL de imagen', async () => {
    const dataUrl = await generarQrDataUrl('https://reservar.turnetto.com/mi-salon');
    expect(dataUrl.startsWith('data:image/')).toBe(true);
  });

  it('produce salidas distintas para links distintos', async () => {
    const a = await generarQrDataUrl('https://reservar.turnetto.com/salon-a');
    const b = await generarQrDataUrl('https://reservar.turnetto.com/salon-b');
    expect(a).not.toBe(b);
  });
});

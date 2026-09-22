import { describe, expect, it } from 'vitest';
import { esCheckoutUrlValida } from './checkoutUrl';

describe('esCheckoutUrlValida', () => {
  it('acepta un path interno (adapter mock)', () => {
    expect(esCheckoutUrlValida('/reservar/demo/reserva/abc123?mock=1')).toBe(true);
  });

  it('acepta un link https de Mercado Pago', () => {
    expect(esCheckoutUrlValida('https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=PREF-1')).toBe(true);
  });

  it('rechaza un protocolo peligroso', () => {
    expect(esCheckoutUrlValida('javascript:alert(1)')).toBe(false);
  });

  it('rechaza http sin cifrar', () => {
    expect(esCheckoutUrlValida('http://www.mercadopago.com.ar/checkout')).toBe(false);
  });

  it('rechaza un path protocol-relative que resuelve a otro origen', () => {
    expect(esCheckoutUrlValida('//evil.com/phishing')).toBe(false);
  });

  it('rechaza vacio', () => {
    expect(esCheckoutUrlValida('')).toBe(false);
  });
});

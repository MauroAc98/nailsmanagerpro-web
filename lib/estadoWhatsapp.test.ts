import { describe, expect, it } from 'vitest';
import { estadoWhatsapp, statusWhatsappDeVisita } from './estadoWhatsapp';

describe('estadoWhatsapp', () => {
  it.each([
    ['pending', 'enviado'],
    ['delivered', 'entregado'],
    ['read', 'leido'],
    ['failed', 'fallo'],
    ['manual', 'enviado'],
  ])('%s se ve como %s', (status, esperado) => {
    expect(estadoWhatsapp(status)).toBe(esperado);
  });

  it.each([[null], [undefined], [''], ['algo raro'], ['toString']])('%s no muestra nada', (status) => {
    expect(estadoWhatsapp(status)).toBeNull();
  });
});

describe('statusWhatsappDeVisita', () => {
  it('prefiere un fallo aunque haya otros estados antes', () => {
    expect(statusWhatsappDeVisita(['read', 'failed', 'delivered'])).toBe('failed');
  });

  it('sin fallos usa el primer turno que tenga estado', () => {
    expect(statusWhatsappDeVisita([null, undefined, 'delivered', 'read'])).toBe('delivered');
  });

  it('ignora estados desconocidos', () => {
    expect(statusWhatsappDeVisita(['raro', 'pending'])).toBe('pending');
  });

  it('devuelve null si ningun turno tiene estado', () => {
    expect(statusWhatsappDeVisita([null, undefined])).toBeNull();
    expect(statusWhatsappDeVisita([])).toBeNull();
  });
});

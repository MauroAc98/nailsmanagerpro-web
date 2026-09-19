import { describe, expect, it } from 'vitest';
import { linkReserva, linkReservaCorto } from './linkPublico';

describe('linkReserva', () => {
  it('con base configurada arma <base>/<slug>', () => {
    expect(linkReserva('natalia', { base: 'https://reservar.turnetto.com', origin: 'http://localhost:3000' })).toBe(
      'https://reservar.turnetto.com/natalia',
    );
  });
  it('ignora la barra final de la base', () => {
    expect(linkReserva('natalia', { base: 'https://reservar.turnetto.com/', origin: 'x' })).toBe(
      'https://reservar.turnetto.com/natalia',
    );
  });
  it('sin base cae al origen actual + /reservar', () => {
    expect(linkReserva('natalia', { origin: 'http://localhost:3000' })).toBe('http://localhost:3000/reservar/natalia');
  });
  it('base vacia se trata como no configurada', () => {
    expect(linkReserva('natalia', { base: '', origin: 'http://localhost:3000' })).toBe(
      'http://localhost:3000/reservar/natalia',
    );
  });
});

describe('linkReservaCorto', () => {
  it('quita el protocolo para mostrarlo', () => {
    expect(linkReservaCorto('https://reservar.turnetto.com/natalia')).toBe('reservar.turnetto.com/natalia');
  });
});

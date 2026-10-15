import { describe, expect, it } from 'vitest';
import { motivoFallo } from './motivoFalloWhatsapp';

describe('motivoFallo', () => {
  it.each([
    [131026, 'noPuedeRecibir'],
    [131049, 'limiteDeWhatsapp'],
    [131050, 'noQuiereMensajes'],
    [131056, 'demasiadosMensajes'],
    [130429, 'demasiadosMensajes'],
    [131048, 'envioRestringido'],
    [131031, 'problemaCuenta'],
    [131042, 'problemaCuenta'],
    [133010, 'problemaCuenta'],
    [131037, 'problemaCuenta'],
    [132000, 'mensajeNoDisponible'],
    [132001, 'mensajeNoDisponible'],
    [132005, 'mensajeNoDisponible'],
    [132007, 'mensajeNoDisponible'],
    [132012, 'mensajeNoDisponible'],
    [132015, 'mensajeNoDisponible'],
    [132016, 'mensajeNoDisponible'],
    [131008, 'mensajeNoDisponible'],
    [131009, 'mensajeNoDisponible'],
    [131000, 'errorTemporal'],
    [133004, 'errorTemporal'],
    [135000, 'errorTemporal'],
  ])('%i -> %s', (code, esperado) => {
    expect(motivoFallo(code)).toBe(esperado);
  });

  it.each([[null], [undefined], [999999], [0]])('%s -> generico', (code) => {
    expect(motivoFallo(code)).toBe('generico');
  });
});

import { describe, expect, it } from 'vitest';
import { CENTRO_FALLBACK, esUbicacionValida } from './ubicacion';

// Mirrors the backend coordinate validation (`AuthController::updatePerfil`):
// latitud in [-90,90], longitud in [-180,180], both present or both absent.

describe('esUbicacionValida', () => {
  it('accepts a valid coordinate pair inside range', () => {
    expect(esUbicacionValida(-27.4692, -58.8306)).toBe(true);
  });

  it('accepts the exact boundary values', () => {
    expect(esUbicacionValida(90, 180)).toBe(true);
    expect(esUbicacionValida(-90, -180)).toBe(true);
  });

  it('accepts 0,0 as a valid (if unusual) pair', () => {
    expect(esUbicacionValida(0, 0)).toBe(true);
  });

  it('rejects out-of-range latitud', () => {
    expect(esUbicacionValida(91, -58.8306)).toBe(false);
    expect(esUbicacionValida(-91, -58.8306)).toBe(false);
  });

  it('rejects out-of-range longitud', () => {
    expect(esUbicacionValida(-27.4692, 181)).toBe(false);
    expect(esUbicacionValida(-27.4692, -181)).toBe(false);
  });

  it('rejects when either value is null', () => {
    expect(esUbicacionValida(null, -58.8306)).toBe(false);
    expect(esUbicacionValida(-27.4692, null)).toBe(false);
  });

  it('rejects when both values are null', () => {
    expect(esUbicacionValida(null, null)).toBe(false);
  });
});

describe('CENTRO_FALLBACK', () => {
  it('is Corrientes, Argentina at zoom 13', () => {
    expect(CENTRO_FALLBACK).toEqual({ lat: -27.4692, lng: -58.8306, zoom: 13 });
  });
});

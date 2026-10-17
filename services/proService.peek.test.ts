import { beforeEach, describe, expect, it } from 'vitest';
import { PRO_STORAGE_KEYS } from '@/lib/pro/storageKeys';
import { proService } from './proService';

// peekSesion: la misma lectura que leerSesion pero de SOLO LECTURA. El camino de
// sincronización entre pestañas la usa para no borrar una sesión que otra
// pestaña todavía está escribiendo key por key (cada setItem dispara un evento
// `storage`).

const AHORA = Date.parse('2026-10-17T12:00:00Z');
const FUTURO = AHORA + 3_600_000;

const claves = () => [PRO_STORAGE_KEYS.token, PRO_STORAGE_KEYS.tipo, PRO_STORAGE_KEYS.expiresAt].map((c) => localStorage.getItem(c));

beforeEach(() => localStorage.clear());

describe('peekSesion — no destruye nada', () => {
  it('con una sesión vigente devuelve lo mismo que leerSesion', () => {
    proService.guardarSesion({ token: 'tok', tipo: 'full', expiresAt: FUTURO });

    expect(proService.peekSesion(AHORA)).toEqual({
      estado: 'vigente',
      sesion: { token: 'tok', tipo: 'full', expiresAt: FUTURO },
    });
    expect(proService.peekSesion(AHORA)).toEqual(proService.leerSesion(AHORA));
  });

  it('una sesión a medio escribir (solo el token) es "ninguna" y NO se borra', () => {
    localStorage.setItem(PRO_STORAGE_KEYS.token, 'tok-nuevo');

    expect(proService.peekSesion(AHORA)).toEqual({ estado: 'ninguna' });
    expect(claves()).toEqual(['tok-nuevo', null, null]);
  });

  it('una sesión vencida es "expirada" y NO se borra', () => {
    proService.guardarSesion({ token: 'tok', tipo: 'full', expiresAt: AHORA - 1 });

    expect(proService.peekSesion(AHORA)).toEqual({ estado: 'expirada' });
    expect(claves()).toEqual(['tok', 'full', String(AHORA - 1)]);
  });

  it('datos corruptos son "ninguna" y NO se borran (a diferencia de leerSesion)', () => {
    localStorage.setItem(PRO_STORAGE_KEYS.token, 'tok');
    localStorage.setItem(PRO_STORAGE_KEYS.tipo, 'rarisimo');
    localStorage.setItem(PRO_STORAGE_KEYS.expiresAt, 'abc');

    expect(proService.peekSesion(AHORA)).toEqual({ estado: 'ninguna' });
    expect(claves()).toEqual(['tok', 'rarisimo', 'abc']);

    expect(proService.leerSesion(AHORA)).toEqual({ estado: 'ninguna' });
    expect(claves()).toEqual([null, null, null]);
  });

  it('sin nada guardado es "ninguna"', () => {
    expect(proService.peekSesion(AHORA)).toEqual({ estado: 'ninguna' });
  });
});

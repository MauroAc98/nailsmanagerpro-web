import { describe, it, expect } from 'vitest';
import {
  urlBase64ToUint8Array,
  calcularEstadoAvisos,
  esIOS,
  errorDeActivacion,
  type EntornoAvisos,
} from './avisosPush';

const base: EntornoAvisos = {
  tieneServiceWorker: true,
  tienePushManager: true,
  tieneNotification: true,
  esIOS: false,
  esStandalone: false,
  permiso: 'default',
  suscrito: false,
};

describe('urlBase64ToUint8Array', () => {
  it('decodifica base64url sin padding', () => {
    // "hello?>" -> aGVsbG8_Pg (base64url, con "_" y sin "=")
    const bytes = urlBase64ToUint8Array('aGVsbG8_Pg');
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111, 63, 62]);
  });
  it('maneja "-" y "_" (alfabeto url-safe)', () => {
    // bytes [251, 255, 190] -> "+/++" en base64 -> "-_--" en base64url
    expect(Array.from(urlBase64ToUint8Array('-_--'))).toEqual([251, 255, 190]);
  });
  it('devuelve 65 bytes para una clave VAPID típica', () => {
    const clave = btoa(String.fromCharCode(...new Uint8Array(65).fill(4)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(urlBase64ToUint8Array(clave).length).toBe(65);
  });
});

describe('calcularEstadoAvisos', () => {
  it('unsupported si falta alguna API', () => {
    expect(calcularEstadoAvisos({ ...base, tienePushManager: false })).toBe('unsupported');
    expect(calcularEstadoAvisos({ ...base, tieneServiceWorker: false })).toBe('unsupported');
    expect(calcularEstadoAvisos({ ...base, tieneNotification: false })).toBe('unsupported');
  });
  it('ios-needs-install en iPhone fuera de la pantalla de inicio (aunque falte PushManager)', () => {
    expect(calcularEstadoAvisos({ ...base, esIOS: true, tienePushManager: false })).toBe('ios-needs-install');
  });
  it('en iOS instalado sigue el flujo normal', () => {
    expect(calcularEstadoAvisos({ ...base, esIOS: true, esStandalone: true })).toBe('off');
  });
  it('denied si el permiso está bloqueado', () => {
    expect(calcularEstadoAvisos({ ...base, permiso: 'denied' })).toBe('denied');
  });
  it('on solo con permiso concedido y suscripción activa', () => {
    expect(calcularEstadoAvisos({ ...base, permiso: 'granted', suscrito: true })).toBe('on');
    expect(calcularEstadoAvisos({ ...base, permiso: 'granted', suscrito: false })).toBe('off');
    expect(calcularEstadoAvisos({ ...base, permiso: 'default', suscrito: true })).toBe('off');
  });
});

describe('esIOS', () => {
  it('detecta iPhone/iPad por user agent', () => {
    expect(esIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true);
  });
  it('detecta iPadOS que se presenta como Mac con pantalla táctil', () => {
    expect(esIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(esIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
  });
  it('no confunde Android', () => {
    expect(esIOS('Mozilla/5.0 (Linux; Android 14)', 5)).toBe(false);
  });
});

describe('errorDeActivacion', () => {
  it('503 -> no disponible', () => {
    expect(errorDeActivacion({ response: { status: 503 } })).toBe('unavailable');
  });
  it('sin respuesta -> red', () => {
    expect(errorDeActivacion({ request: {} })).toBe('network');
  });
  it('otro -> genérico', () => {
    expect(errorDeActivacion(new Error('x'))).toBe('generic');
    expect(errorDeActivacion({ response: { status: 500 } })).toBe('generic');
  });
});

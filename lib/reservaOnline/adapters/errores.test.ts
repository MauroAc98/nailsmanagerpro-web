import { describe, expect, it } from 'vitest';
import { ReservaOnlineError } from '../service';
import { traducirErrorHttp } from './errores';

// Traductor unico de errores HTTP -> ReservaOnlineError (decision D5): las
// escrituras reales (slice 3) mandan `code` en el cuerpo; las lecturas
// todavia no, asi que sin `code` se cae al status (404/422).
function axiosError(status: number, data?: unknown) {
  const config = {} as never;
  const response = { data, status, statusText: String(status), headers: {}, config };
  return Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response, config });
}

describe('traducirErrorHttp', () => {
  it('mapea los codigos de negocio conocidos del cuerpo (escrituras reales)', () => {
    const casos: [string, ReturnType<typeof traducirErrorHttp>['code']][] = [
      ['not_found', 'not_found'],
      ['validation', 'validation'],
      ['slot_taken', 'slot_taken'],
      ['hold_expired', 'hold_expired'],
      ['rate_limited', 'rate_limited'],
      ['phone_cooldown', 'phone_cooldown'],
      ['challenge_failed', 'challenge_failed'],
      ['verification_required', 'verification_required'],
      ['creation_disabled', 'creation_disabled'],
    ];
    for (const [code, esperado] of casos) {
      const err = traducirErrorHttp(axiosError(409, { message: 'x', code }));
      expect(err).toBeInstanceOf(ReservaOnlineError);
      expect(err.code).toBe(esperado);
    }
  });

  it('codigos de dominio sin kind propio caen a uno existente (defensivo)', () => {
    expect(traducirErrorHttp(axiosError(422, { code: 'device_token_required' })).code).toBe('validation');
    expect(traducirErrorHttp(axiosError(422, { code: 'datos_required' })).code).toBe('validation');
    expect(traducirErrorHttp(axiosError(409, { code: 'already_confirmed' })).code).toBe('slot_taken');
  });

  it('propaga retry_after_seconds cuando viene en el cuerpo', () => {
    const err = traducirErrorHttp(axiosError(429, { message: 'esperá', code: 'rate_limited', retry_after_seconds: 60 }));
    expect(err.retryAfterSeconds).toBe(60);
  });

  it('sin retry_after_seconds queda undefined', () => {
    const err = traducirErrorHttp(axiosError(429, { code: 'phone_cooldown' }));
    expect(err.retryAfterSeconds).toBeUndefined();
  });

  it('sin `code` en el cuerpo (lecturas) cae al status: 404 -> not_found, 422 -> validation', () => {
    expect(traducirErrorHttp(axiosError(404, { message: 'no' })).code).toBe('not_found');
    expect(traducirErrorHttp(axiosError(422, { message: 'no' })).code).toBe('validation');
  });

  it('cualquier otro status o un error de red cae en unknown', () => {
    expect(traducirErrorHttp(axiosError(500, {})).code).toBe('unknown');
    expect(traducirErrorHttp(Object.assign(new Error('red'), { isAxiosError: true })).code).toBe('unknown');
    expect(traducirErrorHttp(new Error('lo que sea')).code).toBe('unknown');
  });

  it('conserva el mensaje del backend', () => {
    expect(traducirErrorHttp(axiosError(409, { message: 'Ese horario ya no está disponible.', code: 'slot_taken' })).message).toBe(
      'Ese horario ya no está disponible.',
    );
  });
});

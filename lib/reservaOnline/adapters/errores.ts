import { isAxiosError } from 'axios';
import { ReservaOnlineError, type ReservaOnlineErrorCode } from '../service';

interface CuerpoError {
  message?: string;
  code?: string;
  retry_after_seconds?: number;
}

// Codigos de negocio que el backend declara explicitamente en el cuerpo (las
// escrituras reales, decision A9 del diseno de la slice 3: {message, code}
// siempre). Los que no tienen un kind propio en el FE caen a uno existente,
// a proposito defensivo (el cliente arma su propio device token/datos, asi
// que en la practica no deberian aparecer):
// - device_token_required / datos_required -> validation (son 422 de forma)
// - already_confirmed -> slot_taken (409: el horario ya no se puede tocar)
const CODIGOS_CONOCIDOS: Record<string, ReservaOnlineErrorCode> = {
  not_found: 'not_found',
  validation: 'validation',
  slot_taken: 'slot_taken',
  hold_expired: 'hold_expired',
  device_token_required: 'validation',
  datos_required: 'validation',
  already_confirmed: 'slot_taken',
  rate_limited: 'rate_limited',
  phone_cooldown: 'phone_cooldown',
  challenge_failed: 'challenge_failed',
  verification_required: 'verification_required',
  creation_disabled: 'creation_disabled',
  // mp_error (falla transitoria de MP al crear la preferencia) NO esta
  // mapeado a proposito: cae a 'unknown' (error generico, reintentable) —
  // a diferencia de mp_no_conectado, que es permanente hasta que se
  // configure y merece el bloqueo de pantalla completa.
  mp_no_conectado: 'mp_no_conectado',
};

// Traductor unico de errores HTTP -> ReservaOnlineError, usado por lecturas y
// escrituras (decision D5). Prioriza el `code` del cuerpo; sin `code` (las
// lecturas todavia no lo mandan) cae al status: 404 -> not_found,
// 422 -> validation, cualquier otro (red, 5xx, 429 sin code) -> unknown.
export function traducirErrorHttp(err: unknown): ReservaOnlineError {
  if (isAxiosError(err) && err.response) {
    const cuerpo = err.response.data as CuerpoError | undefined;
    const codigo = cuerpo?.code ? CODIGOS_CONOCIDOS[cuerpo.code] : undefined;
    if (codigo) return new ReservaOnlineError(codigo, cuerpo?.message, cuerpo?.retry_after_seconds);
    if (err.response.status === 404) return new ReservaOnlineError('not_found', cuerpo?.message);
    if (err.response.status === 422) return new ReservaOnlineError('validation', cuerpo?.message);
  }
  return new ReservaOnlineError('unknown', err instanceof Error ? err.message : undefined);
}

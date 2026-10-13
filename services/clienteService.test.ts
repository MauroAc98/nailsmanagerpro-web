import { describe, expect, it } from 'vitest';
import { extraerMensajeError } from './clienteService';

describe('extraerMensajeError', () => {
  it('sin respuesta del servidor (corte de red) avisa de la conexión, no de un error inesperado', () => {
    const msg = extraerMensajeError({ code: 'ERR_NETWORK', message: 'Network Error', response: undefined });
    expect(msg).toMatch(/conexión/i);
    expect(msg).not.toMatch(/inesperado/i);
  });

  it('un timeout por señal débil también cuenta como problema de conexión', () => {
    expect(extraerMensajeError({ code: 'ECONNABORTED', response: undefined })).toMatch(/conexión/i);
  });

  it('con respuesta del servidor prioriza el mensaje del backend', () => {
    expect(extraerMensajeError({ response: { data: { message: 'Cliente duplicado' } } })).toBe('Cliente duplicado');
  });

  it('un error sin forma conocida sigue siendo "inesperado"', () => {
    expect(extraerMensajeError(new Error('boom'))).toMatch(/inesperado/i);
  });
});

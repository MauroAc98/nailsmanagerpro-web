import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { crearPublicHttp } from '../publicHttp';
import { ReservaOnlineError } from '../service';
import { createRealWrites } from './realWrites';

// Adapter real de las 5 escrituras (slice 3), contra HTTP stubbeado (sin
// mockear modulos): los JSON exactos y los headers salen de las pruebas de
// Feature del backend (PublicReservasHoldsTest), no del diseno (puede haber
// quedado desactualizado).

function respuesta(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  const res = { data, status, statusText: String(status), headers: {}, config };
  if (status >= 200 && status < 300) return Promise.resolve(res);
  return Promise.reject(Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: res, config }));
}

interface Pedido {
  method?: string;
  url?: string;
  headers: Record<string, unknown>;
  body: unknown;
}

const TOKEN = 'a'.repeat(40);

function crearBackendFalso(pedidos: Pedido[] = []): AxiosAdapter {
  return (config) => {
    pedidos.push({ method: config.method, url: config.url, headers: { ...config.headers }, body: config.data ? JSON.parse(config.data as string) : undefined });
    const deviceToken = (config.headers as Record<string, unknown>)?.['X-Device-Token'];
    if (!deviceToken) return respuesta(config, 422, { message: 'Falta el identificador del dispositivo.', code: 'device_token_required' });

    const url = config.url ?? '';
    if (url.endsWith('/holds')) {
      const key = (config.headers as Record<string, unknown>)?.['Idempotency-Key'];
      if (!key) return respuesta(config, 422, { message: 'invalido', code: 'validation' });
      const body = JSON.parse(config.data as string) as { fecha: string; hora: string };
      if (body.hora === '10:00' && body.fecha === 'ocupado') {
        return respuesta(config, 409, { message: 'Ese horario ya no está disponible. Elegí otro.', code: 'slot_taken' });
      }
      return respuesta(config, 201, {
        token: TOKEN,
        estado: 'held',
        expira_en_ms: 1_758_300_000_000,
        profesional_id: body.hora === '11:00' ? undefined : 3,
        fecha: body.fecha,
        hora: body.hora,
        duracion_total_minutos: 90,
      });
    }
    if (url.endsWith('/datos')) {
      return respuesta(config, 200, { token: TOKEN, estado: 'held', expira_en_ms: 1_758_300_000_000 });
    }
    if (url.endsWith('/pago')) {
      return respuesta(config, 200, {
        token: TOKEN,
        estado: 'pending_payment',
        expira_en_ms: 1_758_301_000_000,
        checkout_url: `https://app.test/reservar/ana/reserva/${TOKEN}?stub=1`,
      });
    }
    if (config.method === 'delete') {
      return respuesta(config, 204, undefined);
    }
    // GET estado
    return respuesta(config, 200, {
      token: TOKEN,
      estado: 'pending_payment',
      expira_en_ms: 1_758_301_000_000,
      checkout_url: `https://app.test/reservar/ana/reserva/${TOKEN}?stub=1`,
      resumen: {
        servicio_ids: [7, 9],
        profesional_id: 3,
        fecha: '2026-09-25',
        hora: '10:00',
        duracion_total_minutos: 90,
        deposito: 5000,
        nota: 'hola',
      },
    });
  };
}

const nuevo = (pedidos?: Pedido[], opts?: { deviceToken?: () => string; newIdempotencyKey?: () => string }) =>
  createRealWrites(
    crearPublicHttp({ baseURL: 'https://api.test/api', adapter: crearBackendFalso(pedidos) }),
    { deviceToken: () => 'device-de-prueba-0123456789abcdef', newIdempotencyKey: () => 'key-1', ...opts },
  );

describe('createRealWrites: retenerHorario', () => {
  it('manda X-Device-Token e Idempotency-Key y mapea la Retencion', async () => {
    const pedidos: Pedido[] = [];
    const r = await nuevo(pedidos).retenerHorario('ana', {
      servicioIds: [7, 9],
      profesionalId: 3,
      fecha: '2026-09-25',
      hora: '10:00',
    });
    expect(r).toEqual({ reservaId: TOKEN, expiresAtMs: 1_758_300_000_000, profesionalId: 3 });
    expect(pedidos[0].method).toBe('post');
    expect(pedidos[0].url).toBe('/public/ana/reservas/holds');
    expect(pedidos[0].headers['X-Device-Token']).toBe('device-de-prueba-0123456789abcdef');
    expect(pedidos[0].headers['Idempotency-Key']).toBe('key-1');
    expect(pedidos[0].body).toEqual({ servicio_ids: [7, 9], profesional_id: 3, fecha: '2026-09-25', hora: '10:00' });
  });

  it('omite profesional_id cuando la clienta eligio "Cualquiera"', async () => {
    const pedidos: Pedido[] = [];
    await nuevo(pedidos).retenerHorario('ana', { servicioIds: [7], fecha: '2026-09-25', hora: '11:00' });
    expect(pedidos[0].body).not.toHaveProperty('profesional_id');
  });

  it('un slot ocupado falla con slot_taken', async () => {
    await expect(
      nuevo().retenerHorario('ana', { servicioIds: [7], fecha: 'ocupado', hora: '10:00' }),
    ).rejects.toMatchObject({ name: ReservaOnlineError.name, code: 'slot_taken' });
  });

  it('reintentar EXACTAMENTE el mismo pick antes de confirmar reusa la Idempotency-Key', async () => {
    const generar = vi.fn(() => 'key-generada');
    const pedidos: Pedido[] = [];
    const escrituras = createRealWrites(
      crearPublicHttp({ baseURL: 'https://api.test/api', adapter: crearBackendFalso(pedidos) }),
      { deviceToken: () => 'device-de-prueba-0123456789abcdef', newIdempotencyKey: generar },
    );
    const input = { servicioIds: [7, 9], profesionalId: 3, fecha: '2026-09-25', hora: '10:00' };
    await escrituras.retenerHorario('ana', input);
    await escrituras.retenerHorario('ana', { ...input }); // mismo pick (nuevo objeto, mismo contenido)
    expect(generar).toHaveBeenCalledTimes(1);
    expect(pedidos[0].headers['Idempotency-Key']).toBe(pedidos[1].headers['Idempotency-Key']);
  });

  it('un pick distinto (otra hora) genera una Idempotency-Key nueva', async () => {
    const generar = vi.fn(() => `key-${generar.mock.calls.length}`);
    const pedidos: Pedido[] = [];
    const escrituras = createRealWrites(
      crearPublicHttp({ baseURL: 'https://api.test/api', adapter: crearBackendFalso(pedidos) }),
      { deviceToken: () => 'device-de-prueba-0123456789abcdef', newIdempotencyKey: generar },
    );
    await escrituras.retenerHorario('ana', { servicioIds: [7], fecha: '2026-09-25', hora: '10:00' });
    await escrituras.retenerHorario('ana', { servicioIds: [7], fecha: '2026-09-25', hora: '11:00' });
    expect(generar).toHaveBeenCalledTimes(2);
    expect(pedidos[0].headers['Idempotency-Key']).not.toBe(pedidos[1].headers['Idempotency-Key']);
  });
});

describe('createRealWrites: actualizarDatosReserva, iniciarPago, liberarHold, getReservationStatus', () => {
  it('actualizarDatosReserva manda el body esperado y no rompe con la respuesta 200 basica', async () => {
    const pedidos: Pedido[] = [];
    await nuevo(pedidos).actualizarDatosReserva('ana', TOKEN, {
      cliente: { nombre: 'Lucia', apellido: 'Gomez', whatsapp: '+5491155551234' },
      nota: 'hola',
    });
    expect(pedidos[0].method).toBe('put');
    expect(pedidos[0].url).toBe(`/public/ana/reservas/${TOKEN}/datos`);
    expect(pedidos[0].body).toEqual({ nombre: 'Lucia', apellido: 'Gomez', whatsapp: '+5491155551234', nota: 'hola' });
  });

  it('iniciarPago mapea a ReservationCreated con el checkout stub', async () => {
    const pago = await nuevo().iniciarPago('ana', TOKEN);
    expect(pago).toEqual({
      id: TOKEN,
      status: 'pending_payment',
      expiresAtMs: 1_758_301_000_000,
      checkoutUrl: `https://app.test/reservar/ana/reserva/${TOKEN}?stub=1`,
    });
  });

  it('liberarHold pide DELETE con el device token y no falla con 204', async () => {
    const pedidos: Pedido[] = [];
    await expect(nuevo(pedidos).liberarHold('ana', TOKEN)).resolves.toBeUndefined();
    expect(pedidos[0].method).toBe('delete');
    expect(pedidos[0].headers['X-Device-Token']).toBe('device-de-prueba-0123456789abcdef');
  });

  it('getReservationStatus mapea el resumen (incluida la sena) y el checkout_url', async () => {
    const estado = await nuevo().getReservationStatus('ana', TOKEN);
    expect(estado).toEqual({
      id: TOKEN,
      status: 'pending_payment',
      expiresAtMs: 1_758_301_000_000,
      checkoutUrl: `https://app.test/reservar/ana/reserva/${TOKEN}?stub=1`,
      summary: {
        servicioIds: [7, 9],
        profesionalId: 3,
        fecha: '2026-09-25',
        hora: '10:00',
        deposito: 5000,
        duracionTotalMinutos: 90,
        nota: 'hola',
      },
    });
  });

  it('un hold vencido (410) se traduce a hold_expired', async () => {
    const http = crearPublicHttp({
      baseURL: 'https://api.test/api',
      adapter: (config) =>
        Promise.reject(
          Object.assign(new Error('410'), {
            isAxiosError: true,
            response: { data: { message: 'venció', code: 'hold_expired' }, status: 410, statusText: '410', headers: {}, config },
            config,
          }),
        ),
    });
    const escrituras = createRealWrites(http, { deviceToken: () => 'device-de-prueba-0123456789abcdef' });
    await expect(escrituras.actualizarDatosReserva('ana', TOKEN, { cliente: { nombre: 'A', apellido: 'B', whatsapp: '+5491155551234' } }))
      .rejects.toMatchObject({ code: 'hold_expired' });
  });

  it('sin device token inyectado usa getDeviceToken por defecto (localStorage)', async () => {
    localStorage.clear();
    const pedidos: Pedido[] = [];
    const escrituras = createRealWrites(
      crearPublicHttp({ baseURL: 'https://api.test/api', adapter: crearBackendFalso(pedidos) }),
      { newIdempotencyKey: () => 'k' },
    );
    await escrituras.getReservationStatus('ana', TOKEN);
    expect(typeof pedidos[0].headers['X-Device-Token']).toBe('string');
    expect((pedidos[0].headers['X-Device-Token'] as string).length).toBeGreaterThanOrEqual(32);
  });
});

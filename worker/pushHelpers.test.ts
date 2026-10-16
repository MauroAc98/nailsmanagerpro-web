import { describe, it, expect, vi } from 'vitest';
import {
  parsearPayloadPush,
  urlMismoOrigen,
  opcionesNotificacion,
  manejarCambioDeSuscripcion,
  MENSAJE_SUSCRIPCION_CAMBIO,
  TITULO_POR_DEFECTO,
} from './pushHelpers';

describe('parsearPayloadPush', () => {
  it('lee un payload completo', () => {
    const r = parsearPayloadPush({
      json: () => ({ title: 'T', body: 'B', url: '/agenda?fecha=2026-10-09', tag: 'x-1', timestamp: 5 }),
    });
    expect(r).toEqual({ title: 'T', body: 'B', url: '/agenda?fecha=2026-10-09', tag: 'x-1', timestamp: 5, silencioso: false });
  });
  it('usa valores por defecto si no hay data', () => {
    const r = parsearPayloadPush(null);
    expect(r.title).toBe(TITULO_POR_DEFECTO);
    expect(r.url).toBe('/agenda');
  });
  it('usa valores por defecto si el JSON es inválido', () => {
    const r = parsearPayloadPush({ json: () => { throw new Error('bad'); } });
    expect(r.title).toBe(TITULO_POR_DEFECTO);
  });
  it('ignora campos con tipo incorrecto', () => {
    const r = parsearPayloadPush({ json: () => ({ title: 3, body: {}, url: 7, tag: [], timestamp: 'x' }) });
    expect(r.title).toBe(TITULO_POR_DEFECTO);
    expect(r.url).toBe('/agenda');
    expect(r.tag).toBeUndefined();
    expect(r.timestamp).toBeUndefined();
  });
  it('tolera un JSON que no es objeto', () => {
    expect(parsearPayloadPush({ json: () => 'hola' }).title).toBe(TITULO_POR_DEFECTO);
    expect(parsearPayloadPush({ json: () => null }).title).toBe(TITULO_POR_DEFECTO);
  });
});

describe('silencioso', () => {
  const parse = (v: unknown) => parsearPayloadPush({ json: () => ({ silencioso: v }) }).silencioso;
  it('solo el booleano true cuenta', () => {
    expect(parse(true)).toBe(true);
  });
  it.each([false, 'true', 1, null, undefined, {}, []])('%j es false', (v) => {
    expect(parse(v)).toBe(false);
  });
  it('es false si no hay data o el JSON es inválido', () => {
    expect(parsearPayloadPush(null).silencioso).toBe(false);
    expect(parsearPayloadPush({ json: () => { throw new Error('bad'); } }).silencioso).toBe(false);
  });
});

describe('opcionesNotificacion', () => {
  const base = { title: 'T', body: 'B', url: '/agenda' };
  it('renotify true con tag y sin silencioso (comportamiento actual)', () => {
    expect(opcionesNotificacion({ ...base, tag: 'x', silencioso: false }, '/i.png').renotify).toBe(true);
  });
  it('renotify false con tag y silencioso, conservando el tag', () => {
    const o = opcionesNotificacion({ ...base, tag: 'x', silencioso: true }, '/i.png');
    expect(o.renotify).toBe(false);
    expect(o.tag).toBe('x');
  });
  it('renotify false sin tag, aunque no sea silencioso', () => {
    const o = opcionesNotificacion({ ...base, silencioso: false }, '/i.png');
    expect(o.renotify).toBe(false);
    expect(o).not.toHaveProperty('tag');
  });
  it('nunca usa silent:true y mantiene body/icon/badge/data/timestamp', () => {
    const o = opcionesNotificacion({ ...base, tag: 'x', timestamp: 9, silencioso: true }, '/i.png');
    expect(o).not.toHaveProperty('silent');
    expect(o).toMatchObject({ body: 'B', icon: '/i.png', badge: '/i.png', data: { url: '/agenda' }, timestamp: 9 });
  });
  it('usa el badge indicado (silueta) y cae al ícono si no se indica', () => {
    expect(opcionesNotificacion({ ...base, silencioso: false }, '/i.png', '/b.png')).toMatchObject({ icon: '/i.png', badge: '/b.png' });
    expect(opcionesNotificacion({ ...base, silencioso: false }, '/i.png')).toMatchObject({ icon: '/i.png', badge: '/i.png' });
  });
});

describe('urlMismoOrigen', () => {
  const origen = 'https://app.turnetto.com';
  it('resuelve rutas relativas', () => {
    expect(urlMismoOrigen('/agenda?fecha=2026-10-09', origen)).toBe('https://app.turnetto.com/agenda?fecha=2026-10-09');
  });
  it('acepta URL absoluta del mismo origen', () => {
    expect(urlMismoOrigen('https://app.turnetto.com/agenda', origen)).toBe('https://app.turnetto.com/agenda');
  });
  it('rechaza otro origen y protocolos raros', () => {
    expect(urlMismoOrigen('https://evil.com/x', origen)).toBe('https://app.turnetto.com/agenda');
    expect(urlMismoOrigen('//evil.com/x', origen)).toBe('https://app.turnetto.com/agenda');
    expect(urlMismoOrigen('javascript:alert(1)', origen)).toBe('https://app.turnetto.com/agenda');
  });
  it('cae en /agenda si no hay url', () => {
    expect(urlMismoOrigen(undefined, origen)).toBe('https://app.turnetto.com/agenda');
  });
});

describe('manejarCambioDeSuscripcion', () => {
  const clave = new Uint8Array([1, 2, 3]).buffer;
  const ventana = () => ({ postMessage: vi.fn() });

  function entorno(opts: { subscribe?: () => Promise<unknown>; ventanas?: { postMessage: () => void }[]; matchAllFalla?: boolean }) {
    const subscribe = vi.fn(opts.subscribe ?? (() => Promise.resolve({ endpoint: 'https://push.example/nuevo' })));
    const ventanas = opts.ventanas ?? [ventana()];
    const matchAll = vi.fn(() => (opts.matchAllFalla ? Promise.reject(new Error('x')) : Promise.resolve(ventanas)));
    return { subscribe, ventanas, matchAll, registro: { pushManager: { subscribe } }, clientes: { matchAll } };
  }

  it('re-suscribe con la misma applicationServerKey y avisa a las ventanas abiertas', async () => {
    const e = entorno({});
    const r = await manejarCambioDeSuscripcion({ options: { applicationServerKey: clave } }, e.registro, e.clientes);
    expect(e.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: clave });
    expect(e.matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true });
    expect(e.ventanas[0].postMessage).toHaveBeenCalledWith(MENSAJE_SUSCRIPCION_CAMBIO);
    expect(r).toBe('resuscripto');
  });

  it('el mensaje es { type: "push-subscription-changed" } y no lleva datos de sesión', () => {
    expect(MENSAJE_SUSCRIPCION_CAMBIO).toEqual({ type: 'push-subscription-changed' });
  });

  it.each([undefined, null, {}, { options: {} }, { options: { applicationServerKey: null } }])(
    'sin clave (%j) no suscribe nada, pero igual avisa a las ventanas',
    async (anterior) => {
      const e = entorno({});
      const r = await manejarCambioDeSuscripcion(anterior as never, e.registro, e.clientes);
      expect(e.subscribe).not.toHaveBeenCalled();
      expect(e.ventanas[0].postMessage).toHaveBeenCalledWith(MENSAJE_SUSCRIPCION_CAMBIO);
      expect(r).toBe('sin-clave');
    },
  );

  it('si subscribe falla no lanza y igual avisa a las ventanas', async () => {
    const e = entorno({ subscribe: () => Promise.reject(new Error('denied')) });
    const r = await manejarCambioDeSuscripcion({ options: { applicationServerKey: clave } }, e.registro, e.clientes);
    expect(e.ventanas[0].postMessage).toHaveBeenCalledWith(MENSAJE_SUSCRIPCION_CAMBIO);
    expect(r).toBe('error');
  });

  it('si no se pueden listar las ventanas no lanza', async () => {
    const e = entorno({ matchAllFalla: true });
    await expect(
      manejarCambioDeSuscripcion({ options: { applicationServerKey: clave } }, e.registro, e.clientes),
    ).resolves.toBe('resuscripto');
  });

  it('avisa a todas las ventanas aunque una falle', async () => {
    const mala = { postMessage: vi.fn(() => { throw new Error('x'); }) };
    const buena = ventana();
    const e = entorno({ ventanas: [mala, buena] });
    await manejarCambioDeSuscripcion(undefined, e.registro, e.clientes);
    expect(buena.postMessage).toHaveBeenCalledWith(MENSAJE_SUSCRIPCION_CAMBIO);
  });
});

import { describe, it, expect } from 'vitest';
import { parsearPayloadPush, urlMismoOrigen, opcionesNotificacion, TITULO_POR_DEFECTO } from './pushHelpers';

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

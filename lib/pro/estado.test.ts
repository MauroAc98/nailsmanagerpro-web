import { describe, expect, it } from 'vitest';
import { ESTADOS_VISUALES } from '@/lib/pro/tipos';
import { infoEstado } from './estado';

describe('infoEstado', () => {
  it('cada estado conocido mapea a su propia clave de i18n y a estilos distintos', () => {
    const infos = ESTADOS_VISUALES.map((e) => infoEstado(e));
    expect(infos.map((i) => i.clave)).toEqual(['confirmado', 'en_curso', 'completado']);
    expect(new Set(infos.map((i) => `${i.fg}|${i.bg}`)).size).toBe(3);
  });

  it('un estado desconocido cae en el neutral sin romper', () => {
    for (const raro of ['cancelado', '', null, undefined, 7, {}]) {
      const info = infoEstado(raro as unknown as string);
      expect(info.clave).toBe('desconocido');
      expect(info.fg).toBeTruthy();
      expect(info.bg).toBeTruthy();
    }
  });

  it('no confunde propiedades heredadas con estados', () => {
    expect(infoEstado('constructor').clave).toBe('desconocido');
    expect(infoEstado('__proto__').clave).toBe('desconocido');
  });
});

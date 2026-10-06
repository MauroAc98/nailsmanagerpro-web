import { describe, expect, it, vi } from 'vitest';
import {
  agregarAjustes,
  decidirEnvio,
  descargarSecuencial,
  exportarHistorias,
  nombresArchivoUnicos,
} from './exportarHistorias';

const h = (id: string, titulo: string | null) => ({ id, titulo, servicios: [] });

describe('agregarAjustes', () => {
  const historias = [h('a', 'Uñas'), h('b', 'Pies'), h('c', 'Cejas')];

  it('todas entran cuando ninguna reporta entra=false (sin reporte cuenta como entra)', () => {
    const r = agregarAjustes(historias, { a: { nivel: 0, entra: true } });
    expect(r.entraTodas).toBe(true);
    expect(r.historiasQueNoEntran).toEqual([]);
  });

  it('lista en orden las que no entran', () => {
    const r = agregarAjustes(historias, {
      a: { nivel: 3, entra: false },
      b: { nivel: 1, entra: true },
      c: { nivel: 3, entra: false },
    });
    expect(r.entraTodas).toBe(false);
    expect(r.historiasQueNoEntran.map(x => x.id)).toEqual(['a', 'c']);
    expect(r.historiasQueNoEntran.map(x => x.titulo)).toEqual(['Uñas', 'Cejas']);
  });

  it('ignora reportes de historias que ya no existen', () => {
    const r = agregarAjustes(historias, { zzz: { nivel: 3, entra: false } });
    expect(r.entraTodas).toBe(true);
  });
});

describe('nombresArchivoUnicos', () => {
  it('usa el slug de la categoría', () => {
    expect(nombresArchivoUnicos(['Uñas', 'Pies'])).toEqual([
      'historia-precios-unas.png',
      'historia-precios-pies.png',
    ]);
  });

  it('desambigua colisiones con el número de historia', () => {
    expect(nombresArchivoUnicos(['Pies', 'pies', 'PIES!'])).toEqual([
      'historia-precios-pies.png',
      'historia-precios-pies-2.png',
      'historia-precios-pies-3.png',
    ]);
  });

  it('sin título usa el índice para no pisarse', () => {
    expect(nombresArchivoUnicos([null, null])).toEqual([
      'historia-precios.png',
      'historia-precios-2.png',
    ]);
  });
});

describe('decidirEnvio', () => {
  const files = [new File(['x'], 'a.png', { type: 'image/png' })];

  it('compartir cuando el navegador puede compartir esos archivos', () => {
    const canShare = vi.fn(() => true);
    expect(decidirEnvio(files, { share: vi.fn(), canShare })).toBe('compartir');
    expect(canShare).toHaveBeenCalledWith({ files });
  });

  it('descargar si canShare rechaza los archivos', () => {
    expect(decidirEnvio(files, { share: vi.fn(), canShare: () => false })).toBe('descargar');
  });

  it('descargar si falta share o canShare', () => {
    expect(decidirEnvio(files, {})).toBe('descargar');
    expect(decidirEnvio(files, { share: vi.fn() })).toBe('descargar');
    expect(decidirEnvio(files, { canShare: () => true })).toBe('descargar');
  });
});

describe('exportarHistorias', () => {
  const historias = [h('a', 'Uñas'), h('b', 'Pies'), h('c', 'Cejas')];
  const blob = (t: string) => new Blob([t], { type: 'image/png' });

  it('asienta, captura en orden y devuelve archivos con nombres únicos', async () => {
    const orden: string[] = [];
    const archivos = await exportarHistorias({
      historias,
      asentar: async () => { orden.push('asentar'); },
      firma: () => 'f',
      capturar: async id => { orden.push(id); return blob(id); },
    });
    expect(orden).toEqual(['asentar', 'a', 'b', 'c']);
    expect(archivos.map(f => f.name)).toEqual([
      'historia-precios-unas.png', 'historia-precios-pies.png', 'historia-precios-cejas.png',
    ]);
    expect(archivos.every(f => f.type === 'image/png')).toBe(true);
  });

  it('no captura en paralelo', async () => {
    let activas = 0; let max = 0;
    await exportarHistorias({
      historias, asentar: async () => {}, firma: () => 'f',
      capturar: async id => {
        activas++; max = Math.max(max, activas);
        await Promise.resolve();
        activas--;
        return blob(id);
      },
    });
    expect(max).toBe(1);
  });

  it('si una captura falla, corta todo y propaga el error', async () => {
    const capturar = vi.fn(async (id: string) => {
      if (id === 'b') throw new Error('boom');
      return blob(id);
    });
    await expect(
      exportarHistorias({ historias, asentar: async () => {}, firma: () => 'f', capturar }),
    ).rejects.toThrow('boom');
    expect(capturar.mock.calls.map(c => c[0])).toEqual(['a', 'b']);
  });

  it('una captura vacía (null) cuenta como fallo', async () => {
    await expect(
      exportarHistorias({
        historias, asentar: async () => {}, firma: () => 'f',
        capturar: async id => (id === 'a' ? null : blob(id)),
      }),
    ).rejects.toThrow();
  });

  it('si el ajuste cambió durante la captura, descarta el lote', async () => {
    let f = 'antes';
    await expect(
      exportarHistorias({
        historias, asentar: async () => {}, firma: () => f,
        capturar: async id => { if (id === 'b') f = 'despues'; return blob(id); },
      }),
    ).rejects.toThrow(/ajuste/i);
  });
});

describe('descargarSecuencial', () => {
  it('descarga en orden y espera entre archivos (no después del último)', async () => {
    const eventos: string[] = [];
    const files = ['a', 'b', 'c'].map(n => new File(['x'], `${n}.png`));
    await descargarSecuencial(files, {
      descargar: f => { eventos.push(`d:${f.name}`); },
      esperar: async () => { eventos.push('w'); },
    });
    expect(eventos).toEqual(['d:a.png', 'w', 'd:b.png', 'w', 'd:c.png']);
  });
});

// ── Textos (se prueban contra los mensajes reales de es/pt-BR) ──────────────
import { IntlMessageFormat } from 'intl-messageformat';
import es from '@/messages/es/historia.json';
import ptBR from '@/messages/pt-BR/historia.json';
import { avisoNoEntran, etiquetaAccion, leyendaPosicion } from './exportarHistorias';

function traductor(locale: string, mensajes: Record<string, string>) {
  return (key: string, values?: Record<string, string | number>) =>
    String(new IntlMessageFormat(mensajes[key], locale).format(values));
}
const tEs = traductor('es', es.HistoriaPreciosPage);
const tPt = traductor('pt-BR', ptBR.HistoriaPreciosPage);

describe('avisoNoEntran', () => {
  it('null cuando todas entran', () => {
    expect(avisoNoEntran([], tEs)).toBeNull();
  });

  it('nombra la categoría cuando es una sola', () => {
    expect(avisoNoEntran([h('b', 'Pies')], tEs)).toBe(
      'La historia de Pies no entra con letra legible. Sacá servicios de esa categoría para poder guardarla.',
    );
  });

  it('nombra la primera y cuenta el resto cuando son varias', () => {
    expect(avisoNoEntran([h('a', 'Uñas'), h('b', 'Pies')], tEs)).toBe(
      'La historia de Uñas y 1 más no entran con letra legible. Sacá servicios de esas categorías para poder guardarlas.',
    );
    expect(avisoNoEntran([h('a', 'Uñas'), h('b', 'Pies'), h('c', 'Cejas')], tEs)).toContain('Uñas y 2 más');
  });

  it('el mensaje existe y formatea en pt-BR', () => {
    expect(avisoNoEntran([h('a', 'Unhas'), h('b', 'Pés')], tPt)).toContain('Unhas e mais 1');
  });
});

describe('leyendaPosicion', () => {
  it('marca "no entra" solo en las historias que no entran', () => {
    expect(leyendaPosicion({ actual: 2, total: 3, nombre: 'Pies', noEntra: true }, tEs)).toBe('Historia 2 de 3 · Pies · no entra');
    expect(leyendaPosicion({ actual: 1, total: 3, nombre: 'Uñas', noEntra: false }, tEs)).toBe('Historia 1 de 3 · Uñas');
  });
});

describe('etiquetaAccion', () => {
  it('con varias imágenes lleva la cantidad', () => {
    expect(etiquetaAccion('guardar', 3, tEs)).toBe('Guardar 3');
    expect(etiquetaAccion('compartir', 3, tEs)).toBe('Compartir 3');
  });

  it('con una sola imagen mantiene el texto de siempre', () => {
    expect(etiquetaAccion('guardar', 1, tEs)).toBe('Guardar');
    expect(etiquetaAccion('compartir', 1, tEs)).toBe('Compartir');
  });
});

import { describe, expect, it } from 'vitest';
import { NIVELES_DENSIDAD, PISO_FUENTE_FILA, elegirDensidad } from './historiaDensidad';

describe('elegirDensidad', () => {
  it('elige el nivel 0 si ya entra cómodo', () => {
    expect(elegirDensidad([500, 400, 300, 250], 600)).toEqual({ nivel: 0, entra: true });
  });

  it('elige el primer nivel que entra, no el más apretado', () => {
    expect(elegirDensidad([900, 700, 500, 400], 720)).toEqual({ nivel: 1, entra: true });
    expect(elegirDensidad([900, 800, 700, 650], 700)).toEqual({ nivel: 2, entra: true });
  });

  it('entra justo cuando la altura es igual a la disponible', () => {
    expect(elegirDensidad([800, 711], 711)).toEqual({ nivel: 1, entra: true });
  });

  it('necesita el último nivel', () => {
    expect(elegirDensidad([900, 800, 700, 600], 600)).toEqual({ nivel: 3, entra: true });
  });

  it('si no entra en ninguno devuelve el último nivel medido con entra=false', () => {
    expect(elegirDensidad([1200, 1000, 900, 800], 700)).toEqual({ nivel: 3, entra: false });
  });

  it('con una medición parcial que no entra apunta al último nivel medido', () => {
    expect(elegirDensidad([1200, 1000], 700)).toEqual({ nivel: 1, entra: false });
  });

  it('sin mediciones o sin alto disponible medible no bloquea (jsdom / nodo oculto)', () => {
    expect(elegirDensidad([], 700)).toEqual({ nivel: 0, entra: true });
    expect(elegirDensidad([900, 800], 0)).toEqual({ nivel: 0, entra: true });
    expect(elegirDensidad([900, 800], Number.NaN)).toEqual({ nivel: 0, entra: true });
  });
});

describe('NIVELES_DENSIDAD', () => {
  it('hay al menos 3 niveles', () => {
    expect(NIVELES_DENSIDAD.length).toBeGreaterThanOrEqual(3);
  });

  it('ningún nivel baja de la fuente mínima legible en filas', () => {
    expect(PISO_FUENTE_FILA).toBe(12);
    for (const n of NIVELES_DENSIDAD) {
      expect(n.fuenteNombre).toBeGreaterThanOrEqual(PISO_FUENTE_FILA);
      expect(n.fuentePrecio).toBeGreaterThanOrEqual(PISO_FUENTE_FILA);
    }
  });

  it('cada nivel es igual o más compacto que el anterior', () => {
    for (let i = 1; i < NIVELES_DENSIDAD.length; i++) {
      const a = NIVELES_DENSIDAD[i - 1];
      const b = NIVELES_DENSIDAD[i];
      for (const k of Object.keys(a) as (keyof typeof a)[]) {
        expect(b[k], `${String(k)} nivel ${i}`).toBeLessThanOrEqual(a[k]);
      }
    }
  });
});

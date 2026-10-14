import { describe, expect, it } from 'vitest';
import { calcularSena, calcularSenaPreview, desgloseSena, precioSugeridoSena, senaFijaSugerida, type SenaPreviewConfig } from './senaPreview';

const pct = (p: number, extra: Partial<SenaPreviewConfig> = {}): SenaPreviewConfig => ({
  sena_tipo: 'porcentaje', sena_porcentaje: p, sena_monto: null,
  retencion_iibb_porcentaje: 0, comision_mp_vigente: 7.61, ...extra,
});
const fijo = (m: number | null, extra: Partial<SenaPreviewConfig> = {}): SenaPreviewConfig => ({
  sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: m,
  retencion_iibb_porcentaje: 0, comision_mp_vigente: 7.61, ...extra,
});

// El backend castea sena_monto como decimal:2: en el JSON llega como TEXTO
// ("5000.00"), aunque el tipo diga number. El cálculo no puede depender de que
// sea number.
describe('monto fijo que llega como texto (decimal:2 del backend)', () => {
  const fijoTexto = (m: string) => fijo(m as unknown as number);
  it('is a configured seña and computes the commission', () => {
    expect(calcularSena(10000, fijoTexto('5000.00'))).toBe(5000);
    const p = calcularSenaPreview(10000, fijoTexto('5000.00'));
    expect(p).not.toBeNull();
    expect(p!.sena).toBe(5000);
    expect(p!.cargo).toBe(Math.round((5000 * 7.61) / 100));
  });
  it('still rejects a zero or non-numeric text amount', () => {
    expect(calcularSena(10000, fijoTexto('0.00'))).toBe(0);
    expect(calcularSena(10000, fijoTexto(''))).toBe(0);
  });
});

describe('calcularSena', () => {
  it('percentage: rounds price * pct / 100', () => {
    expect(calcularSena(10400, pct(30))).toBe(3120);
    expect(calcularSena(333, pct(50))).toBe(167);
  });
  it('fixed: min(monto, price)', () => {
    expect(calcularSena(10000, fijo(5000))).toBe(5000);
    expect(calcularSena(3000, fijo(5000))).toBe(3000);
  });
  it('is capped at the price', () => {
    expect(calcularSena(1000, pct(100))).toBe(1000);
  });
  it('is 0 for an invalid config or a non-positive price', () => {
    expect(calcularSena(1000, fijo(null))).toBe(0);
    expect(calcularSena(1000, fijo(0))).toBe(0);
    expect(calcularSena(1000, pct(0))).toBe(0);
    expect(calcularSena(1000, pct(101))).toBe(0);
    expect(calcularSena(0, pct(30))).toBe(0);
    expect(calcularSena(-5, pct(30))).toBe(0);
  });
});

describe('calcularSenaPreview', () => {
  it('returns null when nothing valid is configured or price is empty', () => {
    expect(calcularSenaPreview(10000, fijo(null))).toBeNull();
    expect(calcularSenaPreview(0, pct(30))).toBeNull();
    expect(calcularSenaPreview(10000, pct(30, { comision_mp_vigente: undefined as never }))).toBeNull();
  });

  it('the client pays exactly the deposit (no gross-up); cost is taken from it', () => {
    const p = calcularSenaPreview(18000, pct(50))!;
    expect(p.sena).toBe(9000);
    expect(p.cargo).toBe(685); // round(9000 * 7.61 / 100)
    expect(p.retencion).toBe(0);
    expect(p.llega).toBe(8315);
    expect(p.costoPct).toBe(3.8); // 685 / 18000
  });

  it('includes the retention in the amounts', () => {
    const p = calcularSenaPreview(18000, pct(50, { retencion_iibb_porcentaje: 4 }))!;
    expect(p.sena).toBe(9000);
    expect(p.cargo).toBe(685);
    expect(p.retencion).toBe(360);
    expect(p.llega).toBe(9000 - 685 - 360);
  });

  it('fixed mode: exact amount, capped at the price', () => {
    expect(calcularSenaPreview(20000, fijo(5000))!.sena).toBe(5000);
    expect(calcularSenaPreview(3000, fijo(5000))!.sena).toBe(3000);
  });
});

// Redondeo de las sugerencias: SIEMPRE cubre el costo y el paso se adapta al precio. Se usa
// el paso más grande (1000, 500, 100, 50, 10, 1) cuyo redondeo hacia arriba suma como mucho
// un 5% sobre el mínimo que cubre. Así un precio chico nunca salta de golpe a otro enorme.
describe('precioSugeridoSena', () => {
  it('18000 at 50% with 7.61 -> 20000 (deposit 10000, she receives 9239 >= 9000)', () => {
    expect(precioSugeridoSena(18000, pct(50))).toBe(20000);
    const p = calcularSenaPreview(20000, pct(50))!;
    expect(p.sena).toBe(10000);
    expect(p.cargo).toBe(761);
    expect(p.llega).toBe(9239);
  });

  it('el paso se adapta al precio (tabla de ejemplos, 30% con 7,61)', () => {
    const casos: Array<[number, number]> = [
      [100, 110], [500, 550], [1000, 1100], [3000, 3300], [4000, 4500], [5000, 5500],
      [8000, 9000], [18000, 20000], [22000, 24000], [25000, 28000], [40000, 44000], [48000, 52000],
    ];
    for (const [precio, esperado] of casos) {
      expect(precioSugeridoSena(precio, pct(30)), String(precio)).toBe(esperado);
    }
  });

  it('un precio chico no salta a un múltiplo de mil (100 -> 110, no 1000)', () => {
    expect(precioSugeridoSena(100, pct(30))).toBe(110);
  });

  it('el porcentaje no condiciona el redondeo del precio (no hay que dejar la seña redonda)', () => {
    expect(precioSugeridoSena(10000, pct(25))).toBe(11000);
    expect(precioSugeridoSena(10000, pct(33))).toBe(11000);
  });

  it('SIEMPRE cubre y nunca suma más de 5% sobre el mínimo, para muchos porcentajes y precios', () => {
    const porcentajes = [10, 20, 25, 30, 33, 40, 50, 60, 75, 100];
    const precios = [100, 250, 500, 1000, 1500, 2500, 3300, 4000, 5200, 8000, 12500, 18000, 27300, 40000];
    for (const porcentaje of porcentajes) {
      for (const precio of precios) {
        const sug = precioSugeridoSena(precio, pct(porcentaje))!;
        const etiqueta = `${porcentaje}% sobre ${precio}`;
        const minimo = Math.ceil(precio / (1 - 0.0761) - 1e-9);
        // cubre: lo que llega, descontado el costo, no baja de la seña que quería
        const senaQueria = (precio * porcentaje) / 100;
        expect((sug * porcentaje / 100) * (1 - 0.0761), etiqueta).toBeGreaterThanOrEqual(senaQueria - 1e-6);
        expect(sug, etiqueta).toBeGreaterThanOrEqual(minimo);
        expect((sug - minimo) / minimo, etiqueta).toBeLessThanOrEqual(0.05 + 1e-9);
      }
    }
  });

  it('adds the retention to the rate', () => {
    // t = 11.61 -> 18000 / .8839 = 20364.5 -> 21000
    expect(precioSugeridoSena(18000, pct(50, { retencion_iibb_porcentaje: 4 }))).toBe(21000);
  });

  it('caps the combined rate at 95', () => {
    // t = 95 -> 1000 / .05 = 20000
    expect(precioSugeridoSena(1000, pct(100, { comision_mp_vigente: 90, retencion_iibb_porcentaje: 20 }))).toBe(20000);
  });

  it('sin costo que cubrir (t = 0) no toca el precio', () => {
    expect(precioSugeridoSena(18000, pct(50, { comision_mp_vigente: 0 }))).toBe(18000);
    expect(precioSugeridoSena(18100, pct(50, { comision_mp_vigente: 0 }))).toBe(18100);
  });

  it('is null for price 0 / invalid, fixed mode, invalid config or unknown commission', () => {
    expect(precioSugeridoSena(0, pct(50))).toBeNull();
    expect(precioSugeridoSena(-10, pct(50))).toBeNull();
    expect(precioSugeridoSena(18000, fijo(5000))).toBeNull();
    expect(precioSugeridoSena(18000, pct(0))).toBeNull();
    expect(precioSugeridoSena(18000, pct(50, { comision_mp_vigente: null }))).toBeNull();
  });
});

describe('desgloseSena (monto fijo, sin precio)', () => {
  it('splits a fixed seña into MP fee and net', () => {
    expect(desgloseSena(5000, { comision_mp_vigente: 7.61 })).toEqual({ sena: 5000, cargo: 381, retencion: 0, llega: 4619 });
  });
  it('includes the tax retention', () => {
    expect(desgloseSena(5000, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 2 }))
      .toEqual({ sena: 5000, cargo: 381, retencion: 100, llega: 4519 });
  });
  it('is null without a positive seña or without the commission', () => {
    expect(desgloseSena(0, { comision_mp_vigente: 7.61 })).toBeNull();
    expect(desgloseSena(5000, { comision_mp_vigente: null })).toBeNull();
  });
});

describe('senaFijaSugerida', () => {
  it('raises the seña, rounded UP, so the net covers the typed amount', () => {
    // 5000 / (1 - 0.0761) = 5411,7 -> 5412 -> paso de 500 (suba de 88) -> 5500
    expect(senaFijaSugerida(5000, { comision_mp_vigente: 7.61 })).toBe(5500);
    const d = desgloseSena(5500, { comision_mp_vigente: 7.61 })!;
    expect(d.llega).toBeGreaterThanOrEqual(5000);
  });
  it('el paso se adapta al monto (nunca más de 5% sobre el mínimo)', () => {
    expect(senaFijaSugerida(3000, { comision_mp_vigente: 7.61 })).toBe(3300);
    expect(senaFijaSugerida(4000, { comision_mp_vigente: 7.61 })).toBe(4500);
    expect(senaFijaSugerida(10000, { comision_mp_vigente: 7.61 })).toBe(11000);
    expect(senaFijaSugerida(25000, { comision_mp_vigente: 7.61 })).toBe(28000);
  });
  it('SIEMPRE cubre y nunca suma más de 5% sobre el mínimo', () => {
    for (const monto of [1000, 1500, 2000, 3000, 4500, 5000, 7500, 10000, 15000, 25000, 40000]) {
      const sug = senaFijaSugerida(monto, { comision_mp_vigente: 7.61 })!;
      const minimo = Math.ceil(monto / (1 - 0.0761) - 1e-9);
      expect(sug * (1 - 0.0761), String(monto)).toBeGreaterThanOrEqual(monto - 1e-6);
      expect((sug - minimo) / minimo, String(monto)).toBeLessThanOrEqual(0.05 + 1e-9);
    }
  });
  it('accounts for the tax retention', () => {
    // 5000 / (1 - 0.0961) = 5531,3 -> 5532 -> paso de 100 -> 5600
    expect(senaFijaSugerida(5000, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 2 })).toBe(5600);
  });
  it('sin costo que cubrir (t = 0) no toca el monto', () => {
    expect(senaFijaSugerida(100, { comision_mp_vigente: 0 })).toBe(100);
    expect(senaFijaSugerida(5300, { comision_mp_vigente: 0 })).toBe(5300);
  });
  it('is null without a positive amount or without the commission', () => {
    expect(senaFijaSugerida(0, { comision_mp_vigente: 7.61 })).toBeNull();
    expect(senaFijaSugerida(5000, {})).toBeNull();
  });
});

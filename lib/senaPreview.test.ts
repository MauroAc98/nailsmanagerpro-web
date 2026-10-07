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

describe('precioSugeridoSena', () => {
  it('18000 at 50% with 7.61 -> 19600 (deposit 9800, she receives 9054 >= 9000)', () => {
    expect(precioSugeridoSena(18000, pct(50))).toBe(19600);
    const p = calcularSenaPreview(19600, pct(50))!;
    expect(p.sena).toBe(9800);
    expect(p.cargo).toBe(746);
    expect(p.llega).toBe(9054);
  });

  it('result is a multiple of the clean step for several percentages', () => {
    const casos: Array<[number, number]> = [[100, 100], [50, 200], [20, 500], [40, 500], [30, 1000]];
    for (const [porcentaje, paso] of casos) {
      const s = precioSugeridoSena(18000, pct(porcentaje))!;
      expect(s % paso).toBe(0);
      expect((s * porcentaje / 100) % 100).toBe(0);
      expect(s).toBeGreaterThanOrEqual(Math.ceil(18000 / (1 - 0.0761)));
    }
  });

  it('30% -> step 1000', () => {
    expect(precioSugeridoSena(18000, pct(30))).toBe(20000);
  });

  it('adds the retention to the rate', () => {
    // t = 11.61 -> 18000 / .8839 = 20365.1 -> multiple of 200 -> 20400
    expect(precioSugeridoSena(18000, pct(50, { retencion_iibb_porcentaje: 4 }))).toBe(20400);
  });

  it('caps the combined rate at 95', () => {
    // t = 95 -> 1000 / .05 = 20000
    expect(precioSugeridoSena(1000, pct(100, { comision_mp_vigente: 90, retencion_iibb_porcentaje: 20 }))).toBe(20000);
  });

  it('t = 0: P_min = price, rounded up to the step only', () => {
    expect(precioSugeridoSena(18000, pct(50, { comision_mp_vigente: 0 }))).toBe(18000);
    expect(precioSugeridoSena(18100, pct(50, { comision_mp_vigente: 0 }))).toBe(18200);
  });

  it('pct 100 uses a step of 100', () => {
    expect(precioSugeridoSena(1000, pct(100))).toBe(1100); // 1000/.9239 = 1082.4
  });

  it('is null for price 0 / invalid, fixed mode, non-integer pct, invalid config or unknown commission', () => {
    expect(precioSugeridoSena(0, pct(50))).toBeNull();
    expect(precioSugeridoSena(-10, pct(50))).toBeNull();
    expect(precioSugeridoSena(18000, fijo(5000))).toBeNull();
    expect(precioSugeridoSena(18000, pct(12.5))).toBeNull();
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
  it('raises the seña, rounded UP to a multiple of 100, so the net covers the typed amount', () => {
    // 5000 / (1 - 0.0761) = 5411,7 -> 5500
    expect(senaFijaSugerida(5000, { comision_mp_vigente: 7.61 })).toBe(5500);
    const d = desgloseSena(5500, { comision_mp_vigente: 7.61 })!;
    expect(d.llega).toBeGreaterThanOrEqual(5000);
  });
  it('accounts for the tax retention', () => {
    // 5000 / (1 - 0.0961) = 5531,3 -> 5600
    expect(senaFijaSugerida(5000, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 2 })).toBe(5600);
  });
  it('is exact when the amount already lands on a multiple of 100 after gross-up', () => {
    expect(senaFijaSugerida(100, { comision_mp_vigente: 0 })).toBe(100);
  });
  it('is null without a positive amount or without the commission', () => {
    expect(senaFijaSugerida(0, { comision_mp_vigente: 7.61 })).toBeNull();
    expect(senaFijaSugerida(5000, {})).toBeNull();
  });
});

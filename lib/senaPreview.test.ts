import { describe, expect, it } from 'vitest';
import { calcularSena, calcularSenaCobrada, calcularSenaPreview, type SenaPreviewConfig } from './senaPreview';

const pct = (p: number, extra: Partial<SenaPreviewConfig> = {}): SenaPreviewConfig => ({
  sena_tipo: 'porcentaje', sena_porcentaje: p, sena_monto: null,
  retencion_iibb_porcentaje: 0, comision_mp_vigente: 7.61, ...extra,
});
const fijo = (m: number | null, extra: Partial<SenaPreviewConfig> = {}): SenaPreviewConfig => ({
  sena_tipo: 'fijo', sena_porcentaje: null, sena_monto: m,
  retencion_iibb_porcentaje: 0, comision_mp_vigente: 7.61, ...extra,
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

describe('calcularSenaCobrada', () => {
  it('grosses the net deposit up so Mercado Pago cost is covered, in multiples of $100', () => {
    // 18000 al 50% -> neta 9000 -> 9000 / (1 - .0761) = 9741.6 -> 9800
    expect(calcularSenaCobrada(18000, pct(50))).toBe(9800);
    expect(calcularSenaCobrada(18000, pct(50)) % 100).toBe(0);
  });
  it('applies to fixed mode too', () => {
    expect(calcularSenaCobrada(20000, fijo(5000))).toBe(5500); // 5000/.9239=5411.8 -> 5500
  });
  it('adds the retention to the rate', () => {
    // t = 7.61 + 4 = 11.61 -> 9000 / .8839 = 10181.9 -> 10200
    expect(calcularSenaCobrada(18000, pct(50, { retencion_iibb_porcentaje: 4 }))).toBe(10200);
  });
  it('is capped at the price', () => {
    expect(calcularSenaCobrada(5000, pct(100))).toBe(5000);
    expect(calcularSenaCobrada(5050, pct(100))).toBe(5050);
  });
  it('caps the combined rate at 95', () => {
    // t = 95 -> 1000 / .05 = 20000
    expect(calcularSenaCobrada(50000, fijo(1000, { comision_mp_vigente: 90, retencion_iibb_porcentaje: 20 }))).toBe(20000);
  });
  it('is 0 when the net deposit is 0', () => {
    expect(calcularSenaCobrada(1000, fijo(null))).toBe(0);
    expect(calcularSenaCobrada(0, pct(30))).toBe(0);
  });
});

describe('calcularSenaPreview', () => {
  it('returns null when nothing valid is configured or price is empty', () => {
    expect(calcularSenaPreview(10000, fijo(null))).toBeNull();
    expect(calcularSenaPreview(0, pct(30))).toBeNull();
    expect(calcularSenaPreview(10000, pct(30, { comision_mp_vigente: undefined as never }))).toBeNull();
  });

  it('computes net, charged, cost and what the professional receives', () => {
    const p = calcularSenaPreview(18000, pct(50))!;
    expect(p.neta).toBe(9000);
    expect(p.sena).toBe(9800);
    expect(p.cargo).toBe(746); // round(9800 * 7.61 / 100)
    expect(p.retencion).toBe(0);
    expect(p.llega).toBe(9054);
    expect(p.restaSalon).toBe(9000); // precio - neta
    expect(p.costoPct).toBe(4.1); // 746 / 18000
  });

  it('includes the retention in the amounts', () => {
    const p = calcularSenaPreview(18000, pct(50, { retencion_iibb_porcentaje: 4 }))!;
    expect(p.sena).toBe(10200);
    expect(p.cargo).toBe(Math.round(10200 * 7.61 / 100));
    expect(p.retencion).toBe(Math.round(10200 * 4 / 100));
    expect(p.llega).toBe(10200 - p.cargo - p.retencion);
  });

  it('fixed mode works the same way', () => {
    const p = calcularSenaPreview(20000, fijo(5000))!;
    expect(p.neta).toBe(5000);
    expect(p.sena).toBe(5500);
    expect(p.restaSalon).toBe(15000);
  });
});

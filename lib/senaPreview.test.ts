import { describe, expect, it } from 'vitest';
import { calcularSena, calcularSenaPreview, type SenaPreviewConfig } from './senaPreview';

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

describe('calcularSenaPreview', () => {
  it('returns null when nothing valid is configured or price is empty', () => {
    expect(calcularSenaPreview(10000, fijo(null))).toBeNull();
    expect(calcularSenaPreview(0, pct(30))).toBeNull();
    expect(calcularSenaPreview(10000, pct(30, { comision_mp_vigente: undefined as never }))).toBeNull();
  });

  it('computes what the client sees and what the professional receives', () => {
    const p = calcularSenaPreview(10400, pct(30, { retencion_iibb_porcentaje: 4 }))!;
    expect(p.sena).toBe(3120);
    expect(p.resta).toBe(7280);
    expect(p.cargo).toBe(Math.round(3120 * 7.61 / 100)); // 237
    expect(p.retencion).toBe(Math.round(3120 * 4 / 100)); // 125
    expect(p.llega).toBe(3120 - 237 - 125);
    expect(p.costoPct).toBe(Math.round(((237 + 125) / 10400) * 1000) / 10);
    expect(p.porcentaje).toBe(30);
  });

  it('retention 0 yields no retention', () => {
    expect(calcularSenaPreview(10000, pct(50))!.retencion).toBe(0);
  });

  it('suggests a clean price in percentage mode when the seña is not round', () => {
    // 30% -> step = 10000/gcd(10000,30) = 1000
    const p = calcularSenaPreview(10400, pct(30))!;
    expect(p.sugerencia).toBe(11000);
    expect(p.senaSugerida).toBe(3300);
  });

  it('has no suggestion when the price is already on the step', () => {
    expect(calcularSenaPreview(11000, pct(30))!.sugerencia).toBeNull();
  });

  it('step for 20% is 500, for 50% is 200, for 100% is 100', () => {
    expect(calcularSenaPreview(10100, pct(20))!.sugerencia).toBe(10500);
    expect(calcularSenaPreview(10100, pct(50))!.sugerencia).toBe(10200);
    expect(calcularSenaPreview(10150, pct(100))!.sugerencia).toBe(10200);
    expect(calcularSenaPreview(10100, pct(100))!.sugerencia).toBeNull();
  });

  it('has no suggestion for a non-integer percentage or fixed mode', () => {
    expect(calcularSenaPreview(10400, pct(12.5))!.sugerencia).toBeNull();
    const f = calcularSenaPreview(10400, fijo(5000))!;
    expect(f.sugerencia).toBeNull();
    expect(f.porcentaje).toBeNull();
    expect(f.sena).toBe(5000);
  });
});

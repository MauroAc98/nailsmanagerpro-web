import { describe, expect, it } from 'vitest';
import { calcularSena, calcularSenaPreview, desgloseSena, pasoSenaPorcentaje, senaFijaSugerida, senaMinimaQueCubre, type SenaPreviewConfig } from './senaPreview';

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
  // Espeja MercadoPagoService::senaParaPrecio del backend: el porcentaje del precio final del turno,
  // más lo necesario para cubrir la comisión de MP (y la retención), redondeado hacia arriba.
  // A la profesional le llega, como mínimo, el porcentaje; el cliente deja un poco más.
  it('percentage: covers the commission and rounds UP (30% with 7,61)', () => {
    const casos: Array<[number, number]> = [
      [3000, 1000], [4000, 1500], [12000, 4000], [22000, 7500], [25000, 8500], [28000, 9500],
      [40000, 13000], [48000, 16000], [62000, 20500],
    ];
    for (const [precio, esperada] of casos) {
      expect(calcularSena(precio, pct(30)), String(precio)).toBe(esperada);
    }
  });
  it('percentage: what arrives after the commission is never below the percentage', () => {
    for (const porcentaje of [10, 20, 25, 30, 33, 40, 50]) {
      for (const precio of [1500, 3000, 4000, 12000, 22000, 25000, 28000, 40000, 62000]) {
        const sena = calcularSena(precio, pct(porcentaje));
        const llega = sena - Math.round((sena * 7.61) / 100);
        expect(llega, `${porcentaje}% de ${precio}`).toBeGreaterThanOrEqual((precio * porcentaje) / 100 - 1e-6);
        expect(sena, `${porcentaje}% de ${precio}`).toBeLessThanOrEqual(precio);
      }
    }
  });
  it('percentage: also covers the tax retention', () => {
    // 9000 / (1 - 0.1161) = 10183 -> 10500
    expect(calcularSena(18000, pct(50, { retencion_iibb_porcentaje: 4 }))).toBe(10500);
  });
  it('percentage: a small deposit uses a smaller step (< 100 -> 10, < 500 -> 100, from 500 -> 500)', () => {
    expect(calcularSena(100, pct(30))).toBe(40); // 30 -> 33 -> 40
    expect(calcularSena(111, pct(30))).toBe(40); // 33,3 -> 37 -> 40
    expect(calcularSena(1000, pct(30))).toBe(400); // 300 -> 325 -> 400
    expect(calcularSena(1115, pct(30))).toBe(400); // 334,5 -> 363 -> 400
    expect(calcularSena(1500, pct(30))).toBe(500); // 450 -> 488 -> 500
    expect(calcularSena(1666, pct(30))).toBe(1000); // 499,8 -> 541 -> paso 500
    expect(calcularSena(333, pct(50))).toBe(200); // 166,5 -> 181 -> 200
  });
  it('percentage: a deposit never exceeds the price', () => {
    expect(calcularSena(100, pct(100))).toBe(100);
    expect(calcularSena(600, pct(100))).toBe(600);
    expect(calcularSena(1250, pct(100))).toBe(1250);
    expect(calcularSena(18000, pct(100))).toBe(18000);
  });
  it('percentage without commission data falls back to the plain rounded percentage', () => {
    expect(calcularSena(22000, pct(30, { comision_mp_vigente: undefined as never }))).toBe(7000); // 6600 -> 7000
  });
  it('pasoSenaPorcentaje mirrors the backend thresholds', () => {
    expect(pasoSenaPorcentaje(9)).toBe(10);
    expect(pasoSenaPorcentaje(99.99)).toBe(10);
    expect(pasoSenaPorcentaje(100)).toBe(100);
    expect(pasoSenaPorcentaje(499.99)).toBe(100);
    expect(pasoSenaPorcentaje(500)).toBe(500);
    expect(pasoSenaPorcentaje(14400)).toBe(500);
  });
  it('senaMinimaQueCubre is the exact percentage grossed up for the cost', () => {
    expect(senaMinimaQueCubre(18600, { comision_mp_vigente: 7.61 })).toBe(20133); // 18600 / 0.9239 = 20132,04
    expect(senaMinimaQueCubre(9000, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 4 })).toBe(10183);
    expect(senaMinimaQueCubre(3000, { comision_mp_vigente: 0 })).toBe(3000);
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

  it('the deposit covers the cost: what arrives is at least the percentage (9.000 of 18.000)', () => {
    const p = calcularSenaPreview(18000, pct(50))!;
    expect(p.sena).toBe(10000); // 9.000 / 0,9239 = 9.742 -> 10.000
    expect(p.cargo).toBe(761); // round(10000 * 7.61 / 100)
    expect(p.retencion).toBe(0);
    expect(p.llega).toBe(9239);
    expect(p.llega).toBeGreaterThanOrEqual(9000);
    expect(p.costoPct).toBe(4.2); // 761 / 18000
  });

  it('includes the retention in the amounts', () => {
    const p = calcularSenaPreview(18000, pct(50, { retencion_iibb_porcentaje: 4 }))!;
    expect(p.sena).toBe(10500);
    expect(p.cargo).toBe(799);
    expect(p.retencion).toBe(420);
    expect(p.llega).toBe(10500 - 799 - 420);
    expect(p.llega).toBeGreaterThanOrEqual(9000);
  });

  it('fixed mode: exact amount, capped at the price', () => {
    expect(calcularSenaPreview(20000, fijo(5000))!.sena).toBe(5000);
    expect(calcularSenaPreview(3000, fijo(5000))!.sena).toBe(3000);
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
  // La seña siempre queda en múltiplos de 500 (billetes redondos para completar en el local).
  // Sólo si subir a 500 pasa del 10% sobre el mínimo se usa un paso de 100.
  it('raises the seña, rounded UP to 500, so the net covers the typed amount', () => {
    // 5000 / (1 - 0.0761) = 5411,7 -> 5412 -> 5500
    expect(senaFijaSugerida(5000, { comision_mp_vigente: 7.61 })).toBe(5500);
    const d = desgloseSena(5500, { comision_mp_vigente: 7.61 })!;
    expect(d.llega).toBeGreaterThanOrEqual(5000);
  });
  it('sugiere múltiplos de 500 (3000 -> 3500, 4000 -> 4500, 10000 -> 11000, 25000 -> 27500)', () => {
    expect(senaFijaSugerida(3000, { comision_mp_vigente: 7.61 })).toBe(3500);
    expect(senaFijaSugerida(4000, { comision_mp_vigente: 7.61 })).toBe(4500);
    expect(senaFijaSugerida(10000, { comision_mp_vigente: 7.61 })).toBe(11000);
    expect(senaFijaSugerida(25000, { comision_mp_vigente: 7.61 })).toBe(27500);
  });
  it('un monto chico no salta a otro enorme (1000 -> 1100, no 1500)', () => {
    expect(senaFijaSugerida(1000, { comision_mp_vigente: 7.61 })).toBe(1100);
  });
  it('un monto muy chico baja a un paso de 10 en vez de duplicarse (100 -> 110, no 200)', () => {
    // 100 / (1 - 0.0761) = 108,2 -> 109: con paso 500 daría 500 y con paso 100 daría 200.
    expect(senaFijaSugerida(100, { comision_mp_vigente: 7.61 })).toBe(110);
    expect(senaFijaSugerida(200, { comision_mp_vigente: 7.61 })).toBe(220);
    expect(senaFijaSugerida(300, { comision_mp_vigente: 7.61 })).toBe(330);
    expect(senaFijaSugerida(500, { comision_mp_vigente: 7.61 })).toBe(550);
  });
  it('SIEMPRE cubre y nunca suma más de 10% sobre el mínimo', () => {
    for (const monto of [100, 200, 300, 500, 1000, 1500, 2000, 3000, 4500, 5000, 7500, 10000, 15000, 25000, 40000]) {
      const sug = senaFijaSugerida(monto, { comision_mp_vigente: 7.61 })!;
      const minimo = Math.ceil(monto / (1 - 0.0761) - 1e-9);
      expect(sug * (1 - 0.0761), String(monto)).toBeGreaterThanOrEqual(monto - 1e-6);
      expect((sug - minimo) / minimo, String(monto)).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });
  it('accounts for the tax retention', () => {
    // 5000 / (1 - 0.0961) = 5531,3 -> 5532 -> 6000 (8,5% sobre el mínimo)
    expect(senaFijaSugerida(5000, { comision_mp_vigente: 7.61, retencion_iibb_porcentaje: 2 })).toBe(6000);
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

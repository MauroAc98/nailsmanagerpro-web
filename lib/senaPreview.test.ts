import { describe, expect, it } from 'vitest';
import { calcularSena, calcularSenaPreview, desgloseSena, pasoSenaPorcentaje, precioSugeridoSena, senaFijaSugerida, type SenaPreviewConfig } from './senaPreview';

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
  // Espeja MercadoPagoService::senaParaPrecio del backend: la seña por porcentaje se
  // redondea hacia arriba a un múltiplo de 500 para que el cliente complete la
  // diferencia en el local con billetes redondos.
  it('percentage: rounds price * pct / 100 UP to a multiple of 500', () => {
    expect(calcularSena(10400, pct(30))).toBe(3500); // 3120
    expect(calcularSena(22000, pct(30))).toBe(7000); // 6600
    expect(calcularSena(3000, pct(30))).toBe(1000); // 900
    expect(calcularSena(48000, pct(30))).toBe(14500); // 14400
  });
  it('percentage: an exact multiple of 500 does not move', () => {
    expect(calcularSena(25000, pct(30))).toBe(7500);
    expect(calcularSena(18000, pct(50))).toBe(9000);
  });
  it('percentage: a small deposit uses a smaller step (< 100 -> 10, < 500 -> 100, from 500 -> 500)', () => {
    expect(calcularSena(100, pct(30))).toBe(30); // no salta a 100
    expect(calcularSena(111, pct(30))).toBe(40); // 33,3
    expect(calcularSena(1000, pct(30))).toBe(300);
    expect(calcularSena(1500, pct(30))).toBe(500); // 450
    expect(calcularSena(1666, pct(30))).toBe(500); // 499,8
    expect(calcularSena(1700, pct(30))).toBe(1000); // 510 ya usa el paso de 500
    expect(calcularSena(333, pct(50))).toBe(200); // 166,5
  });
  it('percentage: a deposit never exceeds the price', () => {
    expect(calcularSena(100, pct(100))).toBe(100);
    expect(calcularSena(1250, pct(100))).toBe(1250);
    expect(calcularSena(600, pct(100))).toBe(600); // 600 -> 1000 por el paso, tope 600
  });
  it('pasoSenaPorcentaje mirrors the backend thresholds', () => {
    expect(pasoSenaPorcentaje(9)).toBe(10);
    expect(pasoSenaPorcentaje(99.99)).toBe(10);
    expect(pasoSenaPorcentaje(100)).toBe(100);
    expect(pasoSenaPorcentaje(499.99)).toBe(100);
    expect(pasoSenaPorcentaje(500)).toBe(500);
    expect(pasoSenaPorcentaje(14400)).toBe(500);
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

// La sugerencia busca que la profesional NO PIERDA plata por la comisión: con el precio
// nuevo, lo que cobra (precio menos el costo de Mercado Pago sobre la seña ya redondeada)
// alcanza al precio de hoy. Redondeo: el paso más grande entre 1000, 500, 100, 50, 10 y 1 que
// no pase del 1,5% del precio sobre el mínimo; el paso mínimo es 10 / 100 / 1000 según el precio.
describe('precioSugeridoSena', () => {
  const llegaConPrecio = (precio: number, porcentaje: number, extra: Partial<SenaPreviewConfig> = {}) => {
    const p = calcularSenaPreview(precio, pct(porcentaje, extra))!;
    return precio - p.cargo - p.retencion;
  };

  it('18000 at 50% -> 18800: she keeps at least 18000 after the commission', () => {
    expect(precioSugeridoSena(18000, pct(50))).toBe(18800);
    expect(llegaConPrecio(18800, 50)).toBeGreaterThanOrEqual(18000);
  });

  it('tabla de ejemplos con 30% y 7,61 (catálogo real de un salón)', () => {
    const casos: Array<[number, number]> = [
      [3000, 3100], [4000, 4200], [5000, 5200], [10000, 10300], [18000, 18500], [22000, 22600],
      [25000, 25700], [28000, 29000], [40000, 41000], [45000, 47000], [48000, 50000],
    ];
    for (const [precio, esperado] of casos) {
      expect(precioSugeridoSena(precio, pct(30)), String(precio)).toBe(esperado);
    }
  });

  it('con seña del 100% el aumento es de ~8-10% (todo el precio paga comisión)', () => {
    expect(precioSugeridoSena(18000, pct(100))).toBe(19500);
    expect(precioSugeridoSena(48000, pct(100))).toBe(52000);
  });

  it('un precio de $45.000 o más usa miles redondos, no $46.500', () => {
    expect(precioSugeridoSena(45000, pct(30))).toBe(47000);
    expect(precioSugeridoSena(48000, pct(30))).toBe(50000);
  });

  it('SIEMPRE cubre y se mantiene cerca del mínimo, para muchos porcentajes y precios', () => {
    const porcentajes = [10, 20, 25, 30, 33, 40, 50, 60, 75, 100];
    const precios = [1000, 1500, 2500, 3300, 4000, 5200, 8000, 12500, 18000, 27300, 40000, 52000];
    for (const porcentaje of porcentajes) {
      for (const precio of precios) {
        const sug = precioSugeridoSena(precio, pct(porcentaje))!;
        const etiqueta = `${porcentaje}% sobre ${precio}`;
        expect(llegaConPrecio(sug, porcentaje), etiqueta).toBeGreaterThanOrEqual(precio);
        // mínimo analítico: la comisión sobre la seña (sin redondear) cubierta
        const minimo = Math.ceil(precio / (1 - (porcentaje / 100) * 0.0761) - 1e-9);
        const piso = precio < 40000 ? 100 : 1000;
        expect(sug, etiqueta).toBeGreaterThanOrEqual(minimo);
        expect(sug - minimo, etiqueta).toBeLessThanOrEqual(Math.max(precio * 0.015, piso) + 500);
        expect(sug % 100, etiqueta).toBe(0);
      }
    }
  });

  it('un precio chico se sugiere en pasos de 10 y también cubre', () => {
    const sug = precioSugeridoSena(100, pct(30))!;
    expect(sug).toBeGreaterThan(100);
    expect(sug % 10).toBe(0);
    expect(llegaConPrecio(sug, 30)).toBeGreaterThanOrEqual(100);
  });

  it('adds the retention to the cost', () => {
    expect(precioSugeridoSena(18000, pct(50, { retencion_iibb_porcentaje: 4 }))).toBe(19200);
    expect(llegaConPrecio(19200, 50, { retencion_iibb_porcentaje: 4 })).toBeGreaterThanOrEqual(18000);
  });

  it('with an impossible rate (costs above 95%) it falls back to the capped-rate estimate', () => {
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
  it('SIEMPRE cubre y nunca suma más de 10% sobre el mínimo', () => {
    for (const monto of [1000, 1500, 2000, 3000, 4500, 5000, 7500, 10000, 15000, 25000, 40000]) {
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

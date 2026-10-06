// Vista previa de la seña al editar el precio de un servicio. Espeja el
// backend (NailsManagerProApi): el cliente paga EXACTAMENTE la seña. El costo
// de Mercado Pago sale de ese monto; para cubrirlo la app sugiere un precio
// (precioSugeridoSena), nunca se lo cobra de más al cliente.

export interface SenaPreviewConfig {
  sena_tipo?: 'fijo' | 'porcentaje' | null;
  sena_porcentaje?: number | null;
  sena_monto?: number | null;
  retencion_iibb_porcentaje?: number | null;
  /** Comisión de MP con IVA ya aplicado (ej. 7.61). */
  comision_mp_vigente?: number | null;
}

export interface SenaPreview {
  precio: number;
  /** Seña que paga el cliente. */
  sena: number;
  cargo: number;
  retencion: number;
  /** Lo que le llega a la profesional: seña menos costos. */
  llega: number;
  /** Costo (MP + retención) como % del precio, con un decimal. */
  costoPct: number;
}

function configValida(c: SenaPreviewConfig): boolean {
  if (c.sena_tipo === 'porcentaje') {
    const p = c.sena_porcentaje;
    return typeof p === 'number' && Number.isFinite(p) && p >= 1 && p <= 100;
  }
  const m = c.sena_monto;
  return typeof m === 'number' && Number.isFinite(m) && m > 0;
}

export function calcularSena(precio: number, c: SenaPreviewConfig): number {
  if (!(precio > 0) || !configValida(c)) return 0;
  const bruta = c.sena_tipo === 'porcentaje'
    ? Math.round((precio * (c.sena_porcentaje as number)) / 100)
    : (c.sena_monto as number);
  return Math.min(bruta, precio);
}

function tasaCosto(c: SenaPreviewConfig): number {
  return Math.min((c.comision_mp_vigente ?? 0) + (c.retencion_iibb_porcentaje ?? 0), 95);
}

function mcd(a: number, b: number): number {
  return b === 0 ? a : mcd(b, a % b);
}

// Precio sugerido (modo porcentaje): cubre el costo de MP para que la
// profesional reciba lo que quería y deja precio y seña en múltiplos de $100.
// P_min = ceil(p / (1 - t/100)); se redondea al múltiplo de
// lcm(100, 10000 / mcd(10000, pct)) más cercano hacia arriba.
export function precioSugeridoSena(precio: number, c: SenaPreviewConfig): number | null {
  if (c.sena_tipo !== 'porcentaje' || !configValida(c)) return null;
  if (!(precio > 0) || !Number.isFinite(precio)) return null;
  const pct = c.sena_porcentaje as number;
  if (!Number.isInteger(pct)) return null;
  if (typeof c.comision_mp_vigente !== 'number' || !Number.isFinite(c.comision_mp_vigente)) return null;

  const pMin = Math.ceil(precio / (1 - tasaCosto(c) / 100) - 1e-9);
  const base = 10000 / mcd(10000, pct);
  const paso = (100 * base) / mcd(100, base);
  return Math.ceil(pMin / paso) * paso;
}

export function calcularSenaPreview(precio: number, c: SenaPreviewConfig): SenaPreview | null {
  if (!(precio > 0) || !configValida(c)) return null;
  const comision = c.comision_mp_vigente;
  if (typeof comision !== 'number' || !Number.isFinite(comision)) return null;

  const sena = calcularSena(precio, c);
  const cargo = Math.round((sena * comision) / 100);
  const retencion = Math.round((sena * (c.retencion_iibb_porcentaje ?? 0)) / 100);

  return {
    precio,
    sena,
    cargo,
    retencion,
    llega: sena - cargo - retencion,
    costoPct: Math.round(((cargo + retencion) / precio) * 1000) / 10,
  };
}

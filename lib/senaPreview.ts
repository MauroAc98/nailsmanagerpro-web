// Vista previa de la seña al editar el precio de un servicio. Espeja el
// cálculo del backend (NailsManagerProApi): el cliente paga EXACTAMENTE la
// seña (sin gross-up) y la profesional absorbe el costo de Mercado Pago.

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
  sena: number;
  resta: number;
  cargo: number;
  retencion: number;
  llega: number;
  /** Costo (MP + retención) como % del precio, con un decimal. */
  costoPct: number;
  /** Porcentaje de la seña; null en modo fijo. */
  porcentaje: number | null;
  /** Precio "redondo" sugerido (solo porcentaje entero y precio fuera de paso). */
  sugerencia: number | null;
  senaSugerida: number | null;
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

function mcd(a: number, b: number): number {
  return b === 0 ? a : mcd(b, a % b);
}

export function calcularSenaPreview(precio: number, c: SenaPreviewConfig): SenaPreview | null {
  if (!(precio > 0) || !configValida(c)) return null;
  const comision = c.comision_mp_vigente;
  if (typeof comision !== 'number' || !Number.isFinite(comision)) return null;

  const sena = calcularSena(precio, c);
  const cargo = Math.round((sena * comision) / 100);
  const retencion = Math.round((sena * (c.retencion_iibb_porcentaje ?? 0)) / 100);
  const esPorcentaje = c.sena_tipo === 'porcentaje';
  const pct = esPorcentaje ? (c.sena_porcentaje as number) : null;

  let sugerencia: number | null = null;
  let senaSugerida: number | null = null;
  if (pct !== null && Number.isInteger(pct)) {
    const paso = 10000 / mcd(10000, pct);
    if (precio % paso !== 0) {
      sugerencia = Math.ceil(precio / paso) * paso;
      senaSugerida = calcularSena(sugerencia, c);
    }
  }

  return {
    precio,
    sena,
    resta: precio - sena,
    cargo,
    retencion,
    llega: sena - cargo - retencion,
    costoPct: Math.round(((cargo + retencion) / precio) * 1000) / 10,
    porcentaje: pct,
    sugerencia,
    senaSugerida,
  };
}

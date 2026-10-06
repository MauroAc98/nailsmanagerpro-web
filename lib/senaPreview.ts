// Vista previa de la seña al editar el precio de un servicio. Espeja el
// cálculo del backend (NailsManagerProApi): la seña neta que quiere la
// profesional se "infla" para cubrir el costo de Mercado Pago, y el cliente
// paga un único monto redondeado a múltiplos de $100.

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
  /** Seña neta: lo que la profesional quiere que le llegue. */
  neta: number;
  /** Seña cobrada: lo que paga el cliente (múltiplo de $100). */
  sena: number;
  /** Lo que se cobra en el salón: precio menos la seña neta. */
  restaSalon: number;
  cargo: number;
  retencion: number;
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

export function calcularSenaCobrada(precio: number, c: SenaPreviewConfig): number {
  const neta = calcularSena(precio, c);
  if (neta <= 0) return 0;
  const tasa = Math.min((c.comision_mp_vigente ?? 0) + (c.retencion_iibb_porcentaje ?? 0), 95);
  return Math.min(precio, Math.ceil(neta / (1 - tasa / 100) / 100) * 100);
}

export function calcularSenaPreview(precio: number, c: SenaPreviewConfig): SenaPreview | null {
  if (!(precio > 0) || !configValida(c)) return null;
  const comision = c.comision_mp_vigente;
  if (typeof comision !== 'number' || !Number.isFinite(comision)) return null;

  const neta = calcularSena(precio, c);
  const sena = calcularSenaCobrada(precio, c);
  const cargo = Math.round((sena * comision) / 100);
  const retencion = Math.round((sena * (c.retencion_iibb_porcentaje ?? 0)) / 100);

  return {
    precio,
    neta,
    sena,
    restaSalon: precio - neta,
    cargo,
    retencion,
    llega: sena - cargo - retencion,
    costoPct: Math.round(((cargo + retencion) / precio) * 1000) / 10,
  };
}

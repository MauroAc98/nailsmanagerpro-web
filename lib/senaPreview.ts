// Vista previa de la seña al editar el precio de un servicio. Espeja el
// backend (NailsManagerProApi): el cliente paga EXACTAMENTE la seña. El costo
// de Mercado Pago sale de ese monto; para cubrirlo la app sugiere un precio
// (precioSugeridoSena), nunca se lo cobra de más al cliente.

export interface SenaPreviewConfig {
  sena_tipo?: 'fijo' | 'porcentaje' | null;
  sena_porcentaje?: number | null;
  // El backend lo castea decimal:2: en el JSON llega como texto ("5000.00").
  sena_monto?: number | string | null;
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

// ¿El salón tiene una seña bien configurada (porcentaje 1–100 o monto fijo > 0)?
// Exportada para que la UI distinga "no configuró la seña" de "falta el precio".
export function senaConfigurada(c: SenaPreviewConfig): boolean {
  return configValida(c);
}

// Número finito de un valor que puede venir como texto; null si no lo es.
function comoNumero(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function configValida(c: SenaPreviewConfig): boolean {
  if (c.sena_tipo === 'porcentaje') {
    const p = c.sena_porcentaje;
    return typeof p === 'number' && Number.isFinite(p) && p >= 1 && p <= 100;
  }
  const m = comoNumero(c.sena_monto);
  return m !== null && m > 0;
}

export function calcularSena(precio: number, c: SenaPreviewConfig): number {
  if (!(precio > 0) || !configValida(c)) return 0;
  const bruta = c.sena_tipo === 'porcentaje'
    ? Math.round((precio * (c.sena_porcentaje as number)) / 100)
    : (comoNumero(c.sena_monto) as number);
  return Math.min(bruta, precio);
}

function tasaCosto(c: SenaPreviewConfig): number {
  return Math.min((c.comision_mp_vigente ?? 0) + (c.retencion_iibb_porcentaje ?? 0), 95);
}

function mcd(a: number, b: number): number {
  return b === 0 ? a : mcd(b, a % b);
}

// Redondeo de las sugerencias: SIEMPRE cubre el costo (nunca baja del mínimo) y la
// clienta nunca ve montos raros. Si la suba necesaria cabe en $500 se redondea hacia
// arriba a múltiplos de $500; si la pasa, a múltiplos de $1000. `multiploBase` fuerza un
// múltiplo adicional (con seña por porcentaje, el que deja la seña en múltiplos de $100).
const UMBRAL_SUBA = 500;
const PASO_CHICO = 500;
const PASO_GRANDE = 1000;

function mcm(a: number, b: number): number {
  return (a * b) / mcd(a, b);
}

function techoAMultiplo(minimo: number, paso: number): number {
  return Math.ceil(minimo / paso - 1e-9) * paso;
}

function redondearCubriendo(original: number, minimo: number, multiploBase = 1): number {
  const chico = techoAMultiplo(minimo, mcm(PASO_CHICO, multiploBase));
  if (chico - original <= UMBRAL_SUBA) return chico;
  return techoAMultiplo(minimo, mcm(PASO_GRANDE, multiploBase));
}

// Precio sugerido (modo porcentaje): cubre el costo de MP para que la profesional
// reciba lo que quería. P_min = ceil(p / (1 - t/100)); se redondea con
// redondearCubriendo, y el precio además es múltiplo del paso que deja la SEÑA
// (precio × pct) en múltiplos de $100 (10000 / mcd(10000, pct)).
// Sin costo que cubrir (t = 0) el precio queda como está.
export function precioSugeridoSena(precio: number, c: SenaPreviewConfig): number | null {
  if (c.sena_tipo !== 'porcentaje' || !configValida(c)) return null;
  if (!(precio > 0) || !Number.isFinite(precio)) return null;
  const pct = c.sena_porcentaje as number;
  if (!Number.isInteger(pct)) return null;
  if (typeof c.comision_mp_vigente !== 'number' || !Number.isFinite(c.comision_mp_vigente)) return null;
  if (tasaCosto(c) === 0) return precio;

  const pMin = Math.ceil(precio / (1 - tasaCosto(c) / 100) - 1e-9);
  return redondearCubriendo(precio, pMin, 10000 / mcd(10000, pct));
}

export interface DesgloseSena {
  sena: number;
  cargo: number;
  retencion: number;
  /** Lo que llega: seña menos comisión de MP y retención. */
  llega: number;
}

// Desglose de una seña de monto FIJO (sin precio de servicio de por medio).
// Null si no hay seña positiva o falta la comisión vigente.
export function desgloseSena(sena: number, c: SenaPreviewConfig): DesgloseSena | null {
  const comision = c.comision_mp_vigente;
  if (!(sena > 0) || typeof comision !== 'number' || !Number.isFinite(comision)) return null;
  const cargo = Math.round((sena * comision) / 100);
  const retencion = Math.round((sena * (c.retencion_iibb_porcentaje ?? 0)) / 100);
  return { sena, cargo, retencion, llega: sena - cargo - retencion };
}

// Seña fija más alta que, descontados comisión de MP (con IVA) y retención,
// deja al menos `monto` neto. Siempre redondea HACIA ARRIBA (múltiplos de 500 o de
// 1000, ver redondearCubriendo). Sin costo que cubrir (t = 0) queda como está.
export function senaFijaSugerida(monto: number, c: SenaPreviewConfig): number | null {
  const comision = c.comision_mp_vigente;
  if (!(monto > 0) || typeof comision !== 'number' || !Number.isFinite(comision)) return null;
  if (tasaCosto(c) === 0) return monto;
  return redondearCubriendo(monto, monto / (1 - tasaCosto(c) / 100));
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

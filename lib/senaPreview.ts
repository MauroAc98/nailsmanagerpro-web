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

// Redondeo de las sugerencias: SIEMPRE cubre el costo (nunca baja del mínimo) y el paso
// se adapta al tamaño del precio. Se usa el paso más grande de la lista cuyo redondeo hacia
// arriba suma como mucho un 5% sobre el mínimo que cubre. Con un precio chico el paso grande
// se descarta solo (100 -> 110, no 1000); con uno grande queda en 500 o 1000 (18000 -> 20000).
// El último paso (1) siempre cumple, porque el mínimo ya es un entero.
const PASOS = [1000, 500, 100, 50, 10, 1];
const TOPE_SUBA_REDONDEO = 0.05;

function techoAMultiplo(minimo: number, paso: number): number {
  return Math.ceil(minimo / paso - 1e-9) * paso;
}

function redondearCubriendo(minimo: number): number {
  for (const paso of PASOS) {
    const techo = techoAMultiplo(minimo, paso);
    if (techo - minimo <= minimo * TOPE_SUBA_REDONDEO + 1e-9) return techo;
  }
  return minimo;
}

// Precio sugerido (modo porcentaje): cubre el costo de MP para que la profesional
// reciba lo que quería. P_min = ceil(p / (1 - t/100)), redondeado con redondearCubriendo.
// La seña que resulta (precio × pct) no tiene por qué ser redonda: lo que importa es que
// el precio sea cercano al mínimo y prolijo.
// Sin costo que cubrir (t = 0) el precio queda como está.
export function precioSugeridoSena(precio: number, c: SenaPreviewConfig): number | null {
  if (c.sena_tipo !== 'porcentaje' || !configValida(c)) return null;
  if (!(precio > 0) || !Number.isFinite(precio)) return null;
  if (typeof c.comision_mp_vigente !== 'number' || !Number.isFinite(c.comision_mp_vigente)) return null;
  if (tasaCosto(c) === 0) return precio;

  const pMin = Math.ceil(precio / (1 - tasaCosto(c) / 100) - 1e-9);
  return redondearCubriendo(pMin);
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
// deja al menos `monto` neto. Siempre redondea HACIA ARRIBA con el paso que se adapta
// al monto (ver redondearCubriendo). Sin costo que cubrir (t = 0) queda como está.
export function senaFijaSugerida(monto: number, c: SenaPreviewConfig): number | null {
  const comision = c.comision_mp_vigente;
  if (!(monto > 0) || typeof comision !== 'number' || !Number.isFinite(comision)) return null;
  if (tasaCosto(c) === 0) return monto;
  return redondearCubriendo(Math.ceil(monto / (1 - tasaCosto(c) / 100) - 1e-9));
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

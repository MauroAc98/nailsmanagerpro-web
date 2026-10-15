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

// La seña por porcentaje cubre la comisión de Mercado Pago (y la retención de impuestos): a la
// profesional le llega, como mínimo, el porcentaje del precio final del turno; el cliente deja un
// poco más. Se redondea hacia arriba para que el cliente complete la diferencia en el local con
// billetes redondos. El paso depende del monto que cubre la comisión (< 100 -> 10, < 500 -> 100,
// desde 500 -> 500): así una seña chica no salta a otra enorme. Tope: el precio.
// Espeja MercadoPagoService::senaParaPrecio del backend.
const PASO_SENA_GRANDE = 500;
const PASO_SENA_MEDIANO = 100;
const PASO_SENA_CHICO = 10;
const MAX_REINTENTOS_SENA = 200;

export function pasoSenaPorcentaje(monto: number): number {
  if (monto >= PASO_SENA_GRANDE) return PASO_SENA_GRANDE;
  return monto >= PASO_SENA_MEDIANO ? PASO_SENA_MEDIANO : PASO_SENA_CHICO;
}

function techoAMultiplo(valor: number, paso: number): number {
  return Math.ceil(valor / paso - 1e-9) * paso;
}

// Seña exacta de un porcentaje (backend: round(precio * pct / 100, 2); precio * pct viene en centésimos).
export function senaPorcentajeExacta(precio: number, porcentaje: number): number {
  return Math.round(precio * porcentaje) / 100;
}

function tasaCosto(c: SenaPreviewConfig): number {
  return Math.min((c.comision_mp_vigente ?? 0) + (c.retencion_iibb_porcentaje ?? 0), 95);
}

// Menor seña entera que, descontado el costo (MP + retención), deja `exacta`: exacta / (1 - t).
export function senaMinimaQueCubre(exacta: number, c: SenaPreviewConfig): number {
  return Math.ceil(exacta / (1 - tasaCosto(c) / 100) - 1e-9);
}

// Lo que llega de una seña: menos la comisión y la retención, cada una a pesos enteros.
function netoDeSena(sena: number, c: SenaPreviewConfig): number {
  const cargo = Math.round((sena * (c.comision_mp_vigente ?? 0)) / 100);
  const retencion = Math.round((sena * (c.retencion_iibb_porcentaje ?? 0)) / 100);
  return sena - cargo - retencion;
}

export function calcularSena(precio: number, c: SenaPreviewConfig): number {
  if (!(precio > 0) || !configValida(c)) return 0;
  let bruta: number;
  if (c.sena_tipo === 'porcentaje') {
    const exacta = senaPorcentajeExacta(precio, c.sena_porcentaje as number);
    const minimo = senaMinimaQueCubre(exacta, c);
    const paso = pasoSenaPorcentaje(minimo);
    bruta = techoAMultiplo(minimo, paso);
    // El cargo y la retención se redondean por separado: se verifica y, si no alcanza, se sube un paso.
    for (let i = 0; i < MAX_REINTENTOS_SENA && netoDeSena(bruta, c) < exacta; i++) bruta += paso;
  } else {
    bruta = comoNumero(c.sena_monto) as number;
  }
  return Math.min(bruta, precio);
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

// Seña fija más alta que, descontados comisión de MP (con IVA) y retención, deja al
// menos `monto` neto. Siempre redondea HACIA ARRIBA a un múltiplo de 500 (billetes
// redondos para completar en el local); si eso suma más de un 10% sobre el mínimo
// (montos chicos: 1000 -> 1500) prueba un paso de 100 y, si tampoco entra, uno de 10 (100 -> 110,
// no 200). Sin costo que cubrir (t = 0) queda como está.
const TOPE_SUBA_SENA_FIJA = 0.1;
const PASOS_SENA_FIJA = [500, 100, 10];

export function senaFijaSugerida(monto: number, c: SenaPreviewConfig): number | null {
  const comision = c.comision_mp_vigente;
  if (!(monto > 0) || typeof comision !== 'number' || !Number.isFinite(comision)) return null;
  if (tasaCosto(c) === 0) return monto;
  const minimo = Math.ceil(monto / (1 - tasaCosto(c) / 100) - 1e-9);
  for (const paso of PASOS_SENA_FIJA) {
    const redonda = techoAMultiplo(minimo, paso);
    if (redonda - minimo <= minimo * TOPE_SUBA_SENA_FIJA + 1e-9) return redonda;
  }
  return techoAMultiplo(minimo, PASOS_SENA_FIJA[PASOS_SENA_FIJA.length - 1]);
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

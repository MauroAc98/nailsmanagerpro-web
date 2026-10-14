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

// La seña por porcentaje se redondea hacia arriba para que el cliente pueda completar la
// diferencia en el local con billetes redondos. El paso depende del monto exacto de la seña
// (< 100 -> 10, < 500 -> 100, desde 500 -> 500): así una seña chica no salta a otra enorme
// (un precio de 100 al 30% da 30, no 100). Espeja MercadoPagoService::pasoSenaPorcentaje.
const PASO_SENA_GRANDE = 500;
const PASO_SENA_MEDIANO = 100;
const PASO_SENA_CHICO = 10;

export function pasoSenaPorcentaje(senaExacta: number): number {
  if (senaExacta >= PASO_SENA_GRANDE) return PASO_SENA_GRANDE;
  return senaExacta >= PASO_SENA_MEDIANO ? PASO_SENA_MEDIANO : PASO_SENA_CHICO;
}

function techoAMultiplo(valor: number, paso: number): number {
  return Math.ceil(valor / paso - 1e-9) * paso;
}

// Seña exacta de un porcentaje (backend: round(precio * pct / 100, 2); precio * pct viene en centésimos).
export function senaPorcentajeExacta(precio: number, porcentaje: number): number {
  return Math.round(precio * porcentaje) / 100;
}

export function calcularSena(precio: number, c: SenaPreviewConfig): number {
  if (!(precio > 0) || !configValida(c)) return 0;
  let bruta: number;
  if (c.sena_tipo === 'porcentaje') {
    const exacta = senaPorcentajeExacta(precio, c.sena_porcentaje as number);
    bruta = techoAMultiplo(exacta, pasoSenaPorcentaje(exacta));
  } else {
    bruta = comoNumero(c.sena_monto) as number;
  }
  return Math.min(bruta, precio);
}

function tasaCosto(c: SenaPreviewConfig): number {
  return Math.min((c.comision_mp_vigente ?? 0) + (c.retencion_iibb_porcentaje ?? 0), 95);
}

// Precio sugerido (modo porcentaje): que la profesional NO PIERDA plata por la comisión.
// Con el precio nuevo, lo que cobra (precio menos el costo de MP sobre la seña ya redondeada)
// alcanza al precio de hoy. El precio sugerido es un número prolijo: se usa el paso más grande
// de la lista cuyo techo no pase del 1,5% del precio sobre el mínimo analítico
// P_min = ceil(p / (1 - pct × t)). El paso más fino depende del precio (10 / 100 / 1000) para
// no sugerir $5.150 ni $46.500. Si ningún paso entra en la tolerancia, se usa el más fino.
// Sin costo que cubrir (t = 0) el precio queda como está.
const PASOS_PRECIO = [1000, 500, 100, 50, 10, 1];
const TOPE_SUBA_PRECIO = 0.015;
const MAX_REINTENTOS_PRECIO = 200;

function pasoMinimoPrecio(precio: number): number {
  if (precio < 1000) return 10;
  return precio < 40000 ? 100 : 1000;
}

export function precioSugeridoSena(precio: number, c: SenaPreviewConfig): number | null {
  if (c.sena_tipo !== 'porcentaje' || !configValida(c)) return null;
  if (!(precio > 0) || !Number.isFinite(precio)) return null;
  if (typeof c.comision_mp_vigente !== 'number' || !Number.isFinite(c.comision_mp_vigente)) return null;
  if (tasaCosto(c) === 0) return precio;

  const fraccion = ((c.sena_porcentaje as number) / 100) * (tasaCosto(c) / 100);
  const minimo = Math.ceil(precio / (1 - fraccion) - 1e-9);
  const pasos = PASOS_PRECIO.filter(p => p >= pasoMinimoPrecio(precio));
  const llegaCon = (candidato: number) => {
    const p = calcularSenaPreview(candidato, c);
    return p ? candidato - p.cargo - p.retencion : -Infinity;
  };
  // El redondeo de la seña hace que el neto no sea monótono: se verifica el candidato y,
  // si no cubre, se sube de a un paso.
  const techoQueCubre = (paso: number): number | null => {
    let candidato = techoAMultiplo(minimo, paso);
    for (let i = 0; i < MAX_REINTENTOS_PRECIO && llegaCon(candidato) < precio; i++) candidato += paso;
    return llegaCon(candidato) >= precio ? candidato : null;
  };

  for (const paso of pasos) {
    const candidato = techoQueCubre(paso);
    if (candidato !== null && candidato - minimo <= precio * TOPE_SUBA_PRECIO + 1e-9) return candidato;
  }
  const masFino = pasos[pasos.length - 1];
  return techoQueCubre(masFino) ?? techoAMultiplo(minimo, masFino);
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
// (montos chicos: 1000 -> 1500) usa un paso de 100. Sin costo que cubrir (t = 0) queda como está.
const TOPE_SUBA_SENA_FIJA = 0.1;
const PASO_SENA_FIJA = 500;

export function senaFijaSugerida(monto: number, c: SenaPreviewConfig): number | null {
  const comision = c.comision_mp_vigente;
  if (!(monto > 0) || typeof comision !== 'number' || !Number.isFinite(comision)) return null;
  if (tasaCosto(c) === 0) return monto;
  const minimo = Math.ceil(monto / (1 - tasaCosto(c) / 100) - 1e-9);
  const redonda = techoAMultiplo(minimo, PASO_SENA_FIJA);
  return redonda - minimo <= minimo * TOPE_SUBA_SENA_FIJA + 1e-9 ? redonda : techoAMultiplo(minimo, 100);
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

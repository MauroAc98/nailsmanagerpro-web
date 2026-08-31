// Regla de negocio y saneo de los datos de seña para las confirmaciones de
// WhatsApp. Espeja el backend (NailsManagerProApi):
//   - `AuthController::updatePerfil` — guard para activar `whatsapp_pide_sena`
//   - `WhatsappTemplate::unaLinea` — colapsa espacios/saltos antes de mandar
//     el dato bancario a Meta (`{{8}}` de `reserva_turno_sena`).
// No hay una fuente única compartida entre front y back; si el guard del
// backend cambia, hay que actualizar esto también.

/** Campos del formulario de "Mi negocio" que pueden mostrar un error de seña. */
export type SenaCampo =
  | 'sena_monto'
  | 'direccion'
  | 'whatsapp_sena_titular'
  | 'whatsapp_sena_alias';

/**
 * Aplana un valor a una sola línea: quita `\r`, `\n` y `\t`, colapsa las
 * corridas de espacios interiores y recorta los extremos. El backend rechaza
 * los tres caracteres de control en los 4 campos bancarios y colapsa el
 * espacio interior al armar el mensaje — hacemos lo mismo antes de enviar
 * para que lo guardado coincida con lo que ve el cliente en el chat.
 */
export function sanitizarLineaSimple(valor: string): string {
  return valor.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface SenaConfigInput {
  /** Monto de seña ya parseado: `undefined` = vacío, número = formato válido. */
  monto: number | undefined;
  direccion: string;
  titular: string;
  alias: string;
  cbu: string;
}

/**
 * Valida que se pueda activar "pedir seña". Espeja el guard del backend:
 * requiere `monto > 0`, `direccion` cargada, `titular` y (`alias` o `cbu`).
 * `entidad` y `cbu` son opcionales por separado. Devuelve un mapa
 * campo -> código de error (objeto vacío = válido). El componente traduce
 * el código.
 */
export function validarSenaConfig(input: SenaConfigInput): Partial<Record<SenaCampo, string>> {
  const errores: Partial<Record<SenaCampo, string>> = {};

  if (input.monto === undefined || input.monto <= 0) {
    errores.sena_monto = 'montoRequerido';
  }
  if (sanitizarLineaSimple(input.direccion) === '') {
    errores.direccion = 'direccionRequerida';
  }
  if (sanitizarLineaSimple(input.titular) === '') {
    errores.whatsapp_sena_titular = 'titularRequerido';
  }
  if (sanitizarLineaSimple(input.alias) === '' && sanitizarLineaSimple(input.cbu) === '') {
    errores.whatsapp_sena_alias = 'aliasOCbuRequerido';
  }

  return errores;
}

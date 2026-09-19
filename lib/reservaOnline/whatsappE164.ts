// Validacion de WhatsApp en formato E.164: '+' + codigo de pais (sin 0
// inicial) + numero, 8 a 15 digitos en total.
const E164 = /^\+[1-9]\d{7,14}$/;

export function esWhatsappE164(valor: string): boolean {
  return E164.test(valor);
}

// Limpia separadores de tipeo (espacios, guiones, parentesis, puntos). No
// agrega el '+': si la clienta no lo puso, la validacion lo rechaza y ve el error.
export function normalizarWhatsappE164(valor: string): string {
  return valor.replace(/[\s\-().]/g, '');
}

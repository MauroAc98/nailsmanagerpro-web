import { phoneUtils } from '@/lib/phoneUtils';

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

// Celulares de Argentina: prefijo fijo +54 9. La clienta tipea solo el numero
// local (codigo de area + numero) y aca se arma el E.164. Si pega el numero
// completo (+54 9 ...) no se duplica el prefijo; el 0 inicial del area se descarta.
const PREFIJO_AR = '+549';

export function whatsappArgentino(entrada: string): string {
  const conMas = entrada.trim().startsWith('+');
  let digitos = entrada.replace(/\D/g, '');
  if (conMas && digitos.startsWith('549')) digitos = digitos.slice(3);
  digitos = digitos.replace(/^0+/, '');
  return digitos ? `${PREFIJO_AR}${digitos}` : '';
}

// Inversa para volver a mostrar el numero guardado en el campo (sin el prefijo fijo).
export function localDeWhatsapp(e164: string): string {
  return e164.startsWith(PREFIJO_AR) ? e164.slice(PREFIJO_AR.length) : e164;
}

// Con selector de pais: Argentina sigue siendo +54 9 (ver arriba); el resto arma
// +codigo + numero local. Si el numero llega pegado con el codigo del pais (con
// '+') no se duplica; el 0 inicial se descarta.
export function whatsappConPais(entrada: string, codigo: string): string {
  if (codigo === '54') return whatsappArgentino(entrada);
  let digitos = entrada.replace(/\D/g, '');
  if (entrada.trim().startsWith('+') && digitos.startsWith(codigo)) digitos = digitos.slice(codigo.length);
  digitos = digitos.replace(/^0+/, '');
  return digitos ? `+${codigo}${digitos}` : '';
}

// Inversa: separa un E.164 guardado en codigo de pais (el de PAISES que
// corresponda; Argentina si no se reconoce) y numero local para el campo.
export function separarWhatsapp(e164: string): { codigo: string; local: string } {
  if (e164.startsWith(PREFIJO_AR)) return { codigo: '54', local: e164.slice(PREFIJO_AR.length) };
  if (!e164) return { codigo: '54', local: '' };
  const digitos = phoneUtils.clean(e164);
  const { codigo, numero } = phoneUtils.splitCodigoPais(digitos);
  return { codigo, local: numero };
}

// E.164 valido y, para Argentina, con area + numero completos (10 digitos despues
// del +54 9): un "15" de mas o un numero cortado no llega a WhatsApp.
export function esWhatsappCompleto(valor: string): boolean {
  if (!esWhatsappE164(valor)) return false;
  return !valor.startsWith(PREFIJO_AR) || valor.length === PREFIJO_AR.length + 10;
}

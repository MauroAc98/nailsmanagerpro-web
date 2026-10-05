// Interpreta un monto en pesos escrito a mano, con convención es-AR.
//
// `<input type="number">` + `parseFloat` leía "1.500" como 1,5 y lo guardaba
// sin avisar. En pesos no existen los decimales de 3 dígitos, así que un punto
// seguido de exactamente 3 dígitos es separador de miles.
//
//   "1500"      -> 1500
//   "1.500"     -> 1500        (miles)
//   "1.500,50"  -> 1500.5
//   "150,5"     -> 150.5
//   "150.50"    -> 150.5       (decimal: 1-2 dígitos)
//   "1,500"     -> null        (ambiguo, se rechaza en vez de adivinar)
//   "150,"      -> null        (entrada a medio escribir)
//
// Devuelve null si el texto no es un monto válido o vacío; el caller decide
// si vacío es error o "sin valor".
const CON_MILES = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/;
const SIMPLE = /^\d+([.,]\d{1,2})?$/;

export function parsearMonto(texto: string): number | null {
  const limpio = texto.trim();
  if (CON_MILES.test(limpio)) {
    return Number(limpio.replace(/\./g, '').replace(',', '.'));
  }
  if (SIMPLE.test(limpio)) {
    return Number(limpio.replace(',', '.'));
  }
  return null;
}

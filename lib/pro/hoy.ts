// Día de calendario de HOY en el dispositivo, como "YYYY-MM-DD". Es lo único que
// necesita la agenda para arrancar en "hoy": se arma con los getters LOCALES
// (nunca toISOString, que pasa por UTC y corre el día de noche). Vive aparte de
// fechaHora.ts porque ese módulo tiene vetado `Date` por test estático.
export function hoyDelDispositivo(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${String(ahora.getFullYear()).padStart(4, '0')}-${mes}-${dia}`;
}

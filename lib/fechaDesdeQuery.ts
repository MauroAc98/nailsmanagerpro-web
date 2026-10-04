// Valida el `?fecha=` con el que se abre la agenda (deep link de las
// notificaciones). Devuelve la fecha tal cual si es un YYYY-MM-DD real de
// calendario, o null para cualquier otra cosa (la agenda cae en "hoy").
export function fechaValidaDeQuery(valor: string | null | undefined): string | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [y, m, d] = valor.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const coincide =
    fecha.getFullYear() === y && fecha.getMonth() === m - 1 && fecha.getDate() === d;
  return coincide ? valor : null;
}

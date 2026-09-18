// Iniciales para el avatar de los selectores de profesional (Agenda,
// Gastos, Slots, historia-precios, etc.) — nombre+apellido cuando hay
// apellido cargado (cuentas viejas pueden no tenerlo), si no las primeras
// dos palabras del nombre, si no las 2 primeras letras de una sola palabra.
export function inicialesProfesional(nombre: string, apellido?: string | null): string {
  const n = nombre.trim();
  const a = apellido?.trim();
  if (a) return (n.charAt(0) + a.charAt(0)).toUpperCase();

  const partes = n.split(/\s+/).filter(Boolean);
  if (partes.length > 1) return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();

  return n.slice(0, 2).toUpperCase();
}

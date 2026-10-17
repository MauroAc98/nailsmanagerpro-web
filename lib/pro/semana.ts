// Aritmética de calendario de la tira semanal. Trabaja con días "YYYY-MM-DD" y usa
// Date SOLO para la grilla (año/mes/día locales), nunca para horas de turnos ni
// para parsear `fecha_hora`. Los getters son locales: nunca toISOString, que pasa
// por UTC y corre el día.

export function aDateLocal(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

function aTexto(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${String(d.getFullYear()).padStart(4, '0')}-${mes}-${dia}`;
}

export function sumarDias(fecha: string, dias: number): string {
  const d = aDateLocal(fecha);
  return aTexto(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias));
}

// Los 7 días (lunes a domingo) de la semana que contiene `fecha`.
export function diasDeSemana(fecha: string): string[] {
  const lunes = sumarDias(fecha, -((aDateLocal(fecha).getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

// Normaliza la selección del WeekdayPicker antes de mandarla al backend:
// sin días marcados o los 7 marcados son, en la práctica, "atiende todos
// los días" — mismo significado que `null` (el default del backend cuando
// se omite el campo). Enviar `null` en vez de un array redundante evita
// representaciones divergentes del mismo estado (ver Design > Risks).
export function diasAtencionParaGuardar(dias: number[]): number[] | null {
  if (dias.length === 0 || dias.length === 7) return null;
  return dias;
}

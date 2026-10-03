function palabras(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// ¿El nombre del negocio ya incluye el nombre de la profesional? (por
// palabra completa, sin distinguir mayúsculas ni acentos). Sirve para no
// repetir "con Natalia" bajo "Natalia Acosta Studio".
export function nombreYaEnNegocio(
  profesional: string | null | undefined,
  negocio: string | null | undefined,
): boolean {
  if (!profesional || !negocio) return false;
  const buscadas = palabras(profesional);
  if (buscadas.length === 0) return false;
  const delNegocio = new Set(palabras(negocio));
  return buscadas.every(p => delNegocio.has(p));
}

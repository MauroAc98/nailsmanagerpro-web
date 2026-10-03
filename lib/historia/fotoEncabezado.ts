interface ProfesionalConAvatar {
  id: number;
  avatar_url?: string | null;
}

// Foto del recuadro del encabezado de la historia: el logo del negocio por
// defecto; si hay una profesional tildada y tiene avatar, el de ella.
export function elegirFotoEncabezado(
  profesionales: ProfesionalConAvatar[],
  profesionalTildadaId: number | null,
  logoUrl: string | null,
): string | null {
  if (profesionalTildadaId !== null) {
    const avatar = profesionales.find(p => p.id === profesionalTildadaId)?.avatar_url;
    if (avatar) return avatar;
  }
  return logoUrl;
}

// Profesional que se muestra en el encabezado: la efectiva del selector (la
// dueña por defecto, o la que se eligió). Un único diseño para todas las
// cuentas, también con una sola profesional activa.
export function profesionalDelEncabezado<T extends { id: number }>(
  activas: T[],
  efectivaId: number | null,
): T | null {
  if (efectivaId === null) return null;
  return activas.find(p => p.id === efectivaId) ?? null;
}

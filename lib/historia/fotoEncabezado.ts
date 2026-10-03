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

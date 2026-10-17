import Image from 'next/image';
import { AvatarProfesional } from '@/components/filtros/AvatarProfesional';

interface Props {
  profesional: { nombre: string; apellido?: string | null; avatar_url?: string | null } | null;
  size: number;
  radioLogo: number;
  // Solo la cabecera lo pide: es la imagen más grande de la primera pantalla.
  prioridad?: boolean;
}

// Foto de la profesional del vínculo activo o, si no tiene, el logo del portal.
// Decorativo: al lado siempre hay un texto (saludo, marca o nombre) que ya nombra.
export function VisualProfesional({ profesional, size, radioLogo, prioridad = false }: Props) {
  if (profesional?.avatar_url) {
    return <AvatarProfesional nombre={profesional.nombre} avatarUrl={profesional.avatar_url} size={size} />;
  }
  return (
    <Image
      src="/pro-logo.png"
      alt=""
      width={size}
      height={size}
      priority={prioridad}
      style={{ borderRadius: radioLogo, flexShrink: 0 }}
    />
  );
}

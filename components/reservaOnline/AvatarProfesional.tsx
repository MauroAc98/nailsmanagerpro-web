'use client';

import { inicialesProfesional } from '@/lib/inicialesProfesional';
import { agendaColors as colors } from '@/theme/agendaColors';

// Avatar circular de una profesional: foto si la tiene, si no sus iniciales.
export function AvatarProfesional({
  nombre,
  avatarUrl,
  size,
  fg,
  bg,
}: {
  nombre: string;
  avatarUrl: string | null;
  size: number;
  fg?: string;
  bg?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.36), fontWeight: 800,
        background: bg ?? colors.primary, color: fg ?? colors.primaryFg,
      }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        inicialesProfesional(nombre)
      )}
    </span>
  );
}

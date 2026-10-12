import { withAlpha } from '@/theme/colors';
import { agendaColors as colors } from '@/theme/agendaColors';
import { inicialesProfesional } from '@/lib/inicialesProfesional';

interface Props {
  nombre: string;
  apellido?: string | null;
  color?: string | null;
  avatarUrl?: string | null;
  size?: number;
}

// Mismo avatar que las pills de SelectorProfesional (foto real o iniciales
// sobre el color propio), a tamaño libre.
export function AvatarProfesional({ nombre, apellido, color, avatarUrl, size = 32 }: Props) {
  const c = color || colors.primary;
  return (
    <span style={{
      width: size, height: size, borderRadius: size / 2, flexShrink: 0, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.36), fontWeight: 800,
      backgroundColor: withAlpha(c, '26'), color: c,
    }}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        inicialesProfesional(nombre, apellido)
      )}
    </span>
  );
}

import type { CSSProperties, ReactNode } from 'react';
import { agendaColors as colors } from '@/theme/agendaColors';

interface Props {
  children: ReactNode;
  // Override puntual (margen, ancho...) sobre el estilo base del aviso.
  style?: CSSProperties;
  // Etiqueta a renderizar: 'span' (default) o 'p' cuando el aviso es un párrafo suelto.
  as?: 'span' | 'p';
}

// Aviso ámbar compartido (p. ej. "estos servicios no entran en la historia").
export function AvisoAmbar({ children, style, as: Tag = 'span' }: Props) {
  return (
    <Tag style={{
      fontSize: 12.5, lineHeight: 1.4, padding: '8px 12px', borderRadius: 10,
      background: colors.amberBg, color: colors.amberFg,
      ...style,
    }}>
      {children}
    </Tag>
  );
}

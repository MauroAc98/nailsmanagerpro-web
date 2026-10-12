'use client';

import { Children, Fragment, type ReactNode } from 'react';
import { agendaColors as colors } from '@/theme/agendaColors';

interface Props {
  // Filas (FilaQueMostrar). Los hijos vacíos (false/null) no dejan línea.
  children: ReactNode;
  // Título chico sobre la tarjeta (ej. "Qué mostrar").
  caption?: string;
}

// Tarjeta "Qué mostrar": borde redondeado con una línea de 1px entre filas.
export function TarjetaQueMostrar({ children, caption }: Props) {
  const filas = Children.toArray(children);
  return (
    <>
      {caption && (
        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: colors.muted }}>{caption}</p>
      )}
      <div style={{
        width: '100%', background: colors.surface, border: `1px solid ${colors.divider}`,
        borderRadius: 14, overflow: 'hidden',
      }}>
        {filas.map((fila, i) => (
          <Fragment key={i}>
            {i > 0 && <div data-divisor style={{ height: 1, background: colors.divider }} />}
            {fila}
          </Fragment>
        ))}
      </div>
    </>
  );
}

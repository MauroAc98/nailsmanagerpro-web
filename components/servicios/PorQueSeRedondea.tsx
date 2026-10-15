'use client';

import { useState } from 'react';
import { agendaColors as colors } from '@/theme/agendaColors';

interface Props {
  titulo: string;
  texto: string;
}

// "¿Por qué se redondea?": la explicación queda a un toque, sin alargar la frase del extra del redondeo.
export default function PorQueSeRedondea({ titulo, texto }: Props) {
  const [abierto, setAbierto] = useState(false);
  return (
    // display: contents: el botón y el texto se acomodan en el contenedor de quien lo usa (por ejemplo, en la misma fila que 'Ver detalle').
    <div style={{ display: 'contents' }}>
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto(v => !v)}
        style={{
          alignSelf: 'flex-start', minHeight: 44, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
          color: colors.primaryDeep, fontSize: 14, fontWeight: 600,
        }}
      >
        {titulo}
      </button>
      {abierto && <p style={{ margin: 0, width: '100%', fontSize: 13, lineHeight: 1.4, color: colors.subtext }}>{texto}</p>}
    </div>
  );
}

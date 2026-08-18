'use client';

import { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  fotos:          string[];
  overlayOpacity: number;
  children:       ReactNode;
}

// LayoutBeforeAfter — 2 fotos apiladas igual que LayoutSplit2 (foto[0]
// arriba, foto[1] abajo, cada una 50% de alto), con etiquetas "ANTES"/
// "DESPUÉS" superpuestas en la esquina de cada mitad. A diferencia de
// Split2 (deliberadamente plano y sin adornos, ver su comentario), acá el
// rótulo ES el punto — mostrar el proceso, no solo 2 fotos sueltas.
function Etiqueta({ texto }: { texto: string }) {
  return (
    <span
      style={{
        position: 'absolute', top: 10, left: 12, fontSize: 9, fontWeight: 700,
        letterSpacing: 2, textTransform: 'uppercase', color: '#ffffff',
        background: 'rgba(0,0,0,0.5)', padding: '3px 8px', borderRadius: 4,
      }}
    >
      {texto}
    </span>
  );
}

export function LayoutBeforeAfter({ fotos, overlayOpacity, children }: Props) {
  const t = useTranslations('historia.LayoutBeforeAfter');
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', overflow: 'hidden' }}>
        <img src={fotos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <Etiqueta texto={t('antes')} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', overflow: 'hidden' }}>
        <img src={fotos[1]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <Etiqueta texto={t('despues')} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})` }} />
      {children}
    </div>
  );
}

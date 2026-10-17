'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors } from '@/theme/agendaColors';

// Cuatro líneas de texto entran en ~120 caracteres o 3 saltos de línea: pasado eso
// la nota se recorta y se ofrece "Ver todo".
const esLarga = (texto: string): boolean => texto.length > 120 || (texto.match(/\n/g) ?? []).length >= 3;

// Bloque ámbar de solo lectura con las notas del turno, igual al de la agenda de
// la titular. Las notas son texto plano: nunca se interpretan como HTML.
export function NotasDelTurnoPro({ notas }: { notas: string }) {
  const t = useTranslations('profesionales.Detalle');
  const [abierta, setAbierta] = useState(false);
  const larga = esLarga(notas);

  return (
    <section
      style={{
        display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', marginBottom: 20,
        borderRadius: 16, background: agendaColors.amberBg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: agendaColors.amberFg }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
          <path d="M5.5 6.5h5M5.5 8.5h3" />
        </svg>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{t('notasTitulo')}</h2>
      </div>
      <p
        data-testid="detalle-notas"
        dir="auto"
        style={{
          margin: 0, fontSize: 14.5, lineHeight: 1.5, color: agendaColors.strong, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', unicodeBidi: 'isolate',
          ...(larga && !abierta ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}),
        }}
      >
        {notas}
      </p>
      {larga && (
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          style={{
            alignSelf: 'flex-start', minHeight: 32, padding: '4px 0', border: 'none', background: 'none',
            fontSize: 13, fontWeight: 700, color: agendaColors.amberFg, cursor: 'pointer',
          }}
        >
          {abierta ? t('verMenos') : t('verTodo')}
        </button>
      )}
    </section>
  );
}
